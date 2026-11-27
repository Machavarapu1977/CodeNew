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

  // Stop media tracks helper
  const stopAllTracks = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // Assign stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      stopAllTracks();
    };
  }, [stream]);

  // Real face check against backend API
  const performFaceCheck = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCheckingRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    try {
      isCheckingRef.current = true;
      const canvas = canvasRef.current;
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 320, 240);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.65);

      const res = await fetch('http://127.0.0.1:8000/proctoring/check-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.face_detected && data.face_count === 1) {
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
    setFaceState({ status: 'checking', message: 'Detecting candidate face…', faceCount: 0 });

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = mediaStream;

      const hasVideo = mediaStream.getVideoTracks().length > 0;
      const hasAudio = mediaStream.getAudioTracks().length > 0;

      setCameraStatus(hasVideo ? 'granted' : 'denied');
      setAudioStatus(hasAudio ? 'granted' : 'denied');
      setStream(mediaStream);

      // Start periodic real face checks every 1.5 seconds once video is playing
      if (hasVideo) {
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        // Initial delay for webcam to warm up
        setTimeout(() => {
          performFaceCheck();
          checkIntervalRef.current = setInterval(performFaceCheck, 1500);
        }, 800);
      }
    } catch (err) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setCameraStatus('denied');
      setAudioStatus('denied');
      setFaceState({ status: 'error', message: 'Camera permission denied.', faceCount: 0 });
      setError(
        isDenied
          ? 'Camera and microphone access was denied. Please allow permissions in your browser address bar and try again.'
          : `Could not access media devices: ${err.message}`
      );
    }
  };

  const handleProceed = () => {
    if (!bothGranted || faceState.status !== 'verified') return;
    stopAllTracks();
    onPermissionsGranted();
  };

  const bothGranted = cameraStatus === 'granted' && audioStatus === 'granted';
  const anyDenied = cameraStatus === 'denied' || audioStatus === 'denied';
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

        {/* Video preview container */}
        <div className="cam-perm-preview-area">
          {stream ? (
            <div className="cam-perm-video-wrap">
              <video
                ref={videoRef}
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
          ) : (
            <div className="cam-perm-placeholder">
              <div className="cam-perm-placeholder-icon">📹</div>
              <p className="placeholder-primary">
                {cameraStatus === 'idle' ? 'Camera feed will appear here' : 'Initializing camera stream…'}
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
              {audioStatus === 'granted' ? '✅' : audioStatus === 'denied' ? '❌' : audioStatus === 'requesting' ? '⏳' : '○'}
            </span>
            <div className="cam-perm-status-text">
              <span className="cam-perm-status-label">Microphone Permission</span>
              <span className="cam-perm-status-desc">
                {audioStatus === 'idle' && 'Waiting to request microphone access'}
                {audioStatus === 'requesting' && 'Requesting browser microphone permission…'}
                {audioStatus === 'granted' && 'Microphone input stream ready'}
                {audioStatus === 'denied' && 'Access blocked'}
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
            💡 When prompted by your browser, click <strong>"Allow"</strong> for camera and microphone access.
          </div>
        )}

        {/* Actions bar */}
        <div className="cam-perm-actions">
          <button className="cam-perm-btn-back" onClick={() => { stopAllTracks(); onBack(); }}>
            ← Back to Rules
          </button>

          {!bothGranted ? (
            <button
              className="cam-perm-btn-request"
              onClick={requestPermissions}
              disabled={cameraStatus === 'requesting'}
            >
              {cameraStatus === 'idle' ? '🎥 Allow Camera & Audio' : anyDenied ? '🔄 Retry Permissions' : '⏳ Requesting…'}
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
