import { useMemo } from 'react'
import studentsData from '../data_students/students.json'
import branchesData from '../data_students/branches.json'
import FloatingNavbar from '../components/FloatingNavbar'
import HeroSection from '../components/HeroSection'
import CommunitySnapshot from '../components/CommunitySnapshot'
import PlatformShowcase from '../components/PlatformShowcase'
import LeaderboardPreview from '../components/LeaderboardPreview'
import ContestsCommunity from '../components/ContestsCommunity'
import ClosingCTA from '../components/ClosingCTA'
import '../styles/home.css'

export default function Home({ navigate }) {
  // Normalize students data whether array or object
  const studentsList = useMemo(() => {
    if (!studentsData) return []
    if (Array.isArray(studentsData)) return studentsData
    if (typeof studentsData === 'object') {
      return Object.entries(studentsData).map(([usn, data]) => ({
        ...data,
        usn,
      }))
    }
    return []
  }, [])

  // Process branch list
  const branchList = useMemo(() => {
    if (!branchesData) return []
    const map = branchesData.branch || branchesData
    return Array.from(new Set(Object.values(map)))
  }, [])

  // Compute campus metrics
  const campusStats = useMemo(() => {
    let totalSolved = 0
    let totalLc = 0
    let totalCf = 0

    for (const s of studentsList) {
      const lc = Math.max(0, Number(s.leetcode) || 0)
      const cf = Math.max(0, Number(s.codeforces) || 0)
      const calculatedTotal = lc + cf
      const sTotal = Number.isFinite(s.total) && s.total >= calculatedTotal ? s.total : calculatedTotal

      totalLc += lc
      totalCf += cf
      totalSolved += sTotal
    }

    return {
      totalStudents: studentsList.length,
      totalSolved,
      totalLc,
      totalCf,
    }
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
