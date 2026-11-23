import { useEffect, useState } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import HeroSection from '../components/home/HeroSection'
import CommunitySnapshot from '../components/home/CommunitySnapshot'
import PlatformShowcase from '../components/home/PlatformShowcase'
import LeaderboardPreview from '../components/home/LeaderboardPreview'
import ContestsCommunity from '../components/home/ContestsCommunity'
import ClosingCTA from '../components/layout/ClosingCTA'
import { getLeaderboard } from '../services/leaderboardApi'
import { getApiErrorMessage } from '../services/api'
import '../styles/home.css'

export default function Home({ navigate }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getLeaderboard({ limit: 1 })
      .then((result) => {
        if (active) setSummary(result.summary)
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load campus statistics.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const totalStudents = summary?.total_students || 0
  const totalSolved = summary?.total_solved || 0
  const branches = summary?.available_branches || []

  return (
    <div className="cphub-home">
      {/* Section A: Floating Pill Navbar */}
      <FloatingNavbar onNavigate={navigate} currentPath="/" />

      <main>
        {/* Section B: Centered Hero Section with Floating Cards */}
        <HeroSection onNavigate={navigate} />

        {/* Section C: Community Snapshot with Asymmetrical Cards */}
        {loading && <p role="status">Loading campus statistics…</p>}
        {error && <p role="alert">{error}</p>}
        <CommunitySnapshot
          totalStudents={totalStudents}
          totalSolved={totalSolved}
          branches={branches}
          showEmptyState={!loading && !error && totalStudents === 0}
        />

        {/* Section D: LeetCode Platform Showcase */}
        <PlatformShowcase
          onNavigate={navigate}
          totalLc={totalSolved}
        />

        {/* Section E: Live Leaderboard Preview Table */}
        <LeaderboardPreview
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
