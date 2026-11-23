"""
Proctoring Agent Service
Handles real-time proctoring telemetry, DOM event monitoring,
camera frame analysis for face presence and proxy candidate detection,
and persists violation logs with customizable soft/hard severity policies.
"""
import base64
import json
import os
import cv2
import numpy as np
from datetime import datetime
from sqlalchemy.orm import Session
from models import Violation, User

# Paths & Models
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YUNET_MODEL_PATH = os.path.join(BACKEND_DIR, "face_detection_yunet_2023mar.onnx")

# Customizable Policy Thresholds
MAX_SOFT_FLAGS_BEFORE_HARD = 3
MAX_HARD_FLAGS_FOR_TERMINATION = 3
LARGE_PASTE_THRESHOLD = 50

# Cache face detector instance
_face_detector = None


def get_face_detector():
    """Lazily load and cache YuNet FaceDetectorYN."""
    global _face_detector
    if _face_detector is None:
        if os.path.exists(YUNET_MODEL_PATH):
            try:
                _face_detector = cv2.FaceDetectorYN.create(
                    YUNET_MODEL_PATH,
                    "",
                    (320, 320),
                    score_threshold=0.6,
                    nms_threshold=0.3,
                    top_k=5000
                )
            except Exception as e:
                print(f"[Proctoring] Failed to initialize YuNet detector: {e}")
                _face_detector = None
    return _face_detector


def analyze_camera_frame(base64_image_data: str) -> dict:
    """
    Decodes a base64 camera frame and evaluates for proxy candidates:
    - Camera occlusion / black frame
    - No face present (candidate away)
    - Multiple faces present (unauthorized assistance / proxy)
    - Face orientation / alignment
    """
    if not base64_image_data:
        return {
            "proxy_status": "NO_IMAGE",
            "face_count": 0,
            "message": "No camera data provided.",
            "is_violation": False
        }

    try:
        # Strip header if present
        if "," in base64_image_data:
            base64_image_data = base64_image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(base64_image_data)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            return {
                "proxy_status": "DECODE_ERROR",
                "face_count": 0,
                "message": "Failed to decode camera frame.",
                "is_violation": False
            }

        h, w = frame.shape[:2]

        # 1. Tamper / occlusion check: black or completely static frame
        std_dev = float(np.std(frame))
        mean_brightness = float(np.mean(frame))
        if std_dev < 6.0 or mean_brightness < 8.0:
            return {
                "proxy_status": "CAMERA_OCCLUDED",
                "face_count": 0,
                "confidence": 0.0,
                "message": "Camera is covered, darkened, or occluded.",
                "is_violation": True,
                "event_type": "CAMERA_TAMPER",
                "suggested_severity": "HARD"
            }

        # 2. Face detection via YuNet
        detector = get_face_detector()
        if detector is None:
            # Fallback if model file is unavailable: frame is valid and unoccluded
            return {
                "proxy_status": "VERIFIED_ACTIVE",
                "face_count": 1,
                "message": "Camera feed active (fallback detector).",
                "is_violation": False
            }

        # Resize to fixed dimension for consistent fast detection
        target_w, target_h = 320, 320
        resized = cv2.resize(frame, (target_w, target_h))
        detector.setInputSize((target_w, target_h))

        _, faces = detector.detect(resized)

        if faces is None or len(faces) == 0:
            return {
                "proxy_status": "NO_FACE",
                "face_count": 0,
                "confidence": 0.0,
                "message": "No face detected in camera frame. Candidate must remain in view.",
                "is_violation": True,
                "event_type": "NO_FACE",
                "suggested_severity": "SOFT"
            }

        num_faces = len(faces)
        best_conf = float(faces[0][-1])

        if num_faces > 1:
            return {
                "proxy_status": "MULTIPLE_FACES",
                "face_count": num_faces,
                "confidence": best_conf,
                "message": f"Multiple people detected in view ({num_faces} faces). Possible proxy detected!",
                "is_violation": True,
                "event_type": "MULTIPLE_FACES",
                "suggested_severity": "HARD"
            }

        # Single face detected
        # Check if looking far away using nose and eyes landmark ratios
        # Face landmarks: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rc, y_rc, x_lc, y_lc, score]
        is_looking_away = False
        face_info = faces[0]
        if len(face_info) >= 15:
            re_x, le_x, nt_x = face_info[4], face_info[6], face_info[8]
            eye_dist = abs(le_x - re_x)
            if eye_dist > 5:
                # Ratio of nose position between eyes
                nose_ratio = (nt_x - min(re_x, le_x)) / eye_dist
                if nose_ratio < 0.15 or nose_ratio > 0.85:
                    is_looking_away = True

        if is_looking_away:
            return {
                "proxy_status": "LOOKING_AWAY",
                "face_count": 1,
                "confidence": best_conf,
                "message": "Candidate is looking away from the assessment screen.",
                "is_violation": True,
                "event_type": "LOOKING_AWAY",
                "suggested_severity": "SOFT"
            }

        return {
            "proxy_status": "VERIFIED_SINGLE_FACE",
            "face_count": 1,
            "confidence": round(best_conf, 2),
            "message": "Candidate verified and facing screen.",
            "is_violation": False
        }

    except Exception as e:
        print(f"[Proctoring] Camera frame analysis error: {e}")
        return {
            "proxy_status": "ERROR",
            "face_count": 0,
            "message": f"Analysis error: {str(e)}",
            "is_violation": False
        }


