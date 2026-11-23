import { useEffect, useMemo, useState } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import ProfileHeader from '../components/profile/ProfileHeader'
import PlatformBreakdown from '../components/profile/PlatformBreakdown'
import ProfileComparison from '../components/profile/ProfileComparison'
import ProfileNotFound from '../components/profile/ProfileNotFound'
import ClosingCTA from '../components/layout/ClosingCTA'
import { getPublicProfile } from '../services/profileApi'
import { ApiError, getApiErrorMessage } from '../services/api'
import '../styles/profile.css'

export default function Profile({ username, navigate }) {
  const [requestResult, setRequestResult] = useState(null)
  const currentResult = requestResult?.username === username ? requestResult : null
  const profile = currentResult?.profile || null
  const loading = !currentResult
  const notFound = currentResult?.notFound || false
  const error = currentResult?.error || ''

  useEffect(() => {
    let active = true
    getPublicProfile(username)
      .then((data) => {
        if (active) setRequestResult({ username, profile: data })
      })
      .catch((requestError) => {
        if (!active) return
        if (requestError instanceof ApiError && requestError.status === 404) {
          setRequestResult({ username, profile: null, notFound: true })
        } else {
          setRequestResult({
            username,
            profile: null,
            error: getApiErrorMessage(requestError, 'Unable to load this profile.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [username])

  const profileData = useMemo(() => {
    if (!profile) return null
    const solvedTotal = profile.solved_total || 0
    const student = {
      username: profile.username,
      name: profile.display_name || profile.username,
      usn: profile.usn || '',
      branch: profile.branch || '',
      branchDisplay: profile.branch || '',
      year: String(profile.year_of_passing || ''),
      leetcode: solvedTotal,
      totalSolved: solvedTotal,
      leetcode_username: profile.leetcode_username,
    }
    const badges = []
    if (solvedTotal >= 1000) {
      badges.push({ id: 'kilo', label: '1,000+ LeetCode Solves', icon: '🏆', color: '#b45309', bg: '#fef3c7' })
    } else if (solvedTotal >= 500) {
      badges.push({ id: 'lc_500', label: 'LeetCode 500+ Club', icon: '⚡', color: '#b45309', bg: '#ffedd5' })
    }
    return {
      student,
      campusRank: null,
      totalStudents: null,
      deptRank: null,
      deptTotal: null,
      batchRank: null,
      batchTotal: null,
      campusPercentile: null,
      lcTotal: solvedTotal,
      lcEasy: profile.easy_solved || 0,
      lcMedium: profile.medium_solved || 0,
      lcHard: profile.hard_solved || 0,
      contestRating: profile.contest_rating,
      fetched_at: profile.fetched_at,
      leetcode_profile_url: profile.leetcode_profile_url,
      badges,
    }
  }, [profile])

  return (
    <div className="profile-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/leaderboard" />

      <main className="profile-main">
        <div className="cphub-container">
          {loading && <p role="status">Loading student profile…</p>}
          {!loading && error && <p role="alert">{error}</p>}
          {!loading && notFound && <ProfileNotFound identifier={username} onNavigate={navigate} />}
          {!loading && !error && !notFound && profileData && (
            <>
              <ProfileHeader profileData={profileData} onNavigate={navigate} />
              <PlatformBreakdown profileData={profileData} />
              <ProfileComparison profileData={profileData} />
            </>
          )}
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}
