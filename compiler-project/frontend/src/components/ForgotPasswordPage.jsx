import React, { useState, useEffect, useRef } from 'react'
import './OtpVerificationPage.css'   // reuse shared styles
import './ForgotPasswordPage.css'

const API_BASE = 'http://127.0.0.1:8000'
const OTP_EXPIRY_SECONDS = 300
const RESEND_COOLDOWN = 60

export default function ForgotPasswordPage({ onBack }) {
  // step: 'email' | 'otp' | 'password' | 'done'
  const [step, setStep] = useState('email')

  // Email step
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [emailInfo, setEmailInfo] = useState(null)

  // OTP step
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState(null)
  const [otpSuccess, setOtpSuccess] = useState(null)
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN)
  const [resendLoading, setResendLoading] = useState(false)
  const inputRefs = useRef([])

  // Password step
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState(null)

  // Verified OTP to pass to final reset
  const [verifiedOtp, setVerifiedOtp] = useState('')

  // Timers
  useEffect(() => {
    if (step !== 'otp' || timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [step, timeLeft])

  useEffect(() => {
    if (step !== 'otp' || resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [step, resendCooldown])

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  // ── Step 1: Send reset OTP ────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) { setEmailError('Please enter a valid email address.'); return }
    setEmailLoading(true)
    setEmailError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/password-reset/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to send reset code.')
      setEmailInfo(data.detail)
      setStep('otp')
      setTimeLeft(OTP_EXPIRY_SECONDS)
      setResendCooldown(RESEND_COOLDOWN)
    } catch (err) {
      setEmailError(err.message)
    } finally {
      setEmailLoading(false)
    }
  }

  // ── OTP input helpers ─────────────────────────────────────────────────────
  const handleOtpChange = (idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    setOtpError(null)
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...otp]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || ''
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const otpString = otp.join('')

  // ── Step 2: Validate OTP (locally transition to password step) ────────────
  // We collect the OTP here and pass it on to the final password reset call.
  const handleOtpNext = async (e) => {
    e.preventDefault()
    if (otpString.length < 6) { setOtpError('Please enter all 6 digits.'); return }
    if (timeLeft <= 0) { setOtpError('Code has expired. Please request a new one.'); return }
    setVerifiedOtp(otpString)
    setStep('password')
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setResendLoading(true)
    setOtpError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'reset' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to resend.')
      setOtpSuccess('A new code has been sent.')
      setTimeLeft(OTP_EXPIRY_SECONDS)
      setResendCooldown(RESEND_COOLDOWN)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setOtpError(err.message)
    } finally {
      setResendLoading(false)
    }
  }

  // ── Step 3: Set new password ──────────────────────────────────────────────
  const handleSetPassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    setPasswordLoading(true)
    setPasswordError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/password-reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: verifiedOtp,
          new_password: newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Password reset failed.')
      setStep('done')
    } catch (err) {
      // If OTP expired after navigating to password step, go back to OTP
      if (err.message.toLowerCase().includes('expired') || err.message.toLowerCase().includes('incorrect')) {
        setStep('otp')
        setOtpError(err.message)
      } else {
        setPasswordError(err.message)
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="otp-page-container">
      <div className="bg-decor-circle-left" />
      <div className="bg-decor-circle-right" />

      <div className="otp-card">
        {/* Back */}
        {step !== 'done' && (
          <button
            className="otp-back-btn"
            onClick={step === 'email' ? onBack : () => setStep(step === 'password' ? 'otp' : 'email')}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
            {step === 'email' ? 'Back to Login' : 'Back'}
          </button>
        )}

        {/* Step: email */}
        {step === 'email' && (
          <>
            <div className="otp-icon fp-icon-key">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m21 2-9.6 9.6" />
                <path d="m15.5 7.5 3 3L22 7l-3-3" />
              </svg>
            </div>
            <h1 className="otp-title">Forgot Password</h1>
            <p className="otp-subtitle">
              Enter your registered email address.<br />
              We'll send a reset code.
            </p>

            {emailError && <div className="otp-error"><span>⚠️</span> {emailError}</div>}

            <form className="fp-form" onSubmit={handleSendOtp} style={{ width: '100%' }}>
              <div className="fp-input-wrapper">
                <input
                  type="email"
                  className="fp-input"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
                  disabled={emailLoading}
                  autoFocus
                />
              </div>
              <button type="submit" className="otp-verify-btn" disabled={emailLoading}>
                {emailLoading ? <span className="spinner" /> : 'Send Reset Code'}
              </button>
            </form>
          </>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <>
            <div className="otp-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h1 className="otp-title">Enter Reset Code</h1>
            <p className="otp-subtitle">
              {emailInfo || `A 6-digit code was sent to`}<br />
              <strong>{email}</strong>
            </p>

            {otpError && <div className="otp-error"><span>⚠️</span> {otpError}</div>}
            {otpSuccess && <div className="otp-success"><span>✅</span> {otpSuccess}</div>}

            <div className={`otp-timer ${timeLeft <= 60 ? 'otp-timer-warning' : ''}`}>
              {timeLeft > 0
                ? <>Code expires in <strong>{formatTime(timeLeft)}</strong></>
                : <span className="otp-timer-expired">Code has expired — please request a new one.</span>
              }
            </div>

            <form className="otp-form" onSubmit={handleOtpNext}>
              <div className="otp-inputs" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => inputRefs.current[idx] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-digit ${digit ? 'otp-digit-filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={otpLoading || timeLeft <= 0}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <button
                type="submit"
                className="otp-verify-btn"
                disabled={otpLoading || otpString.length < 6 || timeLeft <= 0}
              >
                {otpLoading ? <span className="spinner" /> : 'Continue'}
              </button>
            </form>

            <div className="otp-resend-row">
              <span className="otp-resend-label">Didn't receive it?</span>
              {resendCooldown > 0
                ? <span className="otp-resend-cooldown">Resend in {resendCooldown}s</span>
                : (
                  <button
                    type="button"
                    className="otp-resend-btn"
                    onClick={handleResend}
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Sending…' : 'Resend Code'}
                  </button>
                )
              }
            </div>
          </>
        )}

        {/* Step: new password */}
        {step === 'password' && (
          <>
            <div className="otp-icon fp-icon-lock">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="otp-title">Set New Password</h1>
            <p className="otp-subtitle">Choose a strong password for your account.</p>

            {passwordError && <div className="otp-error"><span>⚠️</span> {passwordError}</div>}

            <form className="fp-form" onSubmit={handleSetPassword} style={{ width: '100%' }}>
              <div className="fp-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="fp-input"
                  placeholder="New Password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null) }}
                  disabled={passwordLoading}
                  autoFocus
                />
                <button
                  type="button"
                  className="fp-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >{showPassword ? '🙈' : '👁️'}</button>
              </div>
              <div className="fp-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="fp-input"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null) }}
                  disabled={passwordLoading}
                />
              </div>
              <button type="submit" className="otp-verify-btn" disabled={passwordLoading}>
                {passwordLoading ? <span className="spinner" /> : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <>
            <div className="otp-icon fp-icon-success">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="otp-title">Password Reset!</h1>
            <p className="otp-subtitle">Your password has been updated successfully.<br />You can now sign in with your new password.</p>
            <button className="otp-verify-btn" onClick={onBack} style={{ marginTop: '0.5rem' }}>
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
