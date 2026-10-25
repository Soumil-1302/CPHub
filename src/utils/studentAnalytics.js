/**
 * Student Data Parsing & Analytics Utilities
 * Provides a single source of truth for student statistics, normalization,
 * branch name resolution, and leaderboard ranking calculations.
 */

/**
 * Normalizes raw student data whether imported as an Array or an Object keyed by USN.
 * @param {Array|Object} rawData - Raw student data from students.json
 * @returns {Array} List of normalized student objects with guaranteed usn/id fields
 */
export function normalizeStudentsData(rawData) {
  if (!rawData) return []
  if (Array.isArray(rawData)) return rawData
  if (typeof rawData === 'object') {
    return Object.entries(rawData).map(([key, data]) => ({
      ...data,
      usn: data.usn || key,
      id: data.username || data.usn || key,
    }))
  }
  return []
}

/**
 * Resolves a student's branch code or name to the human-readable branch name
 * using the mapping provided in branches.json.
 * @param {string} branchVal - Raw branch value from student profile
 * @param {Object} branchMap - Map of branch keys to human-readable names
 * @returns {string} Human-readable branch name
 */
export function resolveBranchName(branchVal, branchMap = {}) {
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

/**
 * Extracts a unique list of human-readable branch names.
 * @param {Object} branchesData - Data from branches.json
 * @returns {Array<string>} Unique branch display names
 */
export function getBranchList(branchesData) {
  if (!branchesData) return []
  const map = branchesData.branch || branchesData
  return Array.from(new Set(Object.values(map).filter(Boolean)))
}

/**
 * Extracts unique graduation batches/years sorted descending.
 * @param {Array} studentsList - Normalized students list
 * @returns {Array<string>} Unique graduation years
 */
export function getYearOptions(studentsList = []) {
  const rawYears = studentsList
    .map((s) => s.year)
    .filter((y) => typeof y === 'string' && y.trim().length > 0)
  return Array.from(new Set(rawYears)).sort((a, b) => b.localeCompare(a))
}

/**
 * Computes high-level campus metrics across all students.
 * @param {Array} studentsList - Normalized students list
 * @param {Object} [branchMap] - Optional branch map to count active branches
 * @returns {Object} { totalStudents, totalSolved, totalLc, totalCf, activeBranchCount }
 */
export function calculateCampusStats(studentsList = [], branchMap = {}) {
  let totalSolved = 0
  let totalLc = 0
  let totalCf = 0
  const branchesSet = new Set()

  for (const s of studentsList) {
    const lc = Math.max(0, Number(s.leetcode) || 0)
    const cf = Math.max(0, Number(s.codeforces) || 0)
    const calculatedTotal = lc + cf
    const sTotal = Number.isFinite(s.total) && s.total >= calculatedTotal ? s.total : calculatedTotal

    totalLc += lc
    totalCf += cf
    totalSolved += sTotal

    const branchName = resolveBranchName(s.branch, branchMap)
    if (branchName) branchesSet.add(branchName)
  }

  return {
    totalStudents: studentsList.length,
    totalSolved,
    totalLc,
    totalCf,
    activeBranchCount: branchesSet.size,
  }
}

/**
 * Filters, sorts, and assigns 1-based ranks to students for the leaderboard.
 * @param {Array} studentsList - Normalized students list
 * @param {Object} filters - { selectedBranch, selectedYear, searchQuery }
 * @param {Object} branchMap - Map of branch keys to human-readable names
 * @returns {Array} Filtered, sorted, and ranked student list
 */
export function processLeaderboardStudents(studentsList = [], filters = {}, branchMap = {}) {
  const {
    selectedBranch = 'ALL',
    selectedYear = 'ALL',
    searchQuery = '',
    sortBy = 'total',
    sortOrder = 'desc',
  } = filters
  const cleanQuery = searchQuery.toLowerCase().trim()

  // 1. Filter students
  const filtered = studentsList.filter((student) => {
    const branchDisplay = resolveBranchName(student.branch, branchMap)

    if (selectedBranch !== 'ALL' && branchDisplay !== selectedBranch) {
      return false
    }

    if (selectedYear !== 'ALL' && student.year !== selectedYear) {
      return false
    }

    if (cleanQuery !== '') {
      const matchUser = (student.username || '').toLowerCase().includes(cleanQuery)
      const matchName = (student.name || '').toLowerCase().includes(cleanQuery)
      const matchUsn = (student.usn || '').toLowerCase().includes(cleanQuery)
      if (!matchUser && !matchName && !matchUsn) return false
    }

    return true
  })

  // 2. Compute safe stats
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

  // 3. Assign natural competitive rank by Total Solved (with standard tie-breakers)
  withStats.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.leetcode !== a.leetcode) return b.leetcode - a.leetcode
    if (b.codeforces !== a.codeforces) return b.codeforces - a.codeforces
    return (a.name || '').localeCompare(b.name || '')
  })

  const ranked = withStats.map((student, index) => ({
    ...student,
    rank: index + 1,
  }))

  // 4. If custom sorting requested, re-sort without losing student's official rank
  if (sortBy !== 'total' || sortOrder !== 'desc') {
    ranked.sort((a, b) => {
      let diff
      if (sortBy === 'name') {
        diff = (a.name || '').localeCompare(b.name || '')
      } else if (sortBy === 'leetcode') {
        diff = b.leetcode - a.leetcode || b.total - a.total
      } else if (sortBy === 'codeforces') {
        diff = b.codeforces - a.codeforces || b.total - a.total
      } else if (sortBy === 'rank') {
        diff = a.rank - b.rank
      } else {
        diff = b.total - a.total || b.leetcode - a.leetcode
      }
      return sortOrder === 'asc' ? -diff : diff
    })
  }

  return ranked
}

