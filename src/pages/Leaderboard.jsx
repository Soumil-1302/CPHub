import { useState, useMemo } from 'react'
import studentsData from '../data/students.json'
import branchesData from '../data/branches.json'
import FloatingNavbar from '../components/layout/FloatingNavbar'
import LeaderboardHeader from '../components/leaderboard/LeaderboardHeader'
import LeaderboardPodium from '../components/leaderboard/LeaderboardPodium'
import LeaderboardFilters from '../components/leaderboard/LeaderboardFilters'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable'
import ClosingCTA from '../components/layout/ClosingCTA'
import {
  normalizeStudentsData,
  getBranchList,
  getYearOptions,
  calculateCampusStats,
  processLeaderboardStudents,
} from '../utils/studentAnalytics'
import '../styles/leaderboard.css'

export default function Leaderboard({ navigate }) {
  // Filter and Sorting States
  const [selectedBranch, setSelectedBranch] = useState('ALL')
  const [selectedYear, setSelectedYear] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('total')
  const [sortOrder, setSortOrder] = useState('desc')

  // 1. Process branches map from branches.json
  const branchMap = useMemo(() => {
    if (!branchesData) return {}
    return branchesData.branch || branchesData
  }, [])

  // 2. Extract unique branch options for filtering
  const branchOptions = useMemo(() => {
    return getBranchList(branchesData)
  }, [])

  // 3. Normalize students data whether imported as an array or object keyed by USN
  const studentsList = useMemo(() => {
    return normalizeStudentsData(studentsData)
  }, [])

  // 4. Extract unique graduation batches/years
  const yearOptions = useMemo(() => {
    return getYearOptions(studentsList)
  }, [studentsList])

  // 5. Overall campus metrics for the header
  const overallMetrics = useMemo(() => {
    return calculateCampusStats(studentsList, branchMap)
  }, [studentsList, branchMap])

  // 6. Natural top 3 students overall (unfiltered) for the podium
  const topStudents = useMemo(() => {
    const allRanked = processLeaderboardStudents(studentsList, {}, branchMap)
    return allRanked.slice(0, 3)
  }, [studentsList, branchMap])

  // 7. Filter, sort, and rank students according to active criteria
  const processedStudents = useMemo(() => {
    return processLeaderboardStudents(
      studentsList,
      { selectedBranch, selectedYear, searchQuery, sortBy, sortOrder },
      branchMap
    )
  }, [studentsList, selectedBranch, selectedYear, searchQuery, sortBy, sortOrder, branchMap])

  // Sorting handlers
  const handleSortChange = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(columnKey)
      setSortOrder('desc')
    }
  }

  const handleToggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  // Reset filters handler
  const handleResetFilters = () => {
    setSelectedBranch('ALL')
    setSelectedYear('ALL')
    setSearchQuery('')
    setSortBy('total')
    setSortOrder('desc')
  }

  return (
    <div className="leaderboard-page">
      <FloatingNavbar onNavigate={navigate} currentPath="/leaderboard" />

      <main className="leaderboard-main">
        <div className="cphub-container">
          <LeaderboardHeader
            totalStudents={overallMetrics.totalStudents}
            totalSolved={overallMetrics.totalSolved}
            totalLc={overallMetrics.totalLc}
            totalCf={overallMetrics.totalCf}
            activeBranchCount={overallMetrics.activeBranchCount}
          />

          {/* Podium section for Top 3 performers */}
          <LeaderboardPodium
            topStudents={topStudents}
            onNavigate={navigate}
          />

          {/* Search, Department, Batch, and Sorting Filters */}
          <LeaderboardFilters
            branchOptions={branchOptions}
            yearOptions={yearOptions}
            selectedBranch={selectedBranch}
            selectedYear={selectedYear}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onBranchChange={setSelectedBranch}
            onYearChange={setSelectedYear}
            onSearchChange={setSearchQuery}
            onSortByChange={setSortBy}
            onToggleSortOrder={handleToggleSortOrder}
            onResetFilters={handleResetFilters}
            resultCount={processedStudents.length}
            totalCount={studentsList.length}
          />

          {/* Dynamic Leaderboard Table with Pagination */}
          <LeaderboardTable
            students={processedStudents}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onResetFilters={handleResetFilters}
            onNavigate={navigate}
          />
        </div>
      </main>

      <ClosingCTA onNavigate={navigate} />
    </div>
  )
}
