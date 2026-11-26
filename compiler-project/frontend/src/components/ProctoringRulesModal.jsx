import React, { useState } from 'react';
import './ProctoringRulesModal.css';

const RULES = [
  {
    icon: '📷',
    title: 'Camera Required',
    desc: 'Your webcam must remain active for the entire duration of the test. Covering or blocking the camera will result in an immediate flag.',
    severity: 'hard',
  },
  {
    icon: '🧑',
    title: 'Single Candidate Only',
    desc: 'Only one person may appear in the camera frame. Any additional faces detected will be treated as a proxy attempt and may terminate your test.',
    severity: 'hard',
  },
  {
    icon: '🖥️',
    title: 'No Tab Switching',
    desc: 'Switching browser tabs or minimizing the window is monitored. Repeated tab switches will escalate to a hard flag.',
    severity: 'soft',
  },
  {
    icon: '📋',
    title: 'No Large Pastes',
    desc: 'Pasting large amounts of text (50+ characters) into the editor is logged. Submitting externally sourced code is a violation.',
    severity: 'soft',
  },
  {
    icon: '🖥️',
    title: 'No Multiple Displays',
    desc: 'Using an extended or secondary monitor is detected automatically and logged as a hard flag.',
    severity: 'hard',
  },
  {
    icon: '🛠️',
    title: 'No Developer Tools',
    desc: 'Attempting to open browser DevTools (F12, Ctrl+Shift+I, etc.) or view page source is monitored and logged.',
    severity: 'soft',
  },
  {
    icon: '👀',
    title: 'Stay Facing the Screen',
    desc: 'Looking away from your screen for extended periods is detected by the AI camera. Remain focused on your assessment.',
    severity: 'soft',
  },
  {
    icon: '🚨',
    title: 'Termination Policy',
    desc: '3 hard flags will automatically terminate your test and submit your current progress. Soft flags escalate after repeated violations.',
    severity: 'info',
  },
];

export default function ProctoringRulesModal({ testInfo, studentName, onAccept, onBack }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="rules-overlay">
      <div className="rules-modal">
        {/* Header */}
        <div className="rules-header">
          <div className="rules-header-left">
            <div className="rules-shield-icon">🛡️</div>
            <div>
              <h2 className="rules-title">AI Proctoring Rules</h2>
              <p className="rules-subtitle">
                {testInfo?.title || 'Mock Assessment'} · {testInfo?.duration_minutes || 45} min
              </p>
            </div>
          </div>
          <div className="rules-student-chip">
            <span>👤</span> {studentName || 'Student'}
          </div>
        </div>

        {/* Alert banner */}
        <div className="rules-alert-banner">
          <span>⚠️</span>
          <p>
            This test is monitored by an AI proctoring agent in real-time.
            By proceeding, you agree to these rules and consent to camera &amp; audio access.
          </p>
        </div>

        {/* Rules grid */}
        <div className="rules-grid">
          {RULES.map((rule, i) => (
            <div key={i} className={`rules-card rules-card-${rule.severity}`}>
              <div className="rules-card-icon">{rule.icon}</div>
              <div className="rules-card-body">
                <div className="rules-card-title">
                  {rule.title}
                  <span className={`rules-sev-badge rules-sev-${rule.severity}`}>
                    {rule.severity === 'hard' ? 'Hard Flag' : rule.severity === 'soft' ? 'Soft Flag' : 'Policy'}
                  </span>
                </div>
                <div className="rules-card-desc">{rule.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Flag thresholds */}
        <div className="rules-thresholds">
          <div className="rules-threshold-item rules-threshold-soft">
            <span className="rules-threshold-num">3</span>
            <span className="rules-threshold-label">Soft flags escalate to Hard</span>
          </div>
          <div className="rules-threshold-sep">→</div>
          <div className="rules-threshold-item rules-threshold-hard">
            <span className="rules-threshold-num">3</span>
            <span className="rules-threshold-label">Hard flags = Auto termination</span>
          </div>
        </div>

        {/* Agreement checkbox */}
        <label className="rules-agree-label">
          <input
            type="checkbox"
            className="rules-agree-check"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I have read and understand all proctoring rules. I agree to the monitoring of my activity and camera feed for this assessment.
          </span>
        </label>

        {/* Footer buttons */}
        <div className="rules-footer">
          <button className="rules-btn-back" onClick={onBack}>
            ← Go Back
          </button>
          <button
            className="rules-btn-proceed"
            disabled={!agreed}
            onClick={onAccept}
          >
            🛡️ Accept &amp; Continue to Camera Setup
          </button>
        </div>
      </div>
    </div>
  );
}
