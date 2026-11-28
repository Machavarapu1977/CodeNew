import React, { useState } from 'react'
import './LoginPage.css'
import OtpVerificationPage from './OtpVerificationPage'
import ForgotPasswordPage from './ForgotPasswordPage'

const API_BASE = 'http://127.0.0.1:8000'

export default function LoginPage({ onLoginSuccess }) {
  // Which card is active: 'instructor' | 'student'
  // Which sub-view: 'login' | 'signup'
  const [instructorMode, setInstructorMode] = useState('login')
  const [studentMode, setStudentMode] = useState('login')

  // Instructor form
  const [instructorName, setInstructorName] = useState('')
  const [instructorEmail, setInstructorEmail] = useState('')
  const [instructorPassword, setInstructorPassword] = useState('')
  const [instructorConfirmPassword, setInstructorConfirmPassword] = useState('')
  const [instructorShowPassword, setInstructorShowPassword] = useState(false)
  const [instructorLoading, setInstructorLoading] = useState(false)

  // Student form
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentConfirmPassword, setStudentConfirmPassword] = useState('')
  const [studentShowPassword, setStudentShowPassword] = useState(false)
  const [studentLoading, setStudentLoading] = useState(false)

  // Global notification
  const [error, setError] = useState(null)

  // OTP flow: set to { email, name, role } to show OTP page
  const [otpPending, setOtpPending] = useState(null)

  // Forgot password flow
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  // ── Standard email+password submit ───────────────────────────────────────
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

    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!password) { setError('Please enter your password.'); return }

    if (mode === 'signup') {
      if (!name.trim()) { setError('Please enter your full name.'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password, role }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Login failed.')
        onLoginSuccess(data.access_token, { ...data.user, role })
      } else {
        // Signup → send OTP first (Students must verify email)
        // Instructors: also go through OTP for consistency
        const res = await fetch(`${API_BASE}/auth/otp/send-signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Could not send verification code.')
        // Show OTP verification page
        setOtpPending({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── OTP verified callback ─────────────────────────────────────────────────
  const handleOtpSuccess = (token, userData) => {
    onLoginSuccess(token, userData)
  }

  // ── Render OTP page ───────────────────────────────────────────────────────
  if (otpPending) {
    return (
      <OtpVerificationPage
        email={otpPending.email}
        name={otpPending.name}
        role={otpPending.role}
        purpose="signup"
        onSuccess={handleOtpSuccess}
        onBack={() => setOtpPending(null)}
      />
    )
  }

  // ── Render forgot-password page ───────────────────────────────────────────
  if (showForgotPassword) {
    return (
      <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />
    )
  }

  // ── Main login/signup UI ──────────────────────────────────────────────────
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

            {/* Auth Mode Toggle */}
            <div className="auth-mode-toggle">
              <button
                type="button"
                className={`auth-mode-btn ${instructorMode === 'login' ? 'active' : ''}`}
                onClick={() => { setInstructorMode('login'); setError(null) }}
              >Sign In</button>
              <button
                type="button"
                className={`auth-mode-btn ${instructorMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setInstructorMode('signup'); setError(null) }}
              >Sign Up</button>
            </div>

            <form className="role-form" onSubmit={(e) => handleAuthSubmit(e, 'Instructor')}>
              {instructorMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon"><NameIcon /></div>
                  <input
                    type="text"
                    className="role-input"
                    placeholder="Full Name"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    disabled={instructorLoading}
                  />
                </div>
              )}

              <div className="input-wrapper">
                <div className="input-icon"><EmailIcon /></div>
                <input
                  type="email"
                  className="role-input"
                  placeholder="Email Address"
                  value={instructorEmail}
                  onChange={(e) => setInstructorEmail(e.target.value)}
                  disabled={instructorLoading}
                />
              </div>

              <div className="input-wrapper">
                <div className="input-icon"><LockIcon /></div>
                <input
                  type={instructorShowPassword ? 'text' : 'password'}
                  className="role-input"
                  placeholder={instructorMode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
                  value={instructorPassword}
                  onChange={(e) => setInstructorPassword(e.target.value)}
                  disabled={instructorLoading}
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setInstructorShowPassword(v => !v)}
                  tabIndex={-1}
                >{instructorShowPassword ? '🙈' : '👁️'}</button>
              </div>

              {instructorMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon"><LockIcon /></div>
                  <input
                    type={instructorShowPassword ? 'text' : 'password'}
                    className="role-input"
                    placeholder="Confirm Password"
                    value={instructorConfirmPassword}
                    onChange={(e) => setInstructorConfirmPassword(e.target.value)}
                    disabled={instructorLoading}
                  />
                </div>
              )}

              {instructorMode === 'login' && (
                <div className="forgot-password-row">
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => { setError(null); setShowForgotPassword(true) }}
                  >Forgot Password?</button>
                </div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={instructorLoading}
              >
                {instructorLoading
                  ? <div className="spinner" />
                  : instructorMode === 'login' ? 'Sign In as Instructor' : 'Create Instructor Account'}
              </button>
            </form>
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

            {/* Auth Mode Toggle */}
            <div className="auth-mode-toggle">
              <button
                type="button"
                className={`auth-mode-btn ${studentMode === 'login' ? 'active' : ''}`}
                onClick={() => { setStudentMode('login'); setError(null) }}
              >Sign In</button>
              <button
                type="button"
                className={`auth-mode-btn ${studentMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setStudentMode('signup'); setError(null) }}
              >Sign Up</button>
            </div>

            <form className="role-form" onSubmit={(e) => handleAuthSubmit(e, 'Student')}>
              {studentMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon"><NameIcon /></div>
                  <input
                    type="text"
                    className="role-input"
                    placeholder="Full Name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    disabled={studentLoading}
                  />
                </div>
              )}

              <div className="input-wrapper">
                <div className="input-icon"><EmailIcon /></div>
                <input
                  type="email"
                  className="role-input"
                  placeholder="Email Address"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  disabled={studentLoading}
                />
              </div>

              <div className="input-wrapper">
                <div className="input-icon"><LockIcon /></div>
                <input
                  type={studentShowPassword ? 'text' : 'password'}
                  className="role-input"
                  placeholder={studentMode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  disabled={studentLoading}
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setStudentShowPassword(v => !v)}
                  tabIndex={-1}
                >{studentShowPassword ? '🙈' : '👁️'}</button>
              </div>

              {studentMode === 'signup' && (
                <div className="input-wrapper">
                  <div className="input-icon"><LockIcon /></div>
                  <input
                    type={studentShowPassword ? 'text' : 'password'}
                    className="role-input"
                    placeholder="Confirm Password"
                    value={studentConfirmPassword}
                    onChange={(e) => setStudentConfirmPassword(e.target.value)}
                    disabled={studentLoading}
                  />
                </div>
              )}

              {studentMode === 'login' && (
                <div className="forgot-password-row">
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => { setError(null); setShowForgotPassword(true) }}
                  >Forgot Password?</button>
                </div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={studentLoading}
              >
                {studentLoading
                  ? <div className="spinner" />
                  : studentMode === 'login' ? 'Sign In as Student' : 'Create Student Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared SVG icon components ────────────────────────────────────────────────
function NameIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
