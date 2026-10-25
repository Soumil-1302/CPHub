import { useState, useMemo } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import { sendMagicLink } from '../services/authService'
import { ROUTES } from '../constants/routes'
import '../styles/auth.css'

export default function Login({ navigate }) {
  const [authMode, setAuthMode] = useState('password') // 'password' | 'magic'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [showForgotModal, setShowForgotModal] = useState(false)

  // University email validation & USN detection
  const detectedCohort = useMemo(() => {
    if (!email) return null
    const clean = email.toLowerCase().trim()
    const usnMatch = clean.match(/^eng(\d{2})([a-z]{2})\d+@/i) || clean.match(/^eng(\d{2})([a-z]{2})\d+$/i)
    if (usnMatch) {
      const yearPrefix = usnMatch[1]
      const branchCode = usnMatch[2]
      const branchNames = {
        ct: 'CST',
        am: 'AI&ML',
        cy: 'CYBER',
        cs: 'CSE',
        ad: 'AI&DS',
        ds: 'DataSci',
        ec: 'ECE',
        ra: 'ROBOTICS',
        as: 'AEROSPACE',
        me: 'MECH',
      }
      const branch = branchNames[branchCode] || branchCode.toUpperCase()
      const startYear = 2000 + parseInt(yearPrefix, 10)
      return {
        branch,
        batch: `${startYear}–${startYear + 4}`,
      }
    }
    return null
  }, [email])

  const isUniversityEmail = useMemo(() => {
    if (!email) return false
    const clean = email.toLowerCase().trim()
    const validDomains = ['@dsu.edu.in', '.edu', '.edu.in', '.ac.in']
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) &&
      validDomains.some((d) => clean.endsWith(d) || clean.includes(d))
    )
  }, [email])

  const handleQuickFill = (student) => {
    setEmail(`${student.usn}@dsu.edu.in`)
    setPassword('••••••••••••')
    setNotice(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setNotice(null)

    if (!isUniversityEmail) {
      setNotice({
        type: 'error',
        message: 'Please enter a valid university email address (e.g., student@dsu.edu.in or you@university.edu).',
      })
      return
    }

    setLoading(true)

    if (authMode === 'magic') {
      const res = await sendMagicLink(email)
      setLoading(false)
      if (res.ok) {
        setNotice({
          type: 'success',
          message: `${res.message} Check your university inbox for the verification link.`,
        })
      } else {
        setNotice({
          type: 'error',
          message: res.message || 'Failed to send magic link.',
        })
      }
      return
    }

    // Password mode simulation
    setTimeout(() => {
      setLoading(false)
      setNotice({
        type: 'info',
        message: 'Frontend Demo Notice: In production, CPHub authenticates against Dayananda Sagar University SSO/LDAP. For this preview, you are verified to explore all campus rankings and student profiles.',
        username: email.split('@')[0],
      })
    }, 700)
  }

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
            <div className="auth-card-header">
              <div className="auth-logo-badge" aria-hidden="true">CP</div>
              <h1 className="auth-title">
                Sign in to <span className="italic-serif">CPHub</span>
              </h1>
              <p className="auth-desc">
                Access verified problem-solving leaderboards, batch breakdowns, and university contest insights.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="auth-tabs" role="tablist" aria-label="Sign In Method">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'password'}
                className={`auth-tab-btn ${authMode === 'password' ? 'active' : ''}`}
                onClick={() => { setAuthMode('password'); setNotice(null); }}
              >
                University Password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'magic'}
                className={`auth-tab-btn ${authMode === 'magic' ? 'active' : ''}`}
                onClick={() => { setAuthMode('magic'); setNotice(null); }}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {/* Email Field */}
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
                    placeholder="eng25ct0060@dsu.edu.in"
                    className="form-input"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field (Only for password mode) */}
              {authMode === 'password' && (
                <div className="form-group">
                  <div className="form-label-row">
                    <label htmlFor="auth-password" className="form-label">
                      Password
                    </label>
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => setShowForgotModal(true)}
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="form-input-wrapper">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="form-input"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Options Row */}
              {authMode === 'password' && (
                <div className="form-options-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember this device</span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span>Verifying credentials…</span>
                ) : authMode === 'password' ? (
                  <>
                    <span>Sign In with University ID</span>
                    <span aria-hidden="true">→</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Link</span>
                    <span aria-hidden="true">✉</span>
                  </>
                )}
              </button>
            </form>

            {/* Notification Feedback */}
            {notice && (
              <div className={`auth-notice-box ${notice.type}`} role="alert">
                <p style={{ margin: 0 }}>{notice.message}</p>
                {notice.type === 'info' && (
                  <div className="auth-notice-actions">
                    <button
                      type="button"
                      className="notice-action-btn"
                      onClick={() => navigate(ROUTES.LEADERBOARD)}
                    >
                      View Live Leaderboard →
                    </button>
                    <button
                      type="button"
                      className="notice-action-btn"
                      style={{ background: '#475569' }}
                      onClick={() => navigate(ROUTES.profile('aarav_codes'))}
                    >
                      Inspect Sample Profile →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Demo Credentials */}
            <div className="auth-demo-picker">
              <div className="demo-picker-title">
                <span>Quick Test Cohorts</span>
                <span style={{ fontSize: '11px', textTransform: 'none', color: '#94a3b8' }}>Click to auto-fill</span>
              </div>
              <div className="demo-students-grid">
                <button
                  type="button"
                  className="demo-student-chip"
                  onClick={() => handleQuickFill({ usn: 'eng25ct0060', username: 'aarav_codes' })}
                >
                  <span><strong>Aarav Sharma</strong> · @aarav_codes</span>
                  <span className="demo-student-rank">CST · Rank #1</span>
                </button>
                <button
                  type="button"
                  className="demo-student-chip"
                  onClick={() => handleQuickFill({ usn: 'eng24cs0061', username: 'ananya_dev' })}
                >
                  <span><strong>Ananya Rao</strong> · @ananya_dev</span>
                  <span className="demo-student-rank">CSE · Rank #2</span>
                </button>
              </div>
            </div>

            <div className="auth-footer-note">
              University SSO protected. Only Dayananda Sagar University (@dsu.edu.in) accounts can sync LeetCode and Codeforces profiles.
            </div>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Password Recovery</h3>
            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Your CPHub credentials are tied to your Dayananda Sagar University account. If you have forgotten your university password, please reset it through the university IT portal or use the <strong>Magic Link</strong> option to sign in without a password.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="notice-action-btn"
                onClick={() => {
                  setShowForgotModal(false)
                  setAuthMode('magic')
                }}
              >
                Use Magic Link Instead
              </button>
              <button
                type="button"
                className="notice-action-btn"
                style={{ background: '#64748b' }}
                onClick={() => setShowForgotModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
