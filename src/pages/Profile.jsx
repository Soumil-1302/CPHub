import { useMemo } from 'react'
import studentsData from '../data/students.json'
import branchesData from '../data/branches.json'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import ProfileHeader from '../components/profile/ProfileHeader'
import PlatformBreakdown from '../components/profile/PlatformBreakdown'
import ProfileComparison from '../components/profile/ProfileComparison'
import ProfileNotFound from '../components/profile/ProfileNotFound'
import ClosingCTA from '../components/layout/ClosingCTA'
import {
  normalizeStudentsData,
  getStudentByIdentifier,
  computeStudentProfileData,
} from '../utils/studentAnalytics'
import '../styles/profile.css'

export default function Profile({ username, navigate }) {
  // 1. Process branches map from branches.json
  const branchMap = useMemo(() => {
    if (!branchesData) return {}
    return branchesData.branch || branchesData
  }, [])

  // 2. Normalize full students list
  const studentsList = useMemo(() => {
    return normalizeStudentsData(studentsData)
  }, [])

  // 3. Find matching student
  const student = useMemo(() => {
    return getStudentByIdentifier(studentsList, username)
  }, [studentsList, username])

  // 4. Compute analytics
  const profileData = useMemo(() => {
    if (!student) return null
    return computeStudentProfileData(student, studentsList, branchMap)
  }, [student, studentsList, branchMap])

  return (
    <div className="profile-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/leaderboard" />

      <main className="profile-main">
        <div className="cphub-container">
          {!profileData ? (
            <ProfileNotFound identifier={username} onNavigate={navigate} />
          ) : (
            <>
              {/* Header with avatar, affiliation, ranks, and quick stats */}
              <ProfileHeader
                profileData={profileData}
                onNavigate={navigate}
              />

              {/* LeetCode & Codeforces deep dive cards */}
              <PlatformBreakdown
                profileData={profileData}
              />

              {/* Campus benchmark, platform balance, and honors badges */}
              <ProfileComparison
                profileData={profileData}
              />
            </>
          )}
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}
