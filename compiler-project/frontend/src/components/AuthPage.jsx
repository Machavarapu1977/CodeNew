import React, { useState, useEffect } from 'react';
import './AuthPage.css';

const API_BASE = 'http://127.0.0.1:8000';

// Google Client ID — replace with your actual Google OAuth client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function AuthPage({ onLoginSuccess }) {
  // 'instructor' | 'student'
  const [selectedRole, setSelectedRole] = useState(null);
  // 'login' | 'register'
  const [authMode, setAuthMode] = useState('login');

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch (_) {} };
  }, []);

  // Initialize Google Sign-In button after role is picked
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !selectedRole) return;
    const tryInit = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large', width: 320, text: 'continue_with' }
        );
      } else {
        setTimeout(tryInit, 400);
      }
    };
    tryInit();
  }, [selectedRole, authMode]);

  const handleGoogleCredential = async (response) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential, role: capitalize(selectedRole) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google sign-in failed.');
      if (onLoginSuccess) onLoginSuccess(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (authMode === 'register') {
      if (!form.name.trim()) return setError('Full name is required.');
      if (form.password.length < 6) return setError('Password must be at least 6 characters.');
      if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    }
    if (!form.email.trim()) return setError('Email is required.');
    if (!form.password) return setError('Password is required.');

    setLoading(true);
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const body = authMode === 'register'
        ? { name: form.name.trim(), email: form.email.trim(), password: form.password, role: capitalize(selectedRole) }
        : { email: form.email.trim(), password: form.password, role: capitalize(selectedRole) };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authentication failed.');
      if (onLoginSuccess) onLoginSuccess(data.access_token, data.user);
    } catch (err) {
      setError(err.message || 'Unable to reach server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const switchMode = () => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setError(null); setSuccess(null); };

  // ── Step 1: Role picker ──────────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div className="auth-page">
        <div className="auth-bg-orb auth-orb-1" />
        <div className="auth-bg-orb auth-orb-2" />
        <div className="auth-bg-orb auth-orb-3" />

        <div className="auth-role-picker">
          <div className="auth-brand">
            <div className="auth-brand-icon">⚡</div>
            <h1 className="auth-brand-name">MockTest AI</h1>
            <p className="auth-brand-sub">AI-Powered Competitive Programming Platform</p>
          </div>

          <h2 className="auth-role-heading">Select your role to continue</h2>
          <div className="auth-role-cards">
            <button className="auth-role-card auth-role-instructor" onClick={() => setSelectedRole('instructor')}>
              <div className="auth-role-card-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  <path d="M16 3h5v8h-5z" /><path d="M16 11l4 4" />
                </svg>
              </div>
              <div className="auth-role-card-text">
                <span className="auth-role-card-title">Instructor</span>
                <span className="auth-role-card-desc">Create tests, manage questions &amp; view results</span>
              </div>
              <span className="auth-role-card-arrow">→</span>
            </button>

            <button className="auth-role-card auth-role-student" onClick={() => setSelectedRole('student')}>
              <div className="auth-role-card-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <div className="auth-role-card-text">
                <span className="auth-role-card-title">Student</span>
                <span className="auth-role-card-desc">Take AI-proctored mock tests &amp; track progress</span>
              </div>
              <span className="auth-role-card-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Login / Register form ────────────────────────────────────────
  const isInstructor = selectedRole === 'instructor';
  const accentClass = isInstructor ? 'accent-instructor' : 'accent-student';

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-orb-1" />
      <div className="auth-bg-orb auth-orb-2" />
      <div className="auth-bg-orb auth-orb-3" />

      <div className={`auth-card ${accentClass}`}>
        {/* Back button */}
        <button className="auth-back-btn" onClick={() => { setSelectedRole(null); setError(null); }}>
          ← Back
        </button>

        {/* Header */}
        <div className="auth-card-header">
          <div className={`auth-card-icon ${accentClass}`}>
            {isInstructor ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <path d="M16 3h5v8h-5z" /><path d="M16 11l4 4" />
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            )}
          </div>
          <h2 className="auth-card-title">
            {authMode === 'login' ? `${capitalize(selectedRole)} Login` : `Create ${capitalize(selectedRole)} Account`}
          </h2>
          <p className="auth-card-sub">
            {authMode === 'login'
              ? `Welcome back! Sign in to your ${selectedRole} account.`
              : `Join MockTest AI as a ${selectedRole}.`}
          </p>
        </div>

        {/* Error / Success banners */}
        {error && (
          <div className="auth-banner auth-banner-error">
            <span>⚠️</span> {error}
          </div>
        )}
        {success && (
          <div className="auth-banner auth-banner-success">
            <span>✅</span> {success}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
          {authMode === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Alex Morgan"
                  value={form.name}
                  onChange={updateForm('name')}
                  autoComplete="name"
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrap">
              <svg className="auth-input-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={updateForm('email')}
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <svg className="auth-input-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder={authMode === 'register' ? 'Min 6 characters' : 'Your password'}
                value={form.password}
                onChange={updateForm('password')}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={updateForm('confirmPassword')}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <button type="submit" className={`auth-submit-btn ${accentClass}`} disabled={loading}>
            {loading
              ? <span className="auth-spinner" />
              : authMode === 'login' ? `Sign in as ${capitalize(selectedRole)}` : `Create Account`}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">or continue with</span>
          <span className="auth-divider-line" />
        </div>

        {/* Google Sign-In button */}
        {GOOGLE_CLIENT_ID ? (
          <div className="auth-google-wrap">
            <div id="google-signin-btn" />
          </div>
        ) : (
          <button
            type="button"
            className="auth-google-btn"
            disabled
            title="Configure VITE_GOOGLE_CLIENT_ID to enable Google sign-in"
          >
            <GoogleIcon />
            Continue with Google
            <span className="auth-google-badge">Configure Client ID</span>
          </button>
        )}

        {/* Switch mode */}
        <div className="auth-switch">
          {authMode === 'login' ? (
            <>Don't have an account? <button className="auth-switch-link" onClick={switchMode}>Sign up</button></>
          ) : (
            <>Already have an account? <button className="auth-switch-link" onClick={switchMode}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.5 2.7 13.5l7.9 6.1C12.5 13.5 17.8 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.4l7.6 5.9C43.5 37.8 46.5 31.6 46.5 24.5z"/>
      <path fill="#FBBC05" d="M10.6 28.4c-.6-1.6-.9-3.3-.9-5.1s.3-3.5.9-5.1l-7.9-6.1C1 15.3 0 19.5 0 24s1 8.7 2.7 12.4l7.9-8z"/>
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.3-4.6 2.1-7.6 2.1-6.2 0-11.5-4-13.4-9.5l-7.9 6.1C6.7 42.5 14.7 48 24 48z"/>
    </svg>
  );
}
