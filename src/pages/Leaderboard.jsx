import { useEffect, useState } from 'react'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import LeaderboardHeader from '../components/leaderboard/LeaderboardHeader'
import LeaderboardPodium from '../components/leaderboard/LeaderboardPodium'
import LeaderboardFilters from '../components/leaderboard/LeaderboardFilters'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable'
import ClosingCTA from '../components/layout/ClosingCTA'
import { getLeaderboard } from '../services/leaderboardApi'
import { getApiErrorMessage } from '../services/api'
import { getBranchOptions } from '../services/profileApi'
import '../styles/leaderboard.css'

const PAGE_SIZE = 20

export default function Leaderboard({ navigate }) {
  const [selectedBranch, setSelectedBranch] = useState('ALL')
  const [selectedYear, setSelectedYear] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('total_solved')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [leaderboardResult, setLeaderboardResult] = useState(null)
  const [topStudents, setTopStudents] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [branchOptionsError, setBranchOptionsError] = useState('')

  const queryKey = JSON.stringify({
    currentPage,
    selectedBranch,
    selectedYear,
    sortBy,
    sortOrder,
    searchQuery,
  })
  const currentResult = leaderboardResult?.key === queryKey ? leaderboardResult : null
  const leaderboardData = currentResult?.data || null
  const loading = !currentResult
  const loadError = currentResult?.error || ''

  const branches = branchOptions.length
    ? branchOptions
    : leaderboardData?.summary?.available_branches || []
  const students = leaderboardData?.students || []
  const summary = leaderboardData?.summary
  const pagination = leaderboardData?.pagination
  const yearOptions = summary?.available_years || []

  useEffect(() => {
    let active = true
    getBranchOptions()
      .then((options) => {
        if (active) {
          setBranchOptions(options)
          setBranchOptionsError('')
        }
      })
      .catch((error) => {
        if (active) {
          setBranchOptionsError(getApiErrorMessage(error, 'Unable to load branch filters.'))
        }
      })
    return () => {
      active = false
    }
  }, [])

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
    })
      .then((data) => {
        if (active) setLeaderboardResult({ key: queryKey, data, error: '' })
      })
      .catch((error) => {
        if (active) {
          setLeaderboardResult({
            key: queryKey,
            data: null,
            error: getApiErrorMessage(error, 'Unable to load the leaderboard.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [currentPage, selectedBranch, selectedYear, sortBy, sortOrder, searchQuery, queryKey])

  useEffect(() => {
    let active = true
    getLeaderboard({ limit: 3, sortBy: 'total_solved', sortOrder: 'desc' })
      .then((data) => {
        if (active) setTopStudents(data.students || [])
      })
      .catch(() => {
        if (active) setTopStudents([])
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
            branchOptions={branches}
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

          {branchOptionsError && <p role="alert">{branchOptionsError}</p>}
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
              campusStudentCount={summary?.total_students || 0}
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