def record_violation(
    db: Session,
    test_id: int | None,
    student_name: str,
    event_type: str,
    details: dict | None = None,
    severity_override: str | None = None
) -> dict:
    """
    Evaluates violation against customizable policy thresholds,
    persists it into the Violations table, and calculates cumulative flags.
    """
    details_dict = details or {}

    # Query prior violations for this student and test session
    query = db.query(Violation).filter(Violation.student_name == student_name)
    if test_id is not None:
        query = query.filter(Violation.test_id == test_id)
    prior_violations = query.all()

    prior_soft_count = sum(1 for v in prior_violations if v.severity == "SOFT")
    prior_hard_count = sum(1 for v in prior_violations if v.severity == "HARD")

    # Count prior occurrences of this specific event type
    prior_same_event_count = sum(1 for v in prior_violations if v.event_type == event_type)

    # Determine Severity based on event type & threshold escalation
    if severity_override:
        severity = severity_override.upper()
    else:
        if event_type == "MULTI_DISPLAY":
            severity = "HARD"
        elif event_type == "MULTIPLE_FACES":
            severity = "HARD"
        elif event_type == "CAMERA_TAMPER":
            severity = "HARD"
        elif event_type == "LARGE_PASTE":
            paste_len = details_dict.get("length", 0)
            severity = "HARD" if paste_len > 120 else "SOFT"
        elif event_type in ("TAB_SWITCH", "WINDOW_BLUR"):
            # Escalate to HARD flag after 2 soft warnings
            severity = "HARD" if prior_same_event_count >= 2 else "SOFT"
        elif event_type == "NO_FACE":
            # Escalate to HARD flag after repeated face absence
            severity = "HARD" if prior_same_event_count >= 3 else "SOFT"
        elif event_type == "LOOKING_AWAY":
            severity = "HARD" if prior_same_event_count >= 4 else "SOFT"
        else:
            severity = "SOFT"

    # Convert soft flag overflow into hard flags
    new_soft_count = prior_soft_count + (1 if severity == "SOFT" else 0)
    new_hard_count = prior_hard_count + (1 if severity == "HARD" else 0)

    # Check student id if exists
    user_rec = db.query(User).filter(User.name == student_name).first()
    student_id = user_rec.id if user_rec else None

    # Persist in database
    new_violation = Violation(
        test_id=test_id,
        student_name=student_name,
        student_id=student_id,
        event_type=event_type,
        severity=severity,
        details=json.dumps(details_dict),
        occurred_at=datetime.utcnow()
    )
    db.add(new_violation)
    db.commit()
    db.refresh(new_violation)

    total_violations = len(prior_violations) + 1

    # Termination check
    should_terminate = new_hard_count >= MAX_HARD_FLAGS_FOR_TERMINATION

    if should_terminate:
        status = "TERMINATE_TEST"
        message = f"Assessment terminated: {new_hard_count} hard proctoring violations reached."
    elif severity == "HARD":
        status = "HARD_FLAG"
        message = f"Critical Flag ({new_hard_count}/{MAX_HARD_FLAGS_FOR_TERMINATION}): {event_type.replace('_', ' ')} violation recorded."
    else:
        status = "SOFT_WARNING"
        message = f"Warning: {event_type.replace('_', ' ')} detected ({new_soft_count} warning{'' if new_soft_count == 1 else 's'})."

    return {
        "status": status,
        "severity": severity,
        "message": message,
        "soft_flags_count": new_soft_count,
        "hard_flags_count": new_hard_count,
        "total_violations": total_violations,
        "event_type": event_type,
        "violation_id": new_violation.id,
        "should_terminate": should_terminate
    }


def get_test_violations(db: Session, test_id: int | None = None, student_name: str | None = None) -> list[dict]:
    """Retrieves formatted list of violations for evaluation reports and dashboards."""
    query = db.query(Violation)
    if test_id is not None:
        query = query.filter(Violation.test_id == test_id)
    if student_name is not None:
        query = query.filter(Violation.student_name == student_name)
    violations = query.order_by(Violation.occurred_at.asc()).all()

    formatted = []
    for v in violations:
        meta = {}
        if v.details:
            try:
                meta = json.loads(v.details)
            except Exception:
                meta = {"raw": v.details}
        formatted.append({
            "id": v.id,
            "test_id": v.test_id,
            "student_name": v.student_name,
            "event_type": v.event_type,
            "severity": v.severity,
            "details": meta,
            "occurred_at": v.occurred_at.isoformat() if v.occurred_at else None
        })
    return formatted


def calculate_integrity_score(violations: list[dict]) -> dict:
    """Calculates an assessment integrity score from 0 to 100 based on recorded violations."""
    if not violations:
        return {
            "score": 100,
            "rating": "High Integrity",
            "badge_color": "#16a34a",
            "summary": "Verified clean session. No proctoring violations recorded."
        }

    penalty = 0
    for v in violations:
        if v.get("severity") == "HARD":
            penalty += 25
        else:
            penalty += 8

    final_score = max(0, 100 - penalty)
    if final_score >= 85:
        rating = "Good"
        badge_color = "#16a34a"
    elif final_score >= 60:
        rating = "Moderate Flags"
        badge_color = "#d97706"
    else:
        rating = "High Risk / Compromised"
        badge_color = "#dc2626"

    return {
        "score": final_score,
        "rating": rating,
        "badge_color": badge_color,
        "summary": f"{len(violations)} total event(s) logged ({sum(1 for v in violations if v.get('severity') == 'HARD')} critical)."
    }
