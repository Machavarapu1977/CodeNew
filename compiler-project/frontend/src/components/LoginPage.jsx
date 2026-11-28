import React, { useState, useEffect } from 'react'
import './LoginPage.css'

const API_BASE = 'http://127.0.0.1:8000'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function LoginPage({ onLoginSuccess }) {
  // Instructor form state
  const [instructorMode, setInstructorMode] = useState('login') // 'login' | 'signup'
  const [instructorName, setInstructorName] = useState('')
  const [instructorEmail, setInstructorEmail] = useState('')
  const [instructorPassword, setInstructorPassword] = useState('')
  const [instructorConfirmPassword, setInstructorConfirmPassword] = useState('')
  const [instructorShowPassword, setInstructorShowPassword] = useState(false)
  const [instructorLoading, setInstructorLoading] = useState(false)

  // Student form state
  const [studentMode, setStudentMode] = useState('login') // 'login' | 'signup'
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentConfirmPassword, setStudentConfirmPassword] = useState('')
  const [studentShowPassword, setStudentShowPassword] = useState(false)
  const [studentLoading, setStudentLoading] = useState(false)

  // Google OAuth modal state
  const [googleModalRole, setGoogleModalRole] = useState(null) // null | 'Instructor' | 'Student'
  const [customGoogleEmail, setCustomGoogleEmail] = useState('')
  const [customGoogleName, setCustomGoogleName] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  // Common notification / error state
  const [error, setError] = useState(null)

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
    return () => {
      try { document.body.removeChild(script) } catch (_) {}
    }
  }, [])

  // Standard email + password handler (login or register)
  const handleAuthSubmit = async (e, role) => {
    e.preventDefault()
    setError(null)

    const isInstructor = role === 'Instructor'
    const mode = isInstructor ? instructorMode : studentMode
    const name = isInstructor ? instructorName : studentName
    const email = isInstructor ? instructorEmail : studentEmail
    const password = isInstructor ? instructorPassword : studentPassword
    const confirmPassword = isInstructor ? instructorConfirmPassword : studentConfirmPassword
    const setLoading = isInstructor ? setInstructorLoading : setStudentLoading

    if (!email.trim()) {
      setError(`Please enter your email for ${role} ${mode === 'login' ? 'login' : 'sign up'}.`)
      return
    }

    if (!password) {
      setError(`Please enter your password for ${role} ${mode === 'login' ? 'login' : 'sign up'}.`)
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError(`Please enter your full name for ${role} registration.`)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your password.')
        return
      }
    }

    setLoading(true)
    try {
      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login'
      const payload = mode === 'signup'
        ? { name: name.trim(), email: email.trim(), password, role }
        : { email: email.trim(), password, role }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || `${mode === 'login' ? 'Login' : 'Registration'} failed.`)
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.access_token, { ...data.user, role })
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message || 'Unable to reach backend server. Please verify backend is running.')
    } finally {
      setLoading(false)
    }
  }

  // Google Sign-In Execution
  const executeGoogleAuth = async (googleUser, role) => {
    setError(null)
    setGoogleLoading(true)

    try {
      // Send credential to backend /auth/google
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: JSON.stringify(googleUser),
          role: role
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Google sign-in failed.')
      }

      setGoogleModalRole(null)
      if (onLoginSuccess) {
        onLoginSuccess(data.access_token, { ...data.user, role })
      }
    } catch (err) {
      console.error('Google auth error:', err)
      setError(err.message || 'Google authentication failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  // Click handler for Continue with Google
  const handleGoogleClick = (role) => {
    setError(null)
    // If real GSI client ID is present and initialized, try native prompt first
    if (GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp) => {
            if (resp.credential) {
              await executeGoogleAuth({ credential: resp.credential, role }, role)
            }
          }
        })
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to interactive Google dialog
            setGoogleModalRole(role)
          }
        })
        return
      } catch (err) {
        console.warn('GSI prompt fallback:', err)
      }
    }

    // Interactive Google OAuth Dialog
    setGoogleModalRole(role)
  }

  return (
    <div className="login-page-container">
      {/* Background Decorative Accents */}
      <div className="bg-decor-circle-left" />
      <div className="bg-decor-circle-right" />
      <div className="bg-dots-pattern dots-top-left" />
      <div className="bg-dots-pattern dots-top-right" />

      {/* Main Card */}
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <h1>Welcome to MockTest AI</h1>
          <p>Sign in or register to access the AI-powered testing and compiler platform</p>
        </div>

        {error && (
          <div className="error-toast">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Roles Grid: Side-by-Side Layout */}
        <div className="login-roles-grid">
          {/* ── Left Column: Instructor Card ── */}
          <div className="role-card instructor-card">
            <div className="icon-badge instructor-icon-badge">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <path d="M16 3h5v8h-5z" />
                <path d="M16 11l4 4" />
              </svg>
            </div>

            <h2 className="role-title">Instructor</h2>
            <p className="role-description">
              Create and manage questions, tests, and track student performance.
            </p>

            {/* Auth Mode Toggle Pill */}
            <div className="auth-mode-toggle">
              <button
                type="button"
                className={`auth-mode-btn ${instructorMode === 'login' ? 'active' : ''}`}
                onClick={() => { setInstructorMode('login'); setError(null); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-mode-btn ${instructorMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setInstructorMode('signup'); setError(null); }}
              >
                Sign Up
              </button>
            </div>

            <form
              className="role-form"
              onSubmit={(e) => handleAuthSubmit(e, 'Instructor')}
            >
              {instructorMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    className="role-input"
                    placeholder="Full Name"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    disabled={instructorLoading || studentLoading}
                  />
                </div>
              )}

              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <input
                  type="email"
                  className="role-input"
                  placeholder="Email Address"
                  value={instructorEmail}
                  onChange={(e) => setInstructorEmail(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
              </div>

              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={instructorShowPassword ? 'text' : 'password'}
                  className="role-input"
                  placeholder={instructorMode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
                  value={instructorPassword}
                  onChange={(e) => setInstructorPassword(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setInstructorShowPassword(v => !v)}
                  tabIndex={-1}
                  title={instructorShowPassword ? 'Hide password' : 'Show password'}
                >
                  {instructorShowPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {instructorMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type={instructorShowPassword ? 'text' : 'password'}
                    className="role-input"
                    placeholder="Confirm Password"
                    value={instructorConfirmPassword}
                    onChange={(e) => setInstructorConfirmPassword(e.target.value)}
                    disabled={instructorLoading || studentLoading}
                  />
                </div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={instructorLoading || studentLoading}
              >
                {instructorLoading ? (
                  <div className="spinner" />
                ) : instructorMode === 'login' ? (
                  'Sign In as Instructor'
                ) : (
                  'Create Instructor Account'
                )}
              </button>
            </form>

            {/* Google Divider */}
            <div className="card-or-divider">
              <span className="card-or-line" />
              <span className="card-or-text">or</span>
              <span className="card-or-line" />
            </div>

            {/* Continue with Google */}
            <button
              type="button"
              className="google-signin-btn"
              onClick={() => handleGoogleClick('Instructor')}
              disabled={instructorLoading || studentLoading || googleLoading}
            >
              <GoogleSvgIcon />
              <span>Continue with Google</span>
            </button>
          </div>

          {/* ── Middle Divider ── */}
          <div className="divider-container">
            <div className="divider-line" />
            <div className="or-badge">OR</div>
          </div>

          {/* ── Right Column: Student Card ── */}
          <div className="role-card student-card">
            <div className="icon-badge student-icon-badge">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>

            <h2 className="role-title">Student</h2>
            <p className="role-description">
              Take mock tests, solve problems, and track your progress.
            </p>

            {/* Auth Mode Toggle Pill */}
            <div className="auth-mode-toggle">
              <button
                type="button"
                className={`auth-mode-btn ${studentMode === 'login' ? 'active' : ''}`}
                onClick={() => { setStudentMode('login'); setError(null); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-mode-btn ${studentMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setStudentMode('signup'); setError(null); }}
              >
                Sign Up
              </button>
            </div>

            <form
              className="role-form"
              onSubmit={(e) => handleAuthSubmit(e, 'Student')}
            >
              {studentMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    className="role-input"
                    placeholder="Full Name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    disabled={instructorLoading || studentLoading}
                  />
                </div>
              )}

              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <input
                  type="email"
                  className="role-input"
                  placeholder="Email Address"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
              </div>

              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={studentShowPassword ? 'text' : 'password'}
                  className="role-input"
                  placeholder={studentMode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setStudentShowPassword(v => !v)}
                  tabIndex={-1}
                  title={studentShowPassword ? 'Hide password' : 'Show password'}
                >
                  {studentShowPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {studentMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type={studentShowPassword ? 'text' : 'password'}
                    className="role-input"
                    placeholder="Confirm Password"
                    value={studentConfirmPassword}
                    onChange={(e) => setStudentConfirmPassword(e.target.value)}
                    disabled={instructorLoading || studentLoading}
                  />
                </div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={instructorLoading || studentLoading}
              >
                {studentLoading ? (
                  <div className="spinner" />
                ) : studentMode === 'login' ? (
                  'Sign In as Student'
                ) : (
                  'Create Student Account'
                )}
              </button>
            </form>

            {/* Google Divider */}
            <div className="card-or-divider">
              <span className="card-or-line" />
              <span className="card-or-text">or</span>
              <span className="card-or-line" />
            </div>

            {/* Continue with Google */}
            <button
              type="button"
              className="google-signin-btn"
              onClick={() => handleGoogleClick('Student')}
              disabled={instructorLoading || studentLoading || googleLoading}
            >
              <GoogleSvgIcon />
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive Google Account Chooser Modal ── */}
      {googleModalRole && (
        <div className="google-modal-overlay" onClick={() => setGoogleModalRole(null)}>
          <div className="google-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="google-modal-header">
              <button
                type="button"
                className="google-modal-close-btn"
                onClick={() => setGoogleModalRole(null)}
              >
                ✕
              </button>
              <div className="google-modal-logo">
                <GoogleSvgIcon size={32} />
              </div>
              <h3>Sign in with Google</h3>
              <p>Choose an account to continue to <strong>MockTest AI</strong></p>
              <span className="google-modal-role-pill">
                Logging in as {googleModalRole}
              </span>
            </div>

            <div className="google-modal-body">
              {/* List of Available Google Accounts */}
              <div className="google-accounts-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {(googleModalRole === 'Instructor' ? [
                  { name: 'Professor John Doe', email: 'professor.john@university.edu' },
                  { name: 'Faculty Administrator', email: 'faculty.lead@institution.org' },
                  { name: 'Course Evaluator', email: 'evaluator.instructor@gmail.com' }
                ] : [
                  { name: 'Student Candidate', email: 'student.candidate@university.edu' },
                  { name: 'Alex Learner', email: 'alex.learner@gmail.com' },
                  { name: 'Code Assessment Profile', email: 'candidate.dev@gmail.com' }
                ]).map((acc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="google-account-item"
                    disabled={googleLoading}
                    onClick={() => executeGoogleAuth({
                      name: acc.name,
                      email: acc.email,
                      picture: ''
                    }, googleModalRole)}
                  >
                    <div className={`google-account-avatar ${googleModalRole === 'Instructor' ? 'avatar-teal' : 'avatar-purple'}`}>
                      {acc.name.charAt(0)}
                    </div>
                    <div className="google-account-info">
                      <span className="google-account-name">{acc.name}</span>
                      <span className="google-account-email">{acc.email}</span>
                    </div>
                    <span className="google-account-arrow">→</span>
                  </button>
                ))}
              </div>

              {/* Or Use Another Account Option */}
              <div className="google-custom-form">
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                  Or use another Google account:
                </span>
                <input
                  type="text"
                  className="google-custom-input"
                  placeholder="Your Name (optional)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  disabled={googleLoading}
                />
                <input
                  type="email"
                  className="google-custom-input"
                  placeholder="Enter any Gmail / Workspace email"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  disabled={googleLoading}
                />
                <button
                  type="button"
                  className="google-custom-submit"
                  disabled={googleLoading || !customGoogleEmail.trim()}
                  onClick={() => executeGoogleAuth({
                    name: customGoogleName.trim() || customGoogleEmail.split('@')[0],
                    email: customGoogleEmail.trim(),
                    picture: ''
                  }, googleModalRole)}
                >
                  {googleLoading ? 'Signing in…' : 'Sign In with This Account →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GoogleSvgIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.5 2.7 13.5l7.9 6.1C12.5 13.5 17.8 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.4l7.6 5.9C43.5 37.8 46.5 31.6 46.5 24.5z"/>
      <path fill="#FBBC05" d="M10.6 28.4c-.6-1.6-.9-3.3-.9-5.1s.3-3.5.9-5.1l-7.9-6.1C1 15.3 0 19.5 0 24s1 8.7 2.7 12.4l7.9-8z"/>
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.3-4.6 2.1-7.6 2.1-6.2 0-11.5-4-13.4-9.5l-7.9 6.1C6.7 42.5 14.7 48 24 48z"/>
    </svg>
  )
}
