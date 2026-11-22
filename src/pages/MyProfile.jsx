import { useState, useEffect, useCallback, useMemo } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import ClosingCTA from '../components/layout/ClosingCTA'
import { useAuth } from '../context/AuthContext'
import { getMyProfile, updateMyProfile } from '../services/databaseService'
import { ROUTES } from '../constants/routes'
import '../styles/my-profile.css'

/**
 * MyProfile page — view and edit the current user's own profile.
 *
 * Data flow:
 *   1. On mount, load the signed-in user's profile from Supabase.
 *   2. Render an editable form with all university + LeetCode fields.
 *   3. On save, call updateMyProfile() which:
 *      - server-side: RLS ensures `auth.uid() = id` (can't edit someone else's row)
 *      - client-side: we only ever pass the user's own auth UUID
 */

const BRANCH_OPTIONS = [
  '', 'CSE', 'CST', 'AI&ML', 'AI&DS', 'CYBER', 'DataSci',
  'ECE', 'ROBOTICS', 'AEROSPACE', 'MECH', 'CIVIL', 'EEE', 'Other',
]

const GRADUATION_YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear()
  const years = ['']
  for (let y = current; y <= current + 5; y++) years.push(String(y))
  return years
})()

export default function MyProfile({ navigate }) {
  const { user, loading: authLoading } = useAuth()

  // ── Profile data state ──
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // ── Form state ──
  const [form, setForm] = useState({
    display_name: '',
    usn: '',
    branch: '',
    graduation_year: '',
    leetcode_username: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null) // { type, message }

  // ── Load profile on mount (once auth is ready) ──
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    setLoadError(null)

    const { data, error } = await getMyProfile()

    if (error) {
      setLoadError(error.message || 'Failed to load profile.')
      setLoadingProfile(false)
      return
    }

    setProfile(data)
    if (data) {
      setForm({
        display_name: data.display_name || '',
        usn: data.usn || '',
        branch: data.branch || '',
        graduation_year: data.graduation_year || '',
        leetcode_username: data.leetcode_username || '',
      })
    }
    setLoadingProfile(false)
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      loadProfile()
    } else if (!authLoading && !user) {
      setLoadingProfile(false)
    }
  }, [authLoading, user, loadProfile])

  // ── Detect if form has unsaved changes ──
  const hasChanges = useMemo(() => {
    if (!profile) return false
    return (
      form.display_name !== (profile.display_name || '') ||
      form.usn !== (profile.usn || '') ||
      form.branch !== (profile.branch || '') ||
      form.graduation_year !== (profile.graduation_year || '') ||
      form.leetcode_username !== (profile.leetcode_username || '')
    )
  }, [form, profile])

  // ── Handle field change ──
  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaveNotice(null)
  }

  // ── Save profile ──
  async function handleSave(e) {
    e.preventDefault()
    setSaveNotice(null)
    setSaving(true)

    const { data, error } = await updateMyProfile(form)
    setSaving(false)

    if (error) {
      // Surface user-friendly messages for common constraint violations
      const msg = error.message || 'Failed to save profile.'
      if (msg.includes('usn') && msg.includes('unique')) {
        setSaveNotice({ type: 'error', message: 'This USN is already taken by another student.' })
      } else if (msg.includes('display_name_length')) {
        setSaveNotice({ type: 'error', message: 'Display name is too long (max 100 characters).' })
      } else if (msg.includes('grad_year_format')) {
        setSaveNotice({ type: 'error', message: 'Graduation year must be a 4-digit year.' })
      } else if (msg.includes('lc_username_length')) {
        setSaveNotice({ type: 'error', message: 'LeetCode username is too long (max 40 characters).' })
      } else {
        setSaveNotice({ type: 'error', message: msg })
      }
      return
    }

    // Update local state to reflect saved data
    setProfile(data)
    setSaveNotice({ type: 'success', message: 'Profile saved successfully!' })
  }

  // ── Not signed in ──
  if (!authLoading && !user) {
    return (
      <div className="auth-page">
        <FloatingNavbar onNavigate={navigate} currentPath="/my-profile" />
        <main className="auth-main">
          <div className="auth-container">
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <div className="auth-logo-badge" aria-hidden="true">CP</div>
              <h1 className="auth-title">Sign in required</h1>
              <p className="auth-desc" style={{ marginBottom: '24px' }}>
                You need to be signed in to view and edit your profile.
              </p>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => navigate(ROUTES.LOGIN)}
              >
                <span>Sign In</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Loading ──
  if (authLoading || loadingProfile) {
    return (
      <div className="auth-page">
        <FloatingNavbar onNavigate={navigate} currentPath="/my-profile" />
        <main className="auth-main">
          <div className="auth-container">
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <div className="myprofile-loader" aria-label="Loading profile">
                <div className="myprofile-loader-dot"></div>
                <div className="myprofile-loader-dot"></div>
                <div className="myprofile-loader-dot"></div>
              </div>
              <p className="auth-desc">Loading your profile…</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Load error ──
  if (loadError) {
    return (
      <div className="auth-page">
        <FloatingNavbar onNavigate={navigate} currentPath="/my-profile" />
        <main className="auth-main">
          <div className="auth-container">
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <div className="auth-logo-badge" aria-hidden="true">CP</div>
              <h1 className="auth-title">Something went wrong</h1>
              <p className="auth-desc" style={{ marginBottom: '16px' }}>
                {loadError}
              </p>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={loadProfile}
              >
                <span>Retry</span>
                <span aria-hidden="true">↻</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Profile form ──
  return (
    <div className="auth-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/my-profile" />

      <main className="auth-main">
        <div className="myprofile-container">
          <button
            type="button"
            className="auth-back-link"
            onClick={() => navigate(ROUTES.HOME)}
            aria-label="Back to CPHub Home"
          >
            ← Back to CPHub Home
          </button>

          <div className="auth-card myprofile-card">
            {/* Header */}
            <div className="auth-card-header">
              <div className="myprofile-avatar" aria-hidden="true">
                {(form.display_name || user?.email || '?')[0].toUpperCase()}
              </div>
              <h1 className="auth-title">
                My <span className="italic-serif">Profile</span>
              </h1>
              <p className="auth-desc">
                Update your CPHub profile. This information appears on the leaderboard.
              </p>
              <div className="myprofile-email-pill">
                {user?.email}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="auth-form" noValidate>
              {/* Display Name */}
              <div className="form-group">
                <label htmlFor="display-name" className="form-label">
                  Display Name
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="display-name"
                    type="text"
                    value={form.display_name}
                    onChange={(e) => handleChange('display_name', e.target.value)}
                    placeholder="Aarav Sharma"
                    className="form-input"
                    maxLength={100}
                    disabled={saving}
                  />
                </div>
                <span className="myprofile-field-hint">
                  How you appear on the leaderboard.
                </span>
              </div>

              {/* USN */}
              <div className="form-group">
                <label htmlFor="profile-usn" className="form-label">
                  University Serial Number (USN)
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="profile-usn"
                    type="text"
                    value={form.usn}
                    onChange={(e) => handleChange('usn', e.target.value.toUpperCase())}
                    placeholder="1DS22CS001"
                    className="form-input"
                    maxLength={30}
                    disabled={saving}
                  />
                </div>
                <span className="myprofile-field-hint">
                  Your unique university ID. Must be unique across all students.
                </span>
              </div>

              {/* Branch + Graduation Year — side by side */}
              <div className="myprofile-row-2">
                <div className="form-group">
                  <label htmlFor="profile-branch" className="form-label">
                    Branch
                  </label>
                  <select
                    id="profile-branch"
                    value={form.branch}
                    onChange={(e) => handleChange('branch', e.target.value)}
                    className="form-input form-select"
                    disabled={saving}
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b || '— Select Branch —'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="profile-grad-year" className="form-label">
                    Graduation Year
                  </label>
                  <select
                    id="profile-grad-year"
                    value={form.graduation_year}
                    onChange={(e) => handleChange('graduation_year', e.target.value)}
                    className="form-input form-select"
                    disabled={saving}
                  >
                    {GRADUATION_YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y || '— Select Year —'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LeetCode Username */}
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="profile-leetcode" className="form-label">
                    LeetCode Username
                  </label>
                  {form.leetcode_username && (
                    <a
                      href={`https://leetcode.com/u/${encodeURIComponent(form.leetcode_username)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="myprofile-preview-link"
                    >
                      View on LeetCode ↗
                    </a>
                  )}
                </div>
                <div className="form-input-wrapper">
                  <input
                    id="profile-leetcode"
                    type="text"
                    value={form.leetcode_username}
                    onChange={(e) => handleChange('leetcode_username', e.target.value.trim())}
                    placeholder="aarav_codes"
                    className="form-input"
                    maxLength={40}
                    disabled={saving}
                  />
                </div>
                <span className="myprofile-field-hint">
                  Your LeetCode handle — used to fetch your solve stats for the leaderboard.
                </span>
              </div>

              {/* Timestamps (read-only info) */}
              {profile?.created_at && (
                <div className="myprofile-meta-row">
                  <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  {profile.updated_at && (
                    <span>Last updated {new Date(profile.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              )}

              {/* Save button */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={saving || !hasChanges}
              >
                {saving ? (
                  <span>Saving…</span>
                ) : (
                  <>
                    <span>{hasChanges ? 'Save Profile' : 'No Changes'}</span>
                    {hasChanges && <span aria-hidden="true">✓</span>}
                  </>
                )}
              </button>
            </form>

            {/* Notice */}
            {saveNotice && (
              <div className={`auth-notice-box ${saveNotice.type}`} role="alert">
                <p style={{ margin: 0 }}>{saveNotice.message}</p>
              </div>
            )}

            <div className="auth-footer-note">
              Your profile is linked to your Supabase Auth account. Only you can edit it.
            </div>
          </div>
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}
