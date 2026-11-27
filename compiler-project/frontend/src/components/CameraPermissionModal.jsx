import React, { useState, useEffect, useRef, useCallback } from 'react';
import './CameraPermissionModal.css';

export default function CameraPermissionModal({ onPermissionsGranted, onBack }) {
  // 'idle' | 'requesting' | 'granted' | 'denied'
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [audioStatus, setAudioStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);

  // Face detection state: { status: 'idle'|'checking'|'verified'|'no_face'|'multiple'|'occluded'|'error', message: string, faceCount: number }
  const [faceState, setFaceState] = useState({
    status: 'idle',
    message: 'Camera not active yet.',
    faceCount: 0
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const checkIntervalRef = useRef(null);
  const isCheckingRef = useRef(false);

  // Stop media tracks helper - only when explicitly needed or on unmount
  const stopAllTracks = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Cleanup ONLY on unmount of modal
  useEffect(() => {
    return () => {
      stopAllTracks();
    };
  }, []);

  // Guarantee video element receives stream and plays
  useEffect(() => {
    if (stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(e => console.warn('[CamPerm] Play exception:', e));
    }
  }, [stream]);

  // Real face check against backend API
  const performFaceCheck = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCheckingRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;

    try {
      isCheckingRef.current = true;
      const canvas = canvasRef.current;
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 320, 240);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.65);

      const host = window.location.hostname || '127.0.0.1';
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const res = await fetch(`${protocol}//${host}:8000/proctoring/check-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.face_detected) {
        setFaceState({
          status: 'verified',
          message: 'Face verified — single candidate in frame.',
          faceCount: 1
        });
      } else if (data.proxy_status === 'MULTIPLE_FACES' || data.face_count > 1) {
        setFaceState({
          status: 'multiple',
          message: `Multiple faces detected (${data.face_count}). Only the candidate may appear in view.`,
          faceCount: data.face_count
        });
      } else if (data.proxy_status === 'CAMERA_OCCLUDED') {
        setFaceState({
          status: 'occluded',
          message: 'Camera lens appears occluded, covered, or too dark.',
          faceCount: 0
        });
      } else {
        setFaceState({
          status: 'no_face',
          message: 'No face detected. Please position your face clearly in the camera frame.',
          faceCount: 0
        });
      }
    } catch (err) {
      console.warn('[FaceCheck] Check failed:', err);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const requestPermissions = async () => {
    setError(null);
    setCameraStatus('requesting');
    setAudioStatus('requesting');
    setFaceState({ status: 'checking', message: 'Starting camera…', faceCount: 0 });

    try {
      let mediaStream = null;
      let micGranted = false;

      // 1. Try requesting both camera and audio
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: true,
        });
        micGranted = mediaStream.getAudioTracks().length > 0;
      } catch (bothErr) {
        console.warn('[CamPerm] Both video+audio request failed, falling back to video only:', bothErr);
        // 2. If mic failed or not present, fallback to video-only so proctoring can still work
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });
        micGranted = false;
      }

      streamRef.current = mediaStream;
      const hasVideo = mediaStream.getVideoTracks().length > 0;

      setCameraStatus(hasVideo ? 'granted' : 'denied');
      setAudioStatus(micGranted ? 'granted' : 'denied');
      setStream(mediaStream);

      // Start periodic real face checks every 1.5 seconds
      if (hasVideo) {
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        // Check after initial frame renders
        setTimeout(() => {
          performFaceCheck();
          checkIntervalRef.current = setInterval(performFaceCheck, 1500);
        }, 600);
      }
    } catch (err) {
      console.error('[CamPerm] Camera access failed:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setCameraStatus('denied');
      setAudioStatus('denied');
      setFaceState({ status: 'error', message: 'Camera permission denied.', faceCount: 0 });
      setError(
        isDenied
          ? 'Camera access was denied. Please click the camera icon in your browser address bar to Allow access, then click Retry.'
          : `Could not access media devices: ${err.message}`
      );
    }
  };

  const handleProceed = () => {
    if (cameraStatus !== 'granted' || faceState.status !== 'verified') return;
    stopAllTracks();
    // Allow short 300ms window for browser camera hardware release
    setTimeout(() => {
      onPermissionsGranted();
    }, 300);
  };

  const isCameraReady = cameraStatus === 'granted';
  const isFaceVerified = faceState.status === 'verified';

  return (
    <div className="cam-perm-overlay">
      {/* Hidden canvas for snapshotting frames */}
      <canvas ref={canvasRef} style={{ display: 'none' }} width="320" height="240" />

      <div className="cam-perm-modal">
        {/* Header */}
        <div className="cam-perm-header">
          <div className="cam-perm-header-badge">
            <span className="cam-perm-badge-icon">📷</span>
          </div>
          <div>
            <h2 className="cam-perm-title">Hardware &amp; Face Setup</h2>
            <p className="cam-perm-sub">Required verification before starting your proctored assessment</p>
          </div>
        </div>

        {/* Video preview container - Video is always in DOM to avoid race conditions */}
        <div className="cam-perm-preview-area">
          <div
            className="cam-perm-video-wrap"
            style={{ display: stream ? 'flex' : 'none' }}
          >
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el && stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="cam-perm-video"
              onLoadedMetadata={() => performFaceCheck()}
            />

            {/* Dynamic live status badge on the video */}
            {faceState.status === 'checking' && (
              <div className="cam-perm-face-badge checking">
                <span className="spinner-dot"></span> Scanning for face…
              </div>
            )}
            {faceState.status === 'verified' && (
              <div className="cam-perm-face-badge verified">
                ✅ Face Verified (1 candidate)
              </div>
            )}
            {faceState.status === 'no_face' && (
              <div className="cam-perm-face-badge warning">
                ⚠️ No face detected in frame
              </div>
            )}
            {faceState.status === 'multiple' && (
              <div className="cam-perm-face-badge danger">
                🚨 Multiple faces detected ({faceState.faceCount})
              </div>
            )}
            {faceState.status === 'occluded' && (
              <div className="cam-perm-face-badge danger">
                🚫 Camera occluded or dark
              </div>
            )}
          </div>

          {!stream && (
            <div className="cam-perm-placeholder">
              <div className="cam-perm-placeholder-icon">📹</div>
              <p className="placeholder-primary">
                {cameraStatus === 'requesting' ? 'Initializing camera stream…' : 'Camera feed will appear here'}
              </p>
              <p className="placeholder-sub">Click the button below to allow camera &amp; mic access</p>
            </div>
          )}
        </div>

        {/* Status Checklist */}
        <div className="cam-perm-status-list">
          {/* Camera row */}
          <div className={`cam-perm-status-item ${cameraStatus === 'granted' ? 'item-granted' : cameraStatus === 'denied' ? 'item-denied' : ''}`}>
            <span className="perm-status-icon">
              {cameraStatus === 'granted' ? '✅' : cameraStatus === 'denied' ? '❌' : cameraStatus === 'requesting' ? '⏳' : '○'}
            </span>
            <div className="cam-perm-status-text">
              <span className="cam-perm-status-label">Webcam Permission</span>
              <span className="cam-perm-status-desc">
                {cameraStatus === 'idle' && 'Waiting to request camera access'}
                {cameraStatus === 'requesting' && 'Requesting browser camera permission…'}
                {cameraStatus === 'granted' && 'Webcam connected and capturing'}
                {cameraStatus === 'denied' && 'Access blocked — camera is mandatory for proctoring'}
              </span>
            </div>
          </div>

          {/* Microphone row */}
          <div className={`cam-perm-status-item ${audioStatus === 'granted' ? 'item-granted' : audioStatus === 'denied' ? 'item-denied' : ''}`}>
            <span className="perm-status-icon">
              {audioStatus === 'granted' ? '✅' : audioStatus === 'denied' ? 'ℹ️' : audioStatus === 'requesting' ? '⏳' : '○'}
            </span>
            <div className="cam-perm-status-text">
              <span className="cam-perm-status-label">Microphone Permission</span>
              <span className="cam-perm-status-desc">
                {audioStatus === 'idle' && 'Waiting to request microphone access'}
                {audioStatus === 'requesting' && 'Requesting browser microphone permission…'}
                {audioStatus === 'granted' && 'Microphone connected'}
                {audioStatus === 'denied' && 'Microphone optional or not detected'}
              </span>
            </div>
          </div>

          {/* Face Detection Verification row */}
          <div className={`cam-perm-status-item ${isFaceVerified ? 'item-granted' : faceState.status === 'no_face' || faceState.status === 'multiple' || faceState.status === 'occluded' ? 'item-warning' : ''}`}>
            <span className="perm-status-icon">
              {isFaceVerified ? '✅' : faceState.status === 'no_face' ? '⚠️' : faceState.status === 'multiple' ? '🚨' : faceState.status === 'checking' ? '🔍' : '○'}
            </span>
            <div className="cam-perm-status-text">
              <span className="cam-perm-status-label">AI Face Detection Pre-Check</span>
              <span className="cam-perm-status-desc">
                {faceState.status === 'idle' && 'Starts automatically once camera is allowed'}
                {faceState.status === 'checking' && 'Analyzing camera stream for candidate face…'}
                {faceState.status === 'verified' && 'Single candidate confirmed — ready to begin'}
                {faceState.status === 'no_face' && 'No face visible. Center your face directly in front of the lens.'}
                {faceState.status === 'multiple' && `Warning: ${faceState.faceCount} faces detected. Candidate must be alone.`}
                {faceState.status === 'occluded' && 'Camera is blocked, covered, or too dim.'}
              </span>
            </div>
          </div>
        </div>

        {/* Error message if denied */}
        {error && (
          <div className="cam-perm-error">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <strong>Permission Required:</strong> {error}
            </div>
          </div>
        )}

        {/* Helper tip */}
        {cameraStatus === 'idle' && (
          <div className="cam-perm-tips">
            💡 When prompted by your browser, click <strong>"Allow"</strong> for camera access.
          </div>
        )}

        {/* Actions bar */}
        <div className="cam-perm-actions">
          <button className="cam-perm-btn-back" onClick={() => { stopAllTracks(); onBack(); }}>
            ← Back to Rules
          </button>

          {!isCameraReady ? (
            <button
              className="cam-perm-btn-request"
              onClick={requestPermissions}
              disabled={cameraStatus === 'requesting'}
            >
              {cameraStatus === 'idle' ? '🎥 Allow Camera & Audio' : cameraStatus === 'denied' ? '🔄 Retry Camera Access' : '⏳ Requesting…'}
            </button>
          ) : isFaceVerified ? (
            <button className="cam-perm-btn-proceed verified" onClick={handleProceed}>
              Start Assessment →
            </button>
          ) : (
            <button
              className="cam-perm-btn-proceed disabled"
              disabled
              title="Position your face clearly in the camera frame to proceed"
            >
              ⚠️ Face Required to Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
