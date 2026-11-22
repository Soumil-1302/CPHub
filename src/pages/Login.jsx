import { useState, useMemo, useRef, useEffect } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import { useAuth } from '../context/AuthContext'
import { isAllowedEmail, sendOtp, verifyOtp } from '../services/authService'
import { ALLOWED_EMAIL_DOMAIN, OTP_CODE_LENGTH } from '../constants/auth'
import { ROUTES } from '../constants/routes'
import '../styles/auth.css'

/**
 * Login page — two-step email OTP flow.
 *
 * Step 1  "email"   → user enters email, clicks "Send Code"
 * Step 2  "verify"  → user enters the 6-digit OTP from their inbox
 *
 * After successful verification the AuthContext picks up the new session
 * automatically via its onAuthStateChange listener.
 */
export default function Login({ navigate }) {
  const { user } = useAuth()

  // ── Flow state ──
  const [step, setStep] = useState('email') // 'email' | 'verify'
  const [email, setEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(Array(OTP_CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null) // { type, message }
  const [cooldown, setCooldown] = useState(0)
  const otpRefs = useRef([])
  const cooldownRef = useRef(null)

  // ── USN detection (preserved from original) ──
  const detectedCohort = useMemo(() => {
    if (!email) return null
    const clean = email.toLowerCase().trim()
    const usnMatch =
      clean.match(/^eng(\d{2})([a-z]{2})\d+@/i) ||
      clean.match(/^eng(\d{2})([a-z]{2})\d+$/i)
    if (usnMatch) {
      const branchNames = {
        ct: 'CST', am: 'AI&ML', cy: 'CYBER', cs: 'CSE', ad: 'AI&DS',
        ds: 'DataSci', ec: 'ECE', ra: 'ROBOTICS', as: 'AEROSPACE', me: 'MECH',
      }
      const branch = branchNames[usnMatch[2]] || usnMatch[2].toUpperCase()
      const startYear = 2000 + parseInt(usnMatch[1], 10)
      return { branch, batch: `${startYear}–${startYear + 4}` }
    }
    return null
  }, [email])

  // ── If already signed in, show a signed-in state ──
  if (user) {
    return (
      <div className="auth-page">
        <FloatingNavbar onNavigate={navigate} currentPath="/login" />
        <main className="auth-main">
          <div className="auth-container">
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <div className="auth-logo-badge" aria-hidden="true">CP</div>
              <h1 className="auth-title" style={{ marginBottom: '12px' }}>
                You&apos;re signed in
              </h1>
              <p className="auth-desc" style={{ marginBottom: '24px' }}>
                Signed in as <strong>{user.email}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => navigate(ROUTES.MY_PROFILE)}
                >
                  <span>My Profile</span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ background: 'var(--cphub-text-main, #161618)' }}
                  onClick={() => navigate(ROUTES.LEADERBOARD)}
                >
                  <span>View Leaderboard</span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className="auth-back-link"
                  style={{ alignSelf: 'center', marginBottom: 0 }}
                  onClick={() => navigate(ROUTES.HOME)}
                >
                  ← Back to Home
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Cooldown timer (prevent spamming resend) ──
  function startCooldown(seconds = 60) {
    setCooldown(seconds)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ── Step 1: Send OTP ──
  async function handleSendCode(e) {
    e.preventDefault()
    setNotice(null)

    if (!isAllowedEmail(email)) {
      setNotice({
        type: 'error',
        message: `Please enter a valid @${ALLOWED_EMAIL_DOMAIN} email address.`,
      })
      return
    }

    setLoading(true)
    const res = await sendOtp(email)
    setLoading(false)

    if (res.ok) {
      setStep('verify')
      setOtpDigits(Array(OTP_CODE_LENGTH).fill(''))
      startCooldown(60)
      setNotice({
        type: 'success',
        message: `A ${OTP_CODE_LENGTH}-digit code has been sent to ${email.trim().toLowerCase()}. Check your inbox (and spam folder).`,
      })
      // Auto-focus first OTP input after render
      setTimeout(() => otpRefs.current[0]?.focus(), 80)
    } else {
      setNotice({ type: 'error', message: res.message })
    }
  }

  // ── Step 2: Verify OTP ──
  async function handleVerifyCode(e) {
    e.preventDefault()
    setNotice(null)

    const code = otpDigits.join('')
    if (code.length !== OTP_CODE_LENGTH) {
      setNotice({
        type: 'error',
        message: `Please enter the full ${OTP_CODE_LENGTH}-digit code.`,
      })
      return
    }

    setLoading(true)
    const res = await verifyOtp(email, code)
    setLoading(false)

    if (res.ok) {
      setNotice({
        type: 'success',
        message: 'Signed in successfully! Redirecting…',
      })
      // AuthContext will pick up the session; redirect after a brief moment
      setTimeout(() => navigate(ROUTES.MY_PROFILE), 800)
    } else if (res.expired) {
      setNotice({
        type: 'error',
        message: res.message,
      })
    } else {
      setNotice({ type: 'error', message: res.message })
    }
  }

  // ── Resend code ──
  async function handleResend() {
    setNotice(null)
    setLoading(true)
    const res = await sendOtp(email)
    setLoading(false)

    if (res.ok) {
      setOtpDigits(Array(OTP_CODE_LENGTH).fill(''))
      startCooldown(60)
      setNotice({
        type: 'success',
        message: 'A new code has been sent to your inbox.',
      })
      setTimeout(() => otpRefs.current[0]?.focus(), 80)
    } else {
      setNotice({ type: 'error', message: res.message })
    }
  }

  // ── Go back to email step ──
  function handleBackToEmail() {
    setStep('email')
    setOtpDigits(Array(OTP_CODE_LENGTH).fill(''))
    setNotice(null)
    clearInterval(cooldownRef.current)
    setCooldown(0)
  }

  // ── OTP individual-digit input handlers ──
  function handleOtpChange(index, value) {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)

    // Auto-advance to next input
    if (digit && index < OTP_CODE_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_CODE_LENGTH)
    if (pasted.length > 0) {
      e.preventDefault()
      const next = Array(OTP_CODE_LENGTH).fill('')
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i]
      }
      setOtpDigits(next)
      const focusIdx = Math.min(pasted.length, OTP_CODE_LENGTH - 1)
      otpRefs.current[focusIdx]?.focus()
    }
  }

  // ── Quick-fill for demo ──
  function handleQuickFill(usn) {
    setEmail(`${usn}@${ALLOWED_EMAIL_DOMAIN}`)
    setNotice(null)
  }

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/login" />

      <main className="auth-main">
        <div className="auth-container">
          <button
            type="button"
            className="auth-back-link"
            onClick={() => navigate(ROUTES.HOME)}
            aria-label="Back to CPHub Home"
          >
            ← Back to CPHub Home
          </button>

          <div className="auth-card">
            {/* Header */}
            <div className="auth-card-header">
              <div className="auth-logo-badge" aria-hidden="true">CP</div>
              <h1 className="auth-title">
                Sign in to <span className="italic-serif">CPHub</span>
              </h1>
              <p className="auth-desc">
                {step === 'email'
                  ? 'Enter your university email to receive a one-time verification code.'
                  : `Enter the ${OTP_CODE_LENGTH}-digit code sent to your inbox.`}
              </p>
            </div>

            {/* ═══════════════ STEP 1: EMAIL ═══════════════ */}
            {step === 'email' && (
              <form onSubmit={handleSendCode} className="auth-form" noValidate>
                <div className="form-group">
                  <div className="form-label-row">
                    <label htmlFor="university-email" className="form-label">
                      University Email
                    </label>
                    {detectedCohort && (
                      <span className="domain-detection-pill" title="Verified Campus Cohort">
                        ✓ {detectedCohort.branch} · {detectedCohort.batch}
                      </span>
                    )}
                  </div>
                  <div className="form-input-wrapper">
                    <input
                      id="university-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={`eng25ct0060@${ALLOWED_EMAIL_DOMAIN}`}
                      className="form-input"
                      required
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                  <span className="auth-domain-hint">
                    Only @{ALLOWED_EMAIL_DOMAIN} accounts are accepted.
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span>Sending code…</span>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <span aria-hidden="true">✉</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ═══════════════ STEP 2: VERIFY CODE ═══════════════ */}
            {step === 'verify' && (
              <form onSubmit={handleVerifyCode} className="auth-form" noValidate>
                {/* Show which email */}
                <div className="otp-email-row">
                  <span className="otp-email-label">Code sent to</span>
                  <span className="otp-email-value">{email.trim().toLowerCase()}</span>
                  <button
                    type="button"
                    className="otp-change-email-btn"
                    onClick={handleBackToEmail}
                  >
                    Change
                  </button>
                </div>

                {/* OTP digit inputs */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '10px' }}>
                    Verification Code
                  </label>
                  <div className="otp-inputs-row" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="otp-digit-input"
                        aria-label={`Digit ${i + 1}`}
                        autoComplete="one-time-code"
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || otpDigits.join('').length !== OTP_CODE_LENGTH}
                >
                  {loading ? (
                    <span>Verifying…</span>
                  ) : (
                    <>
                      <span>Verify & Sign In</span>
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>

                {/* Resend */}
                <div className="otp-resend-row">
                  <span className="otp-resend-text">Didn't receive the code?</span>
                  {cooldown > 0 ? (
                    <span className="otp-resend-cooldown">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="otp-resend-btn"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ═══════════════ NOTICE ═══════════════ */}
            {notice && (
              <div className={`auth-notice-box ${notice.type}`} role="alert">
                <p style={{ margin: 0 }}>{notice.message}</p>
              </div>
            )}

            {/* ═══════════════ QUICK DEMO (email step only) ═══════════════ */}
            {step === 'email' && (
              <div className="auth-demo-picker">
                <div className="demo-picker-title">
                  <span>Quick Test Cohorts</span>
                  <span style={{ fontSize: '11px', textTransform: 'none', color: '#94a3b8' }}>
                    Click to auto-fill
                  </span>
                </div>
                <div className="demo-students-grid">
                  <button
                    type="button"
                    className="demo-student-chip"
                    onClick={() => handleQuickFill('eng25ct0060')}
                  >
                    <span><strong>Aarav Sharma</strong> · @aarav_codes</span>
                    <span className="demo-student-rank">CST · Rank #1</span>
                  </button>
                  <button
                    type="button"
                    className="demo-student-chip"
                    onClick={() => handleQuickFill('eng24cs0061')}
                  >
                    <span><strong>Ananya Rao</strong> · @ananya_dev</span>
                    <span className="demo-student-rank">CSE · Rank #2</span>
                  </button>
                </div>
              </div>
            )}

            <div className="auth-footer-note">
              University-restricted sign-in. Only @{ALLOWED_EMAIL_DOMAIN} accounts
              can access CPHub.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