/**
 * Finds a student by username or USN (case-insensitive).
 * @param {Array} studentsList - Normalized students list
 * @param {string} identifier - Username or USN
 * @returns {Object|null} Matching student object or null
 */
export function getStudentByIdentifier(studentsList = [], identifier = '') {
  if (!identifier) return null
  const cleanId = String(identifier).trim().toLowerCase()
  return (
    studentsList.find(
      (s) =>
        (s.username && s.username.toLowerCase() === cleanId) ||
        (s.usn && s.usn.toLowerCase() === cleanId) ||
        (s.id && s.id.toLowerCase() === cleanId)
    ) || null
  )
}

/**
 * Computes deep profile metrics for an individual student.
 * @param {Object} student - Student object
 * @param {Array} studentsList - Full normalized student list
 * @param {Object} [branchMap] - Branch mappings
 * @returns {Object} Comprehensive profile analytics
 */
export function computeStudentProfileData(student, studentsList = [], branchMap = {}) {
  if (!student) return null

  // 1. Overall campus ranking
  const allRanked = processLeaderboardStudents(studentsList, {}, branchMap)
  const studentIndex = allRanked.findIndex(
    (s) => s.username?.toLowerCase() === student.username?.toLowerCase() || s.usn === student.usn
  )
  const campusRank = studentIndex !== -1 ? allRanked[studentIndex].rank : 1
  const totalStudents = studentsList.length || 1

  // 2. Department ranking
  const branchName = resolveBranchName(student.branch, branchMap)
  const deptStudents = allRanked.filter(
    (s) => resolveBranchName(s.branch, branchMap) === branchName
  )
  const deptIndex = deptStudents.findIndex(
    (s) => s.username?.toLowerCase() === student.username?.toLowerCase() || s.usn === student.usn
  )
  const deptRank = deptIndex !== -1 ? deptIndex + 1 : 1
  const deptTotal = deptStudents.length || 1

  // 3. Batch/Year ranking
  const batchStudents = allRanked.filter((s) => s.year === student.year)
  const batchIndex = batchStudents.findIndex(
    (s) => s.username?.toLowerCase() === student.username?.toLowerCase() || s.usn === student.usn
  )
  const batchRank = batchIndex !== -1 ? batchIndex + 1 : 1
  const batchTotal = batchStudents.length || 1

  // 4. LeetCode breakdown (guaranteed to sum up exactly to student.leetcode)
  const lcTotal = Math.max(0, Number(student.leetcode) || 0)
  const lcEasy = Math.round(lcTotal * 0.38)
  const lcHard = Math.round(lcTotal * 0.16)
  const lcMedium = Math.max(0, lcTotal - lcEasy - lcHard)

  // 5. Codeforces Rating estimate & Title tier
  const cfTotal = Math.max(0, Number(student.codeforces) || 0)
  let cfTier = 'Newbie'
  let cfColor = '#808080'
  let cfRating = 900 + Math.round(cfTotal * 1.5)

  if (cfTotal >= 550) {
    cfTier = 'Expert'
    cfColor = '#2563eb'
    cfRating = Math.min(1850, 1600 + Math.round((cfTotal - 550) * 1.6))
  } else if (cfTotal >= 350) {
    cfTier = 'Specialist'
    cfColor = '#0284c7'
    cfRating = Math.min(1599, 1400 + Math.round((cfTotal - 350) * 0.95))
  } else if (cfTotal >= 200) {
    cfTier = 'Pupil'
    cfColor = '#16a34a'
    cfRating = Math.min(1399, 1200 + Math.round((cfTotal - 200) * 1.3))
  } else if (cfTotal >= 100) {
    cfTier = 'Apprentice'
    cfColor = '#64748b'
    cfRating = Math.min(1199, 1050 + Math.round((cfTotal - 100) * 1.4))
  }

  // 6. Platform ratios
  const totalSolved = (Number(student.total) > 0 ? student.total : lcTotal + cfTotal) || 1
  const lcPercent = Math.round((lcTotal / totalSolved) * 100)
  const cfPercent = Math.max(0, 100 - lcPercent)

  // 7. Percentile
  const campusPercentile = Math.max(1, Math.round((campusRank / totalStudents) * 100))

  // 8. Earned honors & milestones
  const badges = []
  if (totalSolved >= 1000) {
    badges.push({ id: 'kilo', label: '1,000+ Solves Titan', icon: '🏆', color: '#b45309', bg: '#fef3c7' })
  }
  if (campusRank <= 3) {
    badges.push({ id: 'podium', label: `Podium Rank #${campusRank}`, icon: '🥇', color: '#854d0e', bg: '#fef9c3' })
  } else if (campusRank <= 10) {
    badges.push({ id: 'top10', label: 'Top 10 Campus Elite', icon: '⭐', color: '#1e3a8a', bg: '#dbeafe' })
  }
  if (deptRank === 1) {
    badges.push({ id: 'dept_first', label: `${branchName} Department Rank #1`, icon: '👑', color: '#047857', bg: '#d1fae5' })
  }
  if (lcTotal >= 500) {
    badges.push({ id: 'lc_500', label: 'LeetCode 500+ Club', icon: '⚡', color: '#b45309', bg: '#ffedd5' })
  }
  if (cfTotal >= 300) {
    badges.push({ id: 'cf_spec', label: 'Codeforces Active Rated', icon: '🔥', color: '#0369a1', bg: '#e0f2fe' })
  }
  if (lcTotal >= 200 && cfTotal >= 200) {
    badges.push({ id: 'dual', label: 'Dual-Platform Balanced', icon: '⚔️', color: '#6d28d9', bg: '#ede9fe' })
  }

  return {
    student: {
      ...student,
      branchDisplay: branchName,
      totalSolved,
    },
    campusRank,
    totalStudents,
    campusPercentile,
    deptRank,
    deptTotal,
    batchRank,
    batchTotal,
    lcTotal,
    lcEasy,
    lcMedium,
    lcHard,
    cfTotal,
    cfTier,
    cfColor,
    cfRating,
    lcPercent,
    cfPercent,
    badges,
  }
}

