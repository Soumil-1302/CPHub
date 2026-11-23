import { useState, useRef, useEffect } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import { useAuth } from '../context/AuthContext'
import {
  isAllowedEmail,
  sendOtp,
  signUp,
  signInWithPassword,
  verifyOtp,
  verifySignupOtp,
  resendSignupOtp,
  requestPasswordReset,
  updatePassword,
} from '../services/authService'
import {
  ALLOWED_EMAIL_DOMAINS,
  OTP_LENGTH,
} from '../constants/auth'
import {
  createRequestLock,
  getOtpCooldownSeconds,
  tryAcquireOtpRequest,
  withOtpCooldown,
} from '../utils/otpRequestControls'
import { ROUTES } from '../constants/routes'
import '../styles/auth.css'

/**
 * Login page for password, email-code, signup, and password recovery flows.
 * Supabase Auth state changes are observed by AuthContext.
 */
export default function Login({ navigate }) {
  const { user, authEvent } = useAuth()

  // ── Flow state ──
  const [selectedAuthMode, setAuthMode] = useState(
    () => new URLSearchParams(window.location.search).get('mode') === 'recovery'
      ? 'update-password'
      : 'otp',
  )
  const authMode = authEvent === 'PASSWORD_RECOVERY' ? 'update-password' : selectedAuthMode
  const [step, setStep] = useState('email') // 'email' | 'verify'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null) // { type, message }
  const [cooldownExpirations, setCooldownExpirations] = useState({})
  const [cooldownNow, setCooldownNow] = useState(0)
  const otpRefs = useRef([])
  const [requestLock] = useState(createRequestLock)
  const normalizedEmail = email.trim().toLowerCase()
  const cooldown = getOtpCooldownSeconds(cooldownExpirations, normalizedEmail, cooldownNow)
  const allowedEmailDomains = ALLOWED_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(' or ')
  const defaultEmailDomain = ALLOWED_EMAIL_DOMAINS[0]

  useEffect(() => {
    const latestExpiration = Math.max(0, ...Object.values(cooldownExpirations))
    if (latestExpiration <= Date.now()) return undefined

    const interval = setInterval(() => setCooldownNow(Date.now()), 1000)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      const now = Date.now()
      setCooldownNow(now)
      setCooldownExpirations((current) => Object.fromEntries(
        Object.entries(current).filter(([, expiration]) => expiration > now),
      ))
    }, latestExpiration - Date.now())

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [cooldownExpirations])

  // ── If already signed in, show a signed-in state ──
  if (user && authMode !== 'update-password') {
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

  // ── Per-email cooldown timer ──
  function startCooldown(address) {
    const now = Date.now()
    setCooldownExpirations((current) => withOtpCooldown(current, address, now))
    setCooldownNow(now)
  }

  // ── Step 1: Send OTP ──
  async function handleSendCode(e) {
    e.preventDefault()
    setNotice(null)

    if (!isAllowedEmail(email)) {
      setNotice({
        type: 'error',
        message: `Please enter a valid university email address ending in ${allowedEmailDomains}.`,
      })
      return
    }
    if (cooldown > 0) {
      setNotice({
        type: 'error',
        message: `Please wait ${cooldown}s before requesting another code for this email.`,
      })
      return
    }
    if (!tryAcquireOtpRequest(requestLock, cooldownExpirations, email, Date.now())) return

    setLoading(true)
    try {
      const res = await sendOtp(email)
      startCooldown(email)
      if (res.ok) {
        setStep('verify')
        setOtpDigits(Array(OTP_LENGTH).fill(''))
        setNotice({
          type: 'success',
          message: `A ${OTP_LENGTH}-digit code has been sent to ${email.trim().toLowerCase()}. Check your inbox (and spam folder).`,
        })
        // Auto-focus first OTP input after render
        setTimeout(() => otpRefs.current[0]?.focus(), 80)
      } else {
        setNotice({ type: 'error', message: res.message })
      }
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP ──
  async function handleVerifyCode(e) {
    e.preventDefault()
    setNotice(null)

    const code = otpDigits.join('')
    if (code.length !== OTP_LENGTH) {
      setNotice({
        type: 'error',
        message: `Please enter the full ${OTP_LENGTH}-digit code.`,
      })
      return
    }
    if (!requestLock.tryAcquire()) return

    setLoading(true)
    try {
      const res = authMode === 'signup-verify'
        ? await verifySignupOtp(email, code)
        : await verifyOtp(email, code)
      if (res.ok) {
        setNotice({
          type: 'success',
          message: authMode === 'signup-verify'
            ? 'Email verified successfully! Redirecting…'
            : 'Signed in successfully! Redirecting…',
        })
        // AuthContext will pick up the session; redirect after a brief moment
        setTimeout(() => navigate(ROUTES.MY_PROFILE), 800)
      } else {
        setNotice({ type: 'error', message: res.message })
      }
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  // ── Resend code ──
  async function handleResend() {
    if (
      !isAllowedEmail(email) ||
      !tryAcquireOtpRequest(requestLock, cooldownExpirations, email, Date.now())
    ) return
    setNotice(null)
    setLoading(true)
    try {
      const res = authMode === 'signup-verify'
        ? await resendSignupOtp(email)
        : await sendOtp(email)
      startCooldown(email)
      if (res.ok) {
        setOtpDigits(Array(OTP_LENGTH).fill(''))
        setNotice({
          type: 'success',
          message: 'A new code has been sent to your inbox.',
        })
        setTimeout(() => otpRefs.current[0]?.focus(), 80)
      } else {
        setNotice({ type: 'error', message: res.message })
      }
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setNotice(null)
    if (!isAllowedEmail(email)) {
      setNotice({ type: 'error', message: `Please use a valid university email address ending in ${allowedEmailDomains}.` })
      return
    }
    if (!requestLock.tryAcquire()) return

    setLoading(true)
    try {
      const result = await signUp(email, password)
      if (result.ok) {
        startCooldown(email)
        setAuthMode('signup-verify')
        setOtpDigits(Array(OTP_LENGTH).fill(''))
        setNotice({
          type: 'success',
          message: `A ${OTP_LENGTH}-digit email confirmation code has been sent. Enter it below to verify your account.`,
        })
      } else {
        setNotice({ type: 'error', message: result.message })
      }
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  async function handlePasswordSignIn(e) {
    e.preventDefault()
    setNotice(null)
    if (!requestLock.tryAcquire()) return

    setLoading(true)
    try {
      const result = await signInWithPassword(email, password)
      if (result.ok) {
        setNotice({ type: 'success', message: 'Signed in successfully! Redirecting…' })
        setTimeout(() => navigate(ROUTES.MY_PROFILE), 800)
      } else {
        setNotice({ type: 'error', message: result.message })
      }
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault()
    setNotice(null)
    if (!requestLock.tryAcquire()) return

    setLoading(true)
    try {
      const result = await requestPasswordReset(email)
      setNotice({ type: result.ok ? 'success' : 'error', message: result.message })
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    setNotice(null)
    if (!requestLock.tryAcquire()) return

    setLoading(true)
    try {
      const result = await updatePassword(newPassword)
      if (result.ok) {
        setNotice({ type: 'success', message: 'Password updated. Redirecting…' })
        setTimeout(() => navigate(ROUTES.MY_PROFILE), 800)
      } else {
        setNotice({ type: 'error', message: result.message })
      }
    } finally {
      requestLock.release()
      setLoading(false)
    }
  }

  function changeAuthMode(mode) {
    setAuthMode(mode)
    setStep('email')
    setPassword('')
    setNewPassword('')
    setNotice(null)
  }

  // ── Go back to email step ──
  function handleBackToEmail() {
    setStep('email')
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setNotice(null)
  }

  // ── OTP individual-digit input handlers ──
  function handleOtpChange(index, value) {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length > 0) {
      e.preventDefault()
      const next = Array(OTP_LENGTH).fill('')
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i]
      }
      setOtpDigits(next)
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
      otpRefs.current[focusIdx]?.focus()
    }
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
                {authMode === 'signup'
                  ? 'Create your '
                  : authMode === 'update-password'
                    ? 'Set a new '
                    : authMode === 'reset-password'
                      ? 'Reset your '
                      : 'Sign in to '}
                <span className="italic-serif">CPHub</span>
              </h1>
              <p className="auth-desc">
                {authMode === 'signup'
                  ? 'Create an account with your university email and password.'
                  : authMode === 'password'
                    ? 'Sign in with your university email and password.'
                    : authMode === 'reset-password'
                      ? 'Enter your university email to receive a password reset email.'
                      : authMode === 'update-password'
                        ? 'Choose a new password for your CPHub account.'
                        : authMode === 'signup-verify'
                          ? `Enter the ${OTP_LENGTH}-digit confirmation code sent to your email.`
                          : step === 'email'
                            ? 'Enter your university email to receive a one-time verification code.'
                            : `Enter the ${OTP_LENGTH}-digit code sent to your inbox.`}
              </p>
            </div>

            {!['signup-verify', 'reset-password', 'update-password'].includes(authMode) && (
              <div className="auth-tabs" role="tablist" aria-label="Authentication method">
                <button type="button" className={`auth-tab-btn ${authMode === 'otp' ? 'active' : ''}`} onClick={() => changeAuthMode('otp')}>Email code</button>
                <button type="button" className={`auth-tab-btn ${authMode === 'password' ? 'active' : ''}`} onClick={() => changeAuthMode('password')}>Password</button>
                <button type="button" className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`} onClick={() => changeAuthMode('signup')}>Create account</button>
              </div>
            )}

            {/* ═══════════════ STEP 1: EMAIL ═══════════════ */}
            {authMode === 'otp' && step === 'email' && (
              <form onSubmit={handleSendCode} className="auth-form" noValidate>
                <div className="form-group">
                  <div className="form-label-row">
                    <label htmlFor="university-email" className="form-label">
                      University Email
                    </label>
                  </div>
                  <div className="form-input-wrapper">
                    <input
                      id="university-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={`eng25ct0060@${defaultEmailDomain}`}
                      className="form-input"
                      required
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                  <span className="auth-domain-hint">
                    Only {allowedEmailDomains} accounts are accepted.
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || cooldown > 0}
                >
                  {loading ? (
                    <span>Sending code…</span>
                  ) : cooldown > 0 ? (
                    <span>Resend in {cooldown}s</span>
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
            {((authMode === 'otp' && step === 'verify') || authMode === 'signup-verify') && (
              <form onSubmit={handleVerifyCode} className="auth-form" noValidate>
                {/* Show which email */}
                <div className="otp-email-row">
                  <span className="otp-email-label">Code sent to</span>
                  <span className="otp-email-value">{email.trim().toLowerCase()}</span>
                  {authMode === 'otp' && (
                    <button
                      type="button"
                      className="otp-change-email-btn"
                      onClick={handleBackToEmail}
                      disabled={loading}
                    >
                      Change
                    </button>
                  )}
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

                <button type="submit" className="auth-submit-btn" disabled={loading || otpDigits.join('').length !== OTP_LENGTH}>
                  {loading ? (
                    <span>Verifying…</span>
                  ) : (
                    <>
                      <span>{authMode === 'signup-verify' ? 'Verify Email & Continue' : 'Verify & Sign In'}</span>
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
                      disabled={loading || !isAllowedEmail(email)}
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </form>
            )}

            {authMode === 'signup' && (
              <form onSubmit={handleSignUp} className="auth-form" noValidate>
                <div className="form-group">
                  <label htmlFor="signup-email" className="form-label">University Email</label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`student@${defaultEmailDomain}`}
                    className="form-input"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                  <span className="auth-domain-hint">Only {allowedEmailDomains} accounts can register.</span>
                </div>
                <div className="form-group">
                  <label htmlFor="signup-password" className="form-label">Password</label>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading || cooldown > 0}>
                  {loading ? 'Creating account…' : cooldown > 0 ? `Please wait ${cooldown}s` : 'Create Account'}
                </button>
              </form>
            )}

            {authMode === 'password' && (
              <form onSubmit={handlePasswordSignIn} className="auth-form" noValidate>
                <div className="form-group">
                  <label htmlFor="password-login-email" className="form-label">University Email</label>
                  <input
                    id="password-login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`student@${defaultEmailDomain}`}
                    className="form-input"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password-login-password" className="form-label">Password</label>
                  <input
                    id="password-login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
                <button type="button" className="forgot-link" onClick={() => changeAuthMode('reset-password')}>
                  Forgot password?
                </button>
              </form>
            )}

            {authMode === 'reset-password' && (
              <form onSubmit={handlePasswordReset} className="auth-form" noValidate>
                <div className="form-group">
                  <label htmlFor="reset-email" className="form-label">University Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`student@${defaultEmailDomain}`}
                    className="form-input"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Sending reset email…' : 'Send Password Reset Email'}
                </button>
                <button type="button" className="forgot-link" onClick={() => changeAuthMode('password')}>
                  Back to sign in
                </button>
              </form>
            )}

            {authMode === 'update-password' && (
              <form onSubmit={handlePasswordUpdate} className="auth-form" noValidate>
                <div className="form-group">
                  <label htmlFor="new-password" className="form-label">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Updating password…' : 'Update Password'}
                </button>
              </form>
            )}

            {/* ═══════════════ NOTICE ═══════════════ */}
            {notice && (
              <div className={`auth-notice-box ${notice.type}`} role="alert">
                <p style={{ margin: 0 }}>{notice.message}</p>
              </div>
            )}

            <div className="auth-footer-note">
              University-restricted sign-in. Only {allowedEmailDomains} accounts
              can access CPHub.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
