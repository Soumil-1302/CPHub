import { useState, useEffect, useCallback, useMemo } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import ClosingCTA from '../components/layout/ClosingCTA'
import { useAuth } from '../context/useAuth'
import {
  getMyProfile,
  getRegistrationDraft,
  getMyLeetcodeStats,
  registerMyProfile,
  refreshMyLeetcodeStats,
  updateMyProfile,
} from '../services/profileApi'
import { ROUTES } from '../constants/routes'
import '../styles/my-profile.css'

/**
 * MyProfile page — view and edit the current user's own profile.
 *
 * Data flow:
 *   1. Load the signed-in user's profile or unclaimed registration draft.
 *   2. Complete registration or edit profile through the authenticated API.
 *   3. Load and refresh LeetCode statistics through the backend.
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
  const [isRegistration, setIsRegistration] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // ── Form state ──
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    university: '',
    branch: '',
    graduation_year: '',
    leetcode_username: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null) // { type, message }
  const [leetcodeStats, setLeetcodeStats] = useState(null)
  const [refreshingStats, setRefreshingStats] = useState(false)
  const [statsNotice, setStatsNotice] = useState(null) // { type, message }

  // ── Load profile on mount (once auth is ready) ──
  const loadProfile = useCallback(async () => {
    try {
      const data = await getMyProfile()
      setLoadError(null)
      setProfile(data)
      setIsRegistration(false)
      setForm({
        username: data.username || '',
        display_name: data.full_name || data.display_name || '',
        university: data.university || '',
        branch: data.branch || '',
        graduation_year: String(data.year_of_passing || ''),
        leetcode_username: data.leetcode_username || '',
      })

      try {
        setLeetcodeStats(await getMyLeetcodeStats())
        setStatsNotice(null)
      } catch (error) {
        setLeetcodeStats(null)
        setStatsNotice({
          type: 'error',
          message: error.message || 'Failed to load LeetCode stats.',
        })
      }
    } catch (error) {
      if (error.status === 404) {
        try {
          const draft = await getRegistrationDraft()
          setLoadError(null)
          setProfile(null)
          setIsRegistration(true)
          setForm({
            username: draft.username || '',
            display_name: draft.full_name || '',
            university: draft.university || '',
            branch: draft.branch || '',
            graduation_year: String(draft.year_of_passing || ''),
            leetcode_username: draft.leetcode_username || '',
          })
          setLeetcodeStats(null)
        } catch (draftError) {
          setLoadError(draftError.message || 'Failed to load your registration details.')
        }
      } else {
        setLoadError(error.message || 'Failed to load profile.')
      }
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      const timeout = window.setTimeout(() => void loadProfile(), 0)
      return () => window.clearTimeout(timeout)
    }
    return undefined
  }, [authLoading, user, loadProfile])

  // ── Detect if form has unsaved changes ──
  const hasChanges = useMemo(() => {
    if (isRegistration) return true
    if (!profile) return false
    return (
      form.username !== (profile.username || '') ||
      form.display_name !== (profile.display_name || '') ||
      form.university !== (profile.university || '') ||
      form.branch !== (profile.branch || '') ||
      form.graduation_year !== String(profile.year_of_passing || '') ||
      form.leetcode_username !== (profile.leetcode_username || '')
    )
  }, [form, isRegistration, profile])

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

    const registration = {
      username: form.username,
      full_name: form.display_name,
      university: form.university,
      branch: form.branch,
      year_of_passing: Number(form.graduation_year),
      leetcode_username: form.leetcode_username,
    }
    const updates = {
      username: form.username,
      display_name: form.display_name,
      university: form.university,
      branch: form.branch,
      year_of_passing: Number(form.graduation_year),
      leetcode_profile_url: form.leetcode_username
        ? `https://leetcode.com/u/${encodeURIComponent(form.leetcode_username)}/`
        : null,
    }

    try {
      const registering = isRegistration
      const data = registering
        ? await registerMyProfile(registration)
        : await updateMyProfile(updates)
      setProfile(data)
      setIsRegistration(false)
      setForm({
        username: data.username || '',
        display_name: data.full_name || data.display_name || '',
        university: data.university || '',
        branch: data.branch || '',
        graduation_year: String(data.year_of_passing || ''),
        leetcode_username: data.leetcode_username || '',
      })
      setSaveNotice({ type: 'success', message: 'Profile saved successfully!' })
      if (registering) {
        try {
          setLeetcodeStats(await refreshMyLeetcodeStats())
          setStatsNotice({ type: 'success', message: 'LeetCode stats synced successfully.' })
        } catch (syncError) {
          setStatsNotice({
            type: 'error',
            message: syncError.message || 'Profile saved, but LeetCode stats could not be synced yet.',
          })
        }
      }
    } catch (error) {
      setSaveNotice({
        type: 'error',
        message: error.message || 'Failed to save profile.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleRefreshStats() {
    setStatsNotice(null)
    setRefreshingStats(true)

    try {
      const data = await refreshMyLeetcodeStats()
      setLeetcodeStats(data)
      setStatsNotice({
        type: 'success',
        message: 'LeetCode stats refreshed successfully.',
      })
    } catch (error) {
      setStatsNotice({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : 'Could not refresh LeetCode stats. Your last saved stats are unchanged.',
      })
    } finally {
      setRefreshingStats(false)
    }
  }

  const savedUsernameMatchesForm =
    form.leetcode_username.trim().toLowerCase() ===
    (profile?.leetcode_username || '').trim().toLowerCase()
  const statsMatchCurrentUsername =
    (leetcodeStats?.username || leetcodeStats?.provider_username)?.toLowerCase() ===
    (profile?.leetcode_username || '').trim().toLowerCase()

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
                onClick={() => {
                  setLoadingProfile(true)
                  void loadProfile()
                }}
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
                {isRegistration ? 'Complete your ' : 'My '}
                <span className="italic-serif">Profile</span>
              </h1>
              <p className="auth-desc">
                {isRegistration
                  ? 'Choose your public username and add your university and LeetCode details to join the leaderboard.'
                  : 'Update your CPHub profile. Public profile details appear on the leaderboard.'}
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
                    placeholder="Your display name"
                    className="form-input"
                    maxLength={100}
                    required
                    disabled={saving}
                  />
                </div>
                <span className="myprofile-field-hint">
                  How you appear on the leaderboard.
                </span>
              </div>

              {/* Public username */}
              <div className="form-group">
                <label htmlFor="profile-username" className="form-label">
                  CPHub Username
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="profile-username"
                    type="text"
                    value={form.username}
                    onChange={(e) => handleChange('username', e.target.value.toLowerCase())}
                    placeholder="your_public_username"
                    className="form-input"
                    minLength={3}
                    maxLength={30}
                    required
                    disabled={saving}
                  />
                </div>
                <span className="myprofile-field-hint">
                  Used in your public profile link. Use 3–30 letters, numbers, or underscores.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="profile-university" className="form-label">
                  University
                </label>
                <input
                  id="profile-university"
                  type="text"
                  value={form.university}
                  onChange={(e) => handleChange('university', e.target.value)}
                  placeholder="Your university"
                  className="form-input"
                  maxLength={120}
                  required
                  disabled={saving}
                />
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
                    required
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
                    required
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
                    required
                    disabled={saving}
                  />
                </div>
                <span className="myprofile-field-hint">
                  Your LeetCode handle — used to fetch your solve stats for the leaderboard.
                </span>
              </div>

              {profile && <section className="form-group" aria-labelledby="leetcode-stats-title">
                <h2 id="leetcode-stats-title" className="form-label">LeetCode Statistics</h2>
                <p className="myprofile-field-hint">
                  Stats are refreshed securely by the server. CPHub never asks for your LeetCode password or session.
                </p>
                {statsMatchCurrentUsername ? (
                  <>
                    <div className="myprofile-meta-row">
                      <span>Total solved: <strong>{leetcodeStats.solved_total.toLocaleString()}</strong></span>
                      <span>Easy: {leetcodeStats.easy_solved.toLocaleString()}</span>
                      <span>Medium: {leetcodeStats.medium_solved.toLocaleString()}</span>
                      <span>Hard: {leetcodeStats.hard_solved.toLocaleString()}</span>
                    </div>
                    {leetcodeStats.fetched_at && (
                      <p className="myprofile-field-hint">
                        Last successful fetch: {new Date(leetcodeStats.fetched_at).toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="myprofile-field-hint">
                    No saved stats are available for this LeetCode username yet.
                  </p>
                )}
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={handleRefreshStats}
                  disabled={
                    refreshingStats ||
                    saving ||
                    !profile?.leetcode_username ||
                    !savedUsernameMatchesForm
                  }
                >
                  {refreshingStats ? 'Refreshing…' : 'Refresh LeetCode Stats'}
                </button>
                {!savedUsernameMatchesForm && (
                  <p className="myprofile-field-hint">
                    Save your updated LeetCode username before refreshing.
                  </p>
                )}
                {statsNotice && (
                  <div className={`auth-notice-box ${statsNotice.type}`} role="status">
                    <p style={{ margin: 0 }}>{statsNotice.message}</p>
                  </div>
                )}
              </section>}

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
              Your university email remains private. Your CPHub username, display name,
              university, branch, graduation year, and linked LeetCode statistics are public.
            </div>
          </div>
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}
