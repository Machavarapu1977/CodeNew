import React, { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLoginSuccess }) {
  // Instructor form state
  const [instructorName, setInstructorName] = useState('')
  const [instructorEmail, setInstructorEmail] = useState('')
  const [instructorLoading, setInstructorLoading] = useState(false)

  // Student form state
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentLoading, setStudentLoading] = useState(false)

  // Common error state
  const [error, setError] = useState(null)

  const API_BASE = 'http://127.0.0.1:8000'

  const handleLogin = async (e, name, email, role, setLoading) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !email.trim()) {
      setError(`Please enter both Name and Email for ${role} login.`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role: role
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed. Please try again.')
      }

      // Save token and pass user info back
      if (onLoginSuccess) {
        onLoginSuccess(data.access_token, data.user)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Unable to reach backend server.')
    } finally {
      setLoading(false)
    }
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
          <h1>Welcome Back</h1>
          <p>Log in to continue your journey</p>
        </div>

        {error && <div className="error-toast">{error}</div>}

        {/* Roles Grid */}
        <div className="login-roles-grid">
          {/* Instructor Login Card */}
          <div className="role-card instructor-card">
            <div className="icon-badge instructor-icon-badge">
              {/* Instructor Presentation / Teacher Icon */}
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <path d="M16 3h5v8h-5z" />
                <path d="M16 11l4 4" />
              </svg>
            </div>

            <h2 className="role-title">Instructor Login</h2>
            <p className="role-description">
              Create and manage questions, tests, and track student performance.
            </p>

            <form
              className="role-form"
              onSubmit={(e) => handleLogin(e, instructorName, instructorEmail, 'Instructor', setInstructorLoading)}
            >
              {/* Name Input */}
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
                  placeholder="Name"
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
              </div>

              {/* Email Input */}
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
                  placeholder="Email"
                  value={instructorEmail}
                  onChange={(e) => setInstructorEmail(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={instructorLoading || studentLoading}
              >
                {instructorLoading ? <div className="spinner" /> : 'Login'}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="divider-container">
            <div className="divider-line" />
            <div className="or-badge">OR</div>
          </div>

          {/* Student Login Card */}
          <div className="role-card student-card">
            <div className="icon-badge student-icon-badge">
              {/* Student Graduation Cap Icon */}
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>

            <h2 className="role-title">Student Login</h2>
            <p className="role-description">
              Take mock tests, solve problems, and track your progress.
            </p>

            <form
              className="role-form"
              onSubmit={(e) => handleLogin(e, studentName, studentEmail, 'Student', setStudentLoading)}
            >
              {/* Name Input */}
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
                  placeholder="Name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
              </div>

              {/* Email Input */}
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
                  placeholder="Email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  disabled={instructorLoading || studentLoading}
                />
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={instructorLoading || studentLoading}
              >
                {studentLoading ? <div className="spinner" /> : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
