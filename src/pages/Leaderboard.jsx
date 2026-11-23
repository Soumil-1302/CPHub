import { useEffect, useMemo, useState } from 'react'
import branchesData from '../data/branches.json'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import LeaderboardHeader from '../components/leaderboard/LeaderboardHeader'
import LeaderboardPodium from '../components/leaderboard/LeaderboardPodium'
import LeaderboardFilters from '../components/leaderboard/LeaderboardFilters'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable'
import ClosingCTA from '../components/layout/ClosingCTA'
import { getLeaderboard } from '../services/databaseService'
import '../styles/leaderboard.css'

const PAGE_SIZE = 20

export default function Leaderboard({ navigate }) {
  const [selectedBranch, setSelectedBranch] = useState('ALL')
  const [selectedYear, setSelectedYear] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('total_solved')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [leaderboardData, setLeaderboardData] = useState(null)
  const [topStudents, setTopStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const branchOptions = useMemo(
    () => [...new Set(Object.values(branchesData.branch || {}))],
    [],
  )
  const students = leaderboardData?.students || []
  const summary = leaderboardData?.summary
  const pagination = leaderboardData?.pagination
  const yearOptions = summary?.available_years || []

  useEffect(() => {
    let active = true
    getLeaderboard({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      branch: selectedBranch,
      graduationYear: selectedYear,
      sortBy,
      sortOrder,
      search: searchQuery,
    }).then(({ data, error }) => {
      if (!active) return
      if (error) {
        setLoadError(error.message)
        setLeaderboardData(null)
      } else {
        setLoadError('')
        setLeaderboardData(data)
      }
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [currentPage, selectedBranch, selectedYear, sortBy, sortOrder, searchQuery])

  useEffect(() => {
    let active = true
    getLeaderboard({ limit: 3, sortBy: 'total_solved', sortOrder: 'desc' })
      .then(({ data }) => {
        if (active && data) setTopStudents(data.students)
      })

    return () => {
      active = false
    }
  }, [])

  const handleBranchChange = (value) => {
    setSelectedBranch(value)
    setCurrentPage(1)
  }

  const handleYearChange = (value) => {
    setSelectedYear(value)
    setCurrentPage(1)
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleSortByChange = (value) => {
    setSortBy(value)
    setSortOrder('desc')
    setCurrentPage(1)
  }

  const handleSortChange = (columnKey) => {
    const nextSortBy = columnKey === 'rank' || columnKey === 'leetcode'
      ? 'total_solved'
      : columnKey
    if (sortBy === nextSortBy) {
      setSortOrder((previous) => previous === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(nextSortBy)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const handleToggleSortOrder = () => {
    setSortOrder((previous) => previous === 'desc' ? 'asc' : 'desc')
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setSelectedBranch('ALL')
    setSelectedYear('ALL')
    setSearchQuery('')
    setSortBy('total_solved')
    setSortOrder('desc')
    setCurrentPage(1)
  }

  return (
    <div className="leaderboard-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/leaderboard" />

      <main className="leaderboard-main">
        <div className="cphub-container">
          <LeaderboardHeader
            totalStudents={summary?.total_students || 0}
            totalSolved={summary?.total_solved || 0}
            activeBranchCount={summary?.active_branch_count || 0}
          />

          <LeaderboardPodium topStudents={topStudents} onNavigate={navigate} />

          <LeaderboardFilters
            branchOptions={branchOptions}
            yearOptions={yearOptions}
            selectedBranch={selectedBranch}
            selectedYear={selectedYear}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onBranchChange={handleBranchChange}
            onYearChange={handleYearChange}
            onSearchChange={handleSearchChange}
            onSortByChange={handleSortByChange}
            onToggleSortOrder={handleToggleSortOrder}
            onResetFilters={handleResetFilters}
            resultCount={pagination?.total || 0}
            totalCount={summary?.total_students || 0}
          />

          {loading && <p role="status">Loading leaderboard…</p>}
          {loadError && <p role="alert">{loadError}</p>}
          {!loading && !loadError && (
            <LeaderboardTable
              students={students}
              sortBy={sortBy}
              sortOrder={sortOrder}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              totalCount={pagination?.total || 0}
              onPageChange={setCurrentPage}
              onSortChange={handleSortChange}
              onResetFilters={handleResetFilters}
              onNavigate={navigate}
            />
          )}
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}
