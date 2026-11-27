import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ProctoringWidget.css';

export default function ProctoringWidget({
  testId,
  studentName,
  onViolationOccurred,
  onTerminateTest,
  isExamFinished
}) {
  // Connection and proctoring state
  const [isConnected, setIsConnected] = useState(false);
  const [softFlags, setSoftFlags] = useState(0);
  const [hardFlags, setHardFlags] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [proxyStatus, setProxyStatus] = useState('STANDBY');
  const [faceCount, setFaceCount] = useState(0);
  const [isWidgetCollapsed, setIsWidgetCollapsed] = useState(false);
  const [isViolationModalOpen, setIsViolationModalOpen] = useState(false);
  const [violationsHistory, setViolationsHistory] = useState([]);
  // Adaptive frame rate: slow down when no violations, speed up after a flag
  const [frameInterval, setFrameInterval] = useState(2500);

  const wsRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const alertTimeoutRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Determine WebSocket URL
  const getWsUrl = () => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = loc.hostname || '127.0.0.1';
    return `${protocol}//${host}:8000/ws/proctoring/${testId || 1}`;
  };

  // Helper to send telemetry safely
  const sendTelemetry = useCallback((type, details = {}, image = null) => {
    if (isExamFinished) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        test_id: testId || 1,
        student_name: studentName || 'Student',
        details,
        image,
        timestamp: Date.now()
      }));
    }
  }, [isExamFinished, testId, studentName]);

  // Display toast alert for violations
  const triggerAlert = (data) => {
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setActiveAlert(data);
    alertTimeoutRef.current = setTimeout(() => {
      setActiveAlert(null);
    }, 4500);
  };

  // ── WebSocket with exponential-backoff auto-reconnect ──────────────────────
  const connectWebSocket = useCallback(() => {
    if (isExamFinished) return;
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // reset on success
      console.log('[Proctoring Agent] WebSocket connected.');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'CONNECTED' || data.status === 'PONG') return;

        if (data.proxy_status) {
          setProxyStatus(data.proxy_status);
          if (data.face_count !== undefined) setFaceCount(data.face_count);
        }

        if (data.soft_flags_count !== undefined) setSoftFlags(data.soft_flags_count);
        if (data.hard_flags_count !== undefined) setHardFlags(data.hard_flags_count);
        if (data.total_violations !== undefined) setTotalViolations(data.total_violations);

        // Record into history
        if (data.event_type) {
          setViolationsHistory(prev => [
            {
              id: Date.now(),
              type: data.event_type,
              severity: data.severity,
              message: data.message,
              time: new Date().toLocaleTimeString()
            },
            ...prev
          ]);
          // Speed up frame capture after a flag for 30 seconds
          if (data.status === 'HARD_FLAG' || data.status === 'SOFT_WARNING') {
            setFrameInterval(1200);
            setTimeout(() => setFrameInterval(2500), 30000);
          }
        }

        // Handle warnings and penalties
        if (data.status === 'SOFT_WARNING' || data.status === 'HARD_FLAG') {
          triggerAlert(data);
          if (onViolationOccurred) onViolationOccurred(data);
        } else if (data.status === 'TERMINATE_TEST' || data.should_terminate) {
          triggerAlert(data);
          if (onTerminateTest) {
            setTimeout(() => {
              onTerminateTest(data.message || 'Exam terminated due to proctoring violations.');
            }, 1200);
          }
        }
      } catch (err) {
        console.error('[Proctoring Agent] Error parsing message:', err);
      }
    };

    ws.onerror = () => setIsConnected(false);

    ws.onclose = () => {
      setIsConnected(false);
      if (isExamFinished) return;
      // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
      const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;
      console.log(`[Proctoring Agent] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current})…`);
      reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
    };
  }, [isExamFinished, testId, studentName]);

  // 1. Initialize WebSocket Connection
  useEffect(() => {
    if (isExamFinished) return;
    connectWebSocket();

    // Heartbeat every 20s (kept separate so it uses fresh ws ref)
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() }));
      }
    }, 20000);

    return () => {
      clearInterval(heartbeat);
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    };
  }, [testId, studentName, isExamFinished, connectWebSocket]);

  // 2. Set up DOM Event Listeners for Tab Switch, Defocus, Paste, Multi-Display,
  //    Right-click, and DevTools keyboard shortcuts
  useEffect(() => {
    if (isExamFinished) return;

    let pasteThrottle = false;

    // A. Tab switch tracking via visibilitychange
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendTelemetry('TAB_SWITCH', {
          description: 'Candidate switched away from the assessment browser tab.'
        });
      }
    };

    // B. Window blur tracking (losing focus, Alt+Tab, splitting screens)
    const handleWindowBlur = () => {
      sendTelemetry('WINDOW_BLUR', {
        description: 'Candidate browser window lost active focus.'
      });
    };

    // C. Large clipboard paste tracking
    const handlePaste = (e) => {
      if (pasteThrottle) return;
      pasteThrottle = true;
      setTimeout(() => { pasteThrottle = false; }, 800);

      const clipboardData = e.clipboardData || window.clipboardData;
      const text = clipboardData ? clipboardData.getData('text') : '';
      if (text && text.length >= 50) {
        sendTelemetry('LARGE_PASTE', {
          length: text.length,
          snippet: text.slice(0, 100),
          description: `Large clipboard paste detected (${text.length} characters).`
        });
      }
    };

    // D. Multi-display / extended desktop detection
    const checkMultiDisplay = () => {
      let isExtended = false;
      let details = {};

      if ('isExtended' in window.screen && window.screen.isExtended) {
        isExtended = true;
        details = { isExtended: true, method: 'Screen.isExtended API' };
      } else if (window.screen.availWidth > window.screen.width * 1.25) {
        isExtended = true;
        details = {
          availWidth: window.screen.availWidth,
          screenWidth: window.screen.width,
          method: 'Coordinate anomaly'
        };
      }

      if (isExtended) {
        sendTelemetry('MULTI_DISPLAY', {
          ...details,
          description: 'Multiple displays or extended monitor detected.'
        });
      }
    };

    // E. Right-click context menu suppression + logging
    const handleContextMenu = (e) => {
      e.preventDefault();
      sendTelemetry('RIGHT_CLICK', {
        description: 'Candidate attempted to open context menu (right-click).',
        x: e.clientX,
        y: e.clientY
      });
    };

    // F. DevTools / view-source keyboard shortcuts detection
    const handleKeyDown = (e) => {
      const isDevTools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === 'U') ||  // View Source
        (e.metaKey && e.altKey && e.key.toUpperCase() === 'I'); // Mac DevTools

      if (isDevTools) {
        e.preventDefault();
        sendTelemetry('DEVTOOLS_ATTEMPT', {
          key: e.key,
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          meta: e.metaKey,
          description: `Developer tools keyboard shortcut detected: ${e.key}`
        });
      }

      // Print screen attempt
      if (e.key === 'PrintScreen') {
        sendTelemetry('SCREENSHOT_ATTEMPT', {
          description: 'Print Screen key pressed during assessment.'
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);

    // Initial multi-display check and periodic listener
    checkMultiDisplay();
    const multiDisplayInterval = setInterval(checkMultiDisplay, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      clearInterval(multiDisplayInterval);
    };
  }, [isExamFinished, sendTelemetry]);

  // 3. Camera Option & Periodic Proxy Analysis Loop
  const startCamera = async (retries = 3) => {
    setCameraError(null);
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        });
        streamRef.current = stream;
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
        setProxyStatus('STANDBY');
        return;
      } catch (err) {
        console.warn(`[Proctoring Agent] Camera attempt ${attempt} error:`, err);
        if (attempt < retries) {
          // Wait 600ms for camera device to be released by any prior component
          await new Promise(r => setTimeout(r, 600));
        } else {
          console.error('[Proctoring Agent] Camera access failed after retries:', err);
          setCameraError(err.message || 'Camera access denied or device in use.');
          setIsCameraActive(false);
          setProxyStatus('CAMERA_DISABLED');
        }
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setProxyStatus('STANDBY');
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  // Start camera on mount by default for proctoring
  useEffect(() => {
    startCamera(3);
    return () => stopCamera();
  }, []);

  // Guarantee video element srcObject is synced
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      videoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, [cameraStream, isCameraActive]);

  // Frame capture loop for proxy & face detection (every 2.5 seconds)
  useEffect(() => {
    if (!isCameraActive || isExamFinished) {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      return;
    }

    frameIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);

      // Extract low-overhead JPEG base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      sendTelemetry('CAMERA_FRAME', {
        timestamp: Date.now()
      }, dataUrl);
    }, 2500);

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [isCameraActive, isExamFinished]);

  // Status Badge UI helper
  const renderStatusBadge = () => {
    switch (proxyStatus) {
      case 'VERIFIED_SINGLE_FACE':
        return <span className="proctor-badge badge-green">🟢 Face Verified (1)</span>;
      case 'MULTIPLE_FACES':
        return <span className="proctor-badge badge-red">🚨 Multiple Faces Detected!</span>;
      case 'NO_FACE':
        return <span className="proctor-badge badge-yellow">⚠️ No Face in View</span>;
      case 'LOOKING_AWAY':
        return <span className="proctor-badge badge-yellow">👀 Face Looking Away</span>;
      case 'CAMERA_OCCLUDED':
        return <span className="proctor-badge badge-red">🚫 Camera Blocked</span>;
      case 'CAMERA_DISABLED':
        return <span className="proctor-badge badge-gray">⚪ Camera Off</span>;
      default:
        return <span className="proctor-badge badge-blue">🔵 Monitoring Active</span>;
    }
  };

  return (
    <>
      {/* ── Real-time Violation Toast Alert ── */}
      {activeAlert && (
        <div className={`proctor-alert-toast ${activeAlert.severity === 'HARD' ? 'alert-hard' : 'alert-soft'}`}>
          <div className="alert-toast-icon">
            {activeAlert.severity === 'HARD' ? '🚨' : '⚠️'}
          </div>
          <div className="alert-toast-content">
            <div className="alert-toast-title">
              {activeAlert.severity === 'HARD' ? 'Critical Proctoring Flag' : 'Proctoring Warning'}
            </div>
            <div className="alert-toast-message">{activeAlert.message}</div>
          </div>
          <button className="alert-toast-close" onClick={() => setActiveAlert(null)}>✕</button>
        </div>
      )}

      {/* ── Floating Proctoring PIP Camera Widget ── */}
      <div className={`proctoring-pip-widget ${isWidgetCollapsed ? 'collapsed' : ''}`}>
        {/* Widget Header */}
        <div className="pip-header" onClick={() => setIsWidgetCollapsed(prev => !prev)}>
          <div className="pip-header-left">
            <span className="pip-pulse-dot" />
            <span className="pip-title">AI Proctor</span>
            {renderStatusBadge()}
          </div>
          <div className="pip-header-right">
            <button
              className="pip-violations-pill"
              onClick={(e) => {
                e.stopPropagation();
                setIsViolationModalOpen(true);
              }}
              title="Click to view violation log"
            >
              Flags: {hardFlags > 0 ? `🚨 ${hardFlags} Hard` : `⚠️ ${softFlags} Soft`}
            </button>
            <span className="pip-collapse-icon">
              {isWidgetCollapsed ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {/* Widget Body */}
        {!isWidgetCollapsed && (
          <div className="pip-body">
            <div className="pip-video-wrapper">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && cameraStream && el.srcObject !== cameraStream) {
                    el.srcObject = cameraStream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="pip-video-feed"
                style={{ display: isCameraActive ? 'block' : 'none' }}
              />

              {!isCameraActive && (
                <div className="pip-camera-placeholder">
                  {cameraError ? (
                    <div className="camera-err-msg">
                      <span>📷</span>
                      <p>{cameraError}</p>
                      <button className="camera-retry-btn" onClick={() => startCamera(3)}>Retry Camera</button>
                    </div>
                  ) : (
                    <div className="camera-off-msg">
                      <span>📷</span>
                      <p>Camera is disabled.</p>
                      <button className="camera-retry-btn" onClick={() => startCamera(3)}>Enable Camera</button>
                    </div>
                  )}
                </div>
              )}

              {/* Status overlay bar */}
              <div className="pip-overlay-bar">
                <span>{isConnected ? '⚡ Stream Live' : '🔄 Connecting...'}</span>
                {isCameraActive && (
                  <button
                    className="pip-cam-toggle-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      stopCamera();
                    }}
                    title="Turn camera off"
                  >
                    Mute Cam
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="pip-metrics-row">
              <div className="pip-metric-item">
                <span className="metric-label">Tab Switches</span>
                <span className="metric-value">
                  {violationsHistory.filter(v => v.type === 'TAB_SWITCH').length}
                </span>
              </div>
              <div className="pip-metric-item">
                <span className="metric-label">Defocus</span>
                <span className="metric-value">
                  {violationsHistory.filter(v => v.type === 'WINDOW_BLUR').length}
                </span>
              </div>
              <div className="pip-metric-item">
                <span className="metric-label">Pastes</span>
                <span className="metric-value">
                  {violationsHistory.filter(v => v.type === 'LARGE_PASTE').length}
                </span>
              </div>
              <div className="pip-metric-item">
                <span className="metric-label">Faces</span>
                <span className="metric-value" style={{ color: faceCount > 1 ? '#dc2626' : (faceCount === 0 ? '#d97706' : '#16a34a') }}>
                  {faceCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hidden canvas for frame extraction */}
        <canvas ref={canvasRef} style={{ display: 'none' }} width={320} height={240} />
      </div>

      {/* ── Violations Log Modal ── */}
      {isViolationModalOpen && (
        <div className="proctor-modal-overlay" onClick={() => setIsViolationModalOpen(false)}>
          <div className="proctor-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="proctor-modal-header">
              <div className="proctor-modal-title">
                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                <h3>Assessment Proctoring Log</h3>
              </div>
              <button className="proctor-modal-close" onClick={() => setIsViolationModalOpen(false)}>✕</button>
            </div>

            <div className="proctor-modal-summary">
              <div className="proctor-sum-box">
                <span className="sum-label">Soft Warnings</span>
                <span className="sum-val" style={{ color: '#d97706' }}>{softFlags} / 3</span>
              </div>
              <div className="proctor-sum-box">
                <span className="sum-label">Hard Flags</span>
                <span className="sum-val" style={{ color: '#dc2626' }}>{hardFlags} / 3</span>
              </div>
              <div className="proctor-sum-box">
                <span className="sum-label">Total Events</span>
                <span className="sum-val">{totalViolations}</span>
              </div>
            </div>

            <div className="proctor-modal-list">
              {violationsHistory.length === 0 ? (
                <div className="proctor-empty-state">
                  <span>✅</span>
                  <p>No proctoring violations recorded. Clean session!</p>
                </div>
              ) : (
                violationsHistory.map((item, idx) => (
                  <div key={idx} className={`violation-log-item ${item.severity === 'HARD' ? 'item-hard' : 'item-soft'}`}>
                    <div className="vlog-top">
                      <span className="vlog-badge">{item.type.replace('_', ' ')}</span>
                      <span className={`vlog-sev ${item.severity === 'HARD' ? 'sev-hard' : 'sev-soft'}`}>
                        {item.severity} FLAG
                      </span>
                      <span className="vlog-time">{item.time}</span>
                    </div>
                    <div className="vlog-msg">{item.message}</div>
                  </div>
                ))
              )}
            </div>

            <div className="proctor-modal-footer">
              <button className="proctor-btn-done" onClick={() => setIsViolationModalOpen(false)}>
                Return to Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
