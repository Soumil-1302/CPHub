import { useState, useMemo } from 'react'
import studentsData from '../data_students/students.json'
import branchesData from '../data_students/branches.json'
import Navbar from '../components/Navbar'
import BackgroundEffects from '../components/BackgroundEffects'
import LeaderboardHeader from '../components/LeaderboardHeader'
import LeaderboardFilters from '../components/LeaderboardFilters'
import LeaderboardTable from '../components/LeaderboardTable'
import '../styles/leaderboard.css'

/**
 * Resolves a student's branch code or name to the human-readable branch name
 * using the mapping provided in branches.json.
 */
function resolveBranchName(branchVal, branchMap) {
  if (!branchVal) return 'General'
  // If branchVal matches a key in branchMap (e.g. "ct" -> "CST", "cs" -> "CSE")
  if (branchMap[branchVal]) return branchMap[branchVal]
  // If branchVal is already one of the human-readable values (e.g. "CST")
  const directMatch = Object.values(branchMap).find(
    (name) => typeof name === 'string' && name.toLowerCase() === branchVal.toLowerCase()
  )
  if (directMatch) return directMatch
  return branchVal
}

export default function Leaderboard({ navigate }) {
  // Filter States
  const [selectedBranch, setSelectedBranch] = useState('ALL')
  const [selectedYear, setSelectedYear] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Process branches map from branches.json
  const branchMap = useMemo(() => {
    if (!branchesData) return {}
    return branchesData.branch || branchesData
  }, [])

  // 2. Extract unique branch options for filtering (derived from branches.json)
  const branchOptions = useMemo(() => {
    const rawNames = Object.values(branchMap)
    return Array.from(new Set(rawNames.filter(Boolean)))
  }, [branchMap])

  // 3. Normalize students data whether imported as an array or object keyed by USN
  const studentsList = useMemo(() => {
    if (!studentsData) return []
    if (Array.isArray(studentsData)) return studentsData
    if (typeof studentsData === 'object') {
      return Object.entries(studentsData).map(([key, val]) => ({
        ...val,
        id: val.username || key,
      }))
    }
    return []
  }, [])

  // 4. Extract unique graduation batches/years (derived dynamically from student data)
  const yearOptions = useMemo(() => {
    const rawYears = studentsList
      .map((s) => s.year)
      .filter((y) => typeof y === 'string' && y.trim().length > 0)
    // Sort descending so the most recent incoming batch appears first
    return Array.from(new Set(rawYears)).sort((a, b) => b.localeCompare(a))
  }, [studentsList])

  // 5. Overall metrics for the header
  const overallMetrics = useMemo(() => {
    const totalStudents = studentsList.length
    let totalSolved = 0
    const branchesSet = new Set()

    for (const s of studentsList) {
      const lc = Math.max(0, Number(s.leetcode) || 0)
      const cf = Math.max(0, Number(s.codeforces) || 0)
      const calculatedTotal = lc + cf
      const sTotal = Number.isFinite(s.total) && s.total >= calculatedTotal ? s.total : calculatedTotal
      totalSolved += sTotal

      const branchName = resolveBranchName(s.branch, branchMap)
      if (branchName) branchesSet.add(branchName)
    }

    return {
      totalStudents,
      totalSolved,
      activeBranchCount: branchesSet.size,
    }
  }, [studentsList, branchMap])

  // 6. Filter and sort students, then recalculate 1-based ranks
  const processedStudents = useMemo(() => {
    // A. Filter students
    const filtered = studentsList.filter((student) => {
      const branchDisplay = resolveBranchName(student.branch, branchMap)

      // Branch filter check
      if (selectedBranch !== 'ALL' && branchDisplay !== selectedBranch) {
        return false
      }

      // Year filter check
      if (selectedYear !== 'ALL' && student.year !== selectedYear) {
        return false
      }

      // Search query check (search by username or name)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim()
        const matchUser = (student.username || '').toLowerCase().includes(query)
        const matchName = (student.name || '').toLowerCase().includes(query)
        if (!matchUser && !matchName) return false
      }

      return true
    })

    // B. Calculate safe statistics for each student
    const withStats = filtered.map((student) => {
      const lc = Math.max(0, Number(student.leetcode) || 0)
      const cf = Math.max(0, Number(student.codeforces) || 0)
      const calculatedTotal = lc + cf
      const total =
        Number.isFinite(student.total) && student.total >= calculatedTotal
          ? student.total
          : calculatedTotal
      const branchDisplay = resolveBranchName(student.branch, branchMap)

      return {
        ...student,
        leetcode: lc,
        codeforces: cf,
        total,
        branchDisplay,
      }
    })

    // C. Sort by Total questions solved descending by default
    withStats.sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total
      }
      // Tie breaker 1: LeetCode solved
      if (b.leetcode !== a.leetcode) {
        return b.leetcode - a.leetcode
      }
      // Tie breaker 2: Codeforces solved
      if (b.codeforces !== a.codeforces) {
        return b.codeforces - a.codeforces
      }
      // Tie breaker 3: alphabetical by name
      return (a.name || '').localeCompare(b.name || '')
    })

    // D. Assign ranks automatically (1-indexed based on filtered/sorted results)
    return withStats.map((student, index) => ({
      ...student,
      rank: index + 1,
    }))
  }, [studentsList, selectedBranch, selectedYear, searchQuery, branchMap])

  // Reset filters handler
  const handleResetFilters = () => {
    setSelectedBranch('ALL')
    setSelectedYear('ALL')
    setSearchQuery('')
  }

  return (
    <div className="leaderboard-page">
      <Navbar onNavigate={navigate} currentPath="/leaderboard" />
      <BackgroundEffects />

      <main className="leaderboard-main">
        <div className="container">
          <LeaderboardHeader
            totalStudents={overallMetrics.totalStudents}
            totalSolved={overallMetrics.totalSolved}
            activeBranchCount={overallMetrics.activeBranchCount}
          />

          <LeaderboardFilters
            branchOptions={branchOptions}
            yearOptions={yearOptions}
            selectedBranch={selectedBranch}
            selectedYear={selectedYear}
            searchQuery={searchQuery}
            onBranchChange={setSelectedBranch}
            onYearChange={setSelectedYear}
            onSearchChange={setSearchQuery}
            onResetFilters={handleResetFilters}
            resultCount={processedStudents.length}
            totalCount={studentsList.length}
          />

          <LeaderboardTable
            students={processedStudents}
            onResetFilters={handleResetFilters}
          />
        </div>
      </main>
    </div>
  )
}
