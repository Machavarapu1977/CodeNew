import React, { useState, useEffect, useRef } from 'react'
import './OtpVerificationPage.css'

const API_BASE = 'http://127.0.0.1:8000'
const OTP_EXPIRY_SECONDS = 300  // 5 minutes
const RESEND_COOLDOWN = 60

export default function OtpVerificationPage({ email, name, role, purpose = 'signup', onSuccess, onBack }) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN)
  const inputRefs = useRef([])

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [timeLeft])

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  // Handle individual OTP digit input
  const handleChange = (idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    setError(null)
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  // Handle pasting a full 6-digit code
  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...otp]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || ''
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const otpString = otp.join('')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (otpString.length < 6) { setError('Please enter all 6 digits.'); return }
    if (timeLeft <= 0) { setError('Code has expired. Please request a new one.'); return }

    setLoading(true)
    setError(null)
    try {
      const endpoint = purpose === 'signup'
        ? '/auth/otp/verify-signup'
        : '/auth/password-reset/verify'

      const body = purpose === 'signup'
        ? { email, otp: otpString, role }
        : { email, otp: otpString, new_password: '' } // ForgotPasswordPage handles reset differently

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Verification failed.')

      if (purpose === 'signup') {
        onSuccess(data.access_token, { ...data.user, role })
      } else {
        onSuccess(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setResendLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to resend.')
      setSuccess('A new code has been sent to your email.')
      setTimeLeft(OTP_EXPIRY_SECONDS)
      setResendCooldown(RESEND_COOLDOWN)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="otp-page-container">
      <div className="bg-decor-circle-left" />
      <div className="bg-decor-circle-right" />

      <div className="otp-card">
        {/* Back button */}
        <button className="otp-back-btn" onClick={onBack} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Icon */}
        <div className="otp-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h1 className="otp-title">Verify Your Email</h1>
        <p className="otp-subtitle">
          We sent a 6-digit code to<br />
          <strong>{email}</strong>
        </p>

        {error && <div className="otp-error"><span>⚠️</span> {error}</div>}
        {success && <div className="otp-success"><span>✅</span> {success}</div>}

        {/* Timer */}
        <div className={`otp-timer ${timeLeft <= 60 ? 'otp-timer-warning' : ''}`}>
          {timeLeft > 0
            ? <>Code expires in <strong>{formatTime(timeLeft)}</strong></>
            : <span className="otp-timer-expired">Code has expired — please request a new one.</span>
          }
        </div>

        <form className="otp-form" onSubmit={handleVerify}>
          {/* 6-box OTP input */}
          <div className="otp-inputs" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={el => inputRefs.current[idx] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`otp-digit ${digit ? 'otp-digit-filled' : ''}`}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={loading || timeLeft <= 0}
                autoFocus={idx === 0}
              />
            ))}
          </div>

          <button
            type="submit"
            className="otp-verify-btn"
            disabled={loading || otpString.length < 6 || timeLeft <= 0}
          >
            {loading ? <span className="spinner" /> : 'Verify'}
          </button>
        </form>

        {/* Resend */}
        <div className="otp-resend-row">
          <span className="otp-resend-label">Didn't receive the code?</span>
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
      </div>
    </div>
  )
}
