import { useMemo } from 'react'
import studentsData from '../data/students.json'
import branchesData from '../data/branches.json'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import HeroSection from '../components/home/HeroSection'
import CommunitySnapshot from '../components/home/CommunitySnapshot'
import PlatformShowcase from '../components/home/PlatformShowcase'
import LeaderboardPreview from '../components/home/LeaderboardPreview'
import ContestsCommunity from '../components/home/ContestsCommunity'
import ClosingCTA from '../components/layout/ClosingCTA'
import {
  normalizeStudentsData,
  getBranchList,
  calculateCampusStats,
} from '../utils/studentAnalytics'
import '../styles/home.css'

export default function Home({ navigate }) {
  // Normalize students data
  const studentsList = useMemo(() => {
    return normalizeStudentsData(studentsData)
  }, [])

  // Process unique branch list
  const branchList = useMemo(() => {
    return getBranchList(branchesData)
  }, [])

  // Compute campus metrics
  const campusStats = useMemo(() => {
    return calculateCampusStats(studentsList)
  }, [studentsList])

  return (
    <div className="cphub-home">
      {/* Section A: Floating Pill Navbar */}
      <FloatingNavbar onNavigate={navigate} currentPath="/" />

      <main>
        {/* Section B: Centered Hero Section with Floating Cards */}
        <HeroSection onNavigate={navigate} />

        {/* Section C: Community Snapshot with Asymmetrical Cards */}
        <CommunitySnapshot
          totalStudents={campusStats.totalStudents}
          totalSolved={campusStats.totalSolved}
          totalLc={campusStats.totalLc}
          totalCf={campusStats.totalCf}
          branches={branchList}
        />

        {/* Section D: LeetCode & Codeforces Platform Showcase */}
        <PlatformShowcase
          onNavigate={navigate}
          totalLc={campusStats.totalLc}
          totalCf={campusStats.totalCf}
        />

        {/* Section E: Live Leaderboard Preview Table */}
        <LeaderboardPreview
          students={studentsList}
          onNavigate={navigate}
        />

        {/* Section F: Contests, Milestones & Programmer Quotes Marquee */}
        <ContestsCommunity onNavigate={navigate} />

        {/* Section G: Closing CTA & Understated Footer */}
        <ClosingCTA onNavigate={navigate} />
      </main>
    </div>
  )
}
