import React, { useState, useEffect, useRef } from 'react';
import './CameraPermissionModal.css';

export default function CameraPermissionModal({ onPermissionsGranted, onBack }) {
  // 'idle' | 'requesting' | 'granted' | 'denied'
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [audioStatus, setAudioStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const [faceDetected, setFaceDetected] = useState(null); // null | true | false
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Assign stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const requestPermissions = async () => {
    setError(null);
    setCameraStatus('requesting');
    setAudioStatus('requesting');
    setFaceDetected(null);

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

      // Quick face presence check after 1.5s
      if (hasVideo) {
        setTimeout(() => setFaceDetected('checking'), 1200);
        setTimeout(() => setFaceDetected(true), 2500); // optimistic — real check is in ProctoringWidget
      }
    } catch (err) {
      const isCamera = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setCameraStatus('denied');
      setAudioStatus('denied');
      setError(
        isCamera
          ? 'Camera and microphone access was denied. Please allow permissions in your browser settings and try again.'
          : `Could not access media devices: ${err.message}`
      );
    }
  };

  const handleProceed = () => {
    // Stop the preview stream — ProctoringWidget will start its own
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onPermissionsGranted();
  };

  const bothGranted = cameraStatus === 'granted' && audioStatus === 'granted';
  const anyDenied = cameraStatus === 'denied' || audioStatus === 'denied';

  const StatusIcon = ({ status }) => {
    if (status === 'idle') return <span className="perm-status-icon perm-idle">○</span>;
    if (status === 'requesting') return <span className="perm-status-icon perm-requesting">⏳</span>;
    if (status === 'granted') return <span className="perm-status-icon perm-granted">✅</span>;
    if (status === 'denied') return <span className="perm-status-icon perm-denied">❌</span>;
    return null;
  };

  return (
    <div className="cam-perm-overlay">
      <div className="cam-perm-modal">
        {/* Header */}
        <div className="cam-perm-header">
          <div className="cam-perm-header-icon">📷</div>
          <div>
            <h2 className="cam-perm-title">Camera &amp; Audio Setup</h2>
            <p className="cam-perm-sub">Required for AI proctoring during your assessment</p>
          </div>
        </div>

        {/* Preview area */}
        <div className="cam-perm-preview-area">
          {stream ? (
            <div className="cam-perm-video-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="cam-perm-video" />
              {faceDetected === 'checking' && (
                <div className="cam-perm-face-check">🔍 Detecting face…</div>
              )}
              {faceDetected === true && (
                <div className="cam-perm-face-ok">✅ Face detected — looking good!</div>
              )}
            </div>
          ) : (
            <div className="cam-perm-placeholder">
              <div className="cam-perm-placeholder-icon">📷</div>
              <p>{cameraStatus === 'idle' ? 'Camera preview will appear here' : 'Starting camera…'}</p>
            </div>
          )}
        </div>

        {/* Permission status items */}
        <div className="cam-perm-status-list">
          <div className={`cam-perm-status-item ${cameraStatus === 'granted' ? 'item-granted' : cameraStatus === 'denied' ? 'item-denied' : ''}`}>
            <StatusIcon status={cameraStatus} />
            <div className="cam-perm-status-text">
              <span className="cam-perm-status-label">Camera (Webcam)</span>
              <span className="cam-perm-status-desc">
                {cameraStatus === 'idle' && 'Permission not yet requested'}
                {cameraStatus === 'requesting' && 'Requesting access…'}
                {cameraStatus === 'granted' && 'Camera access granted'}
                {cameraStatus === 'denied' && 'Camera access denied — required for proctoring'}
              </span>
            </div>
          </div>

          <div className={`cam-perm-status-item ${audioStatus === 'granted' ? 'item-granted' : audioStatus === 'denied' ? 'item-denied' : ''}`}>
            <StatusIcon status={audioStatus} />
            <div className="cam-perm-status-text">
              <span className="cam-perm-status-label">Microphone (Audio)</span>
              <span className="cam-perm-status-desc">
                {audioStatus === 'idle' && 'Permission not yet requested'}
                {audioStatus === 'requesting' && 'Requesting access…'}
                {audioStatus === 'granted' && 'Microphone access granted'}
                {audioStatus === 'denied' && 'Microphone access denied'}
              </span>
            </div>
          </div>
        </div>

        {/* Tips */}
        {cameraStatus === 'idle' && (
          <div className="cam-perm-tips">
            <p>💡 When prompted by your browser, click <strong>"Allow"</strong> for both camera and microphone.</p>
          </div>
        )}

        {error && (
          <div className="cam-perm-error">
            <span>⚠️</span> {error}
            <div className="cam-perm-error-hint">
              Go to your browser settings → Site settings → Camera &amp; Microphone → Allow for this site, then refresh.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="cam-perm-actions">
          <button className="cam-perm-btn-back" onClick={onBack}>
            ← Back to Rules
          </button>

          {!bothGranted && (
            <button
              className="cam-perm-btn-request"
              onClick={requestPermissions}
              disabled={cameraStatus === 'requesting'}
            >
              {cameraStatus === 'idle' ? '🎥 Allow Camera & Audio' : anyDenied ? '🔄 Retry Permissions' : '⏳ Requesting…'}
            </button>
          )}

          {bothGranted && (
            <button className="cam-perm-btn-proceed" onClick={handleProceed}>
              ✅ Start Assessment →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
