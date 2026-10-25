import assert from 'node:assert/strict'
import {
  normalizeStudentsData,
  resolveBranchName,
  getBranchList,
  getYearOptions,
  calculateCampusStats,
  processLeaderboardStudents,
  getStudentByIdentifier,
  computeStudentProfileData,
} from './studentAnalytics.js'

console.log('Testing studentAnalytics utilities...')

// 1. normalizeStudentsData
const rawArray = [{ usn: '1DS21CS001', name: 'Alice' }]
const normalizedArr = normalizeStudentsData(rawArray)
assert.equal(normalizedArr.length, 1)
assert.equal(normalizedArr[0].usn, '1DS21CS001')

const rawObj = {
  '1DS21CS002': { name: 'Bob', username: 'bob_code' }
}
const normalizedObj = normalizeStudentsData(rawObj)
assert.equal(normalizedObj.length, 1)
assert.equal(normalizedObj[0].usn, '1DS21CS002')
assert.equal(normalizedObj[0].id, 'bob_code')

// 2. resolveBranchName
const branchMap = { cs: 'CSE', ct: 'CST' }
assert.equal(resolveBranchName('cs', branchMap), 'CSE')
assert.equal(resolveBranchName('CST', branchMap), 'CST')
assert.equal(resolveBranchName(null, branchMap), 'General')
assert.equal(resolveBranchName('unknown', branchMap), 'unknown')

// 3. getBranchList
assert.deepEqual(getBranchList({ branch: { cs: 'CSE', ct: 'CST' } }), ['CSE', 'CST'])

// 4. getYearOptions
const students = [
  { year: '2025' },
  { year: '2026' },
  { year: '2025' },
  { year: '' },
  { year: null },
]
assert.deepEqual(getYearOptions(students), ['2026', '2025'])

// 5. calculateCampusStats
const campusStudents = [
  { leetcode: 50, codeforces: 30, total: 80, branch: 'cs' },
  { leetcode: 20, codeforces: 10, total: 40, branch: 'ct' },
]
const stats = calculateCampusStats(campusStudents, branchMap)
assert.equal(stats.totalStudents, 2)
assert.equal(stats.totalSolved, 120)
assert.equal(stats.totalLc, 70)
assert.equal(stats.totalCf, 40)
assert.equal(stats.activeBranchCount, 2)

// 6. processLeaderboardStudents (filtering, tie-breaking, rank assignment)
const unranked = [
  { name: 'Charlie', leetcode: 50, codeforces: 50, total: 100, branch: 'cs', year: '2025' },
  { name: 'Alice', leetcode: 60, codeforces: 60, total: 120, branch: 'cs', year: '2025' },
  { name: 'Bob', leetcode: 70, codeforces: 30, total: 100, branch: 'ct', year: '2025' },
]
const ranked = processLeaderboardStudents(unranked, { selectedBranch: 'ALL', selectedYear: 'ALL', searchQuery: '' }, branchMap)
assert.equal(ranked.length, 3)
assert.equal(ranked[0].name, 'Alice')
assert.equal(ranked[0].rank, 1)
// Charlie and Bob have same total (100), Bob has more leetcode (70 vs 50)
assert.equal(ranked[1].name, 'Bob')
assert.equal(ranked[1].rank, 2)
assert.equal(ranked[2].name, 'Charlie')
assert.equal(ranked[2].rank, 3)

// Filter by branch
const cstOnly = processLeaderboardStudents(unranked, { selectedBranch: 'CST', selectedYear: 'ALL', searchQuery: '' }, branchMap)
assert.equal(cstOnly.length, 1)
assert.equal(cstOnly[0].name, 'Bob')
assert.equal(cstOnly[0].rank, 1)

// 7. getStudentByIdentifier
const sample = [
  { usn: 'eng25ct0060', username: 'aarav_codes', name: 'Aarav Sharma' },
  { usn: 'eng24cs0061', username: 'ananya_dev', name: 'Ananya Rao' },
]
assert.equal(getStudentByIdentifier(sample, 'Aarav_Codes')?.name, 'Aarav Sharma')
assert.equal(getStudentByIdentifier(sample, 'ENG24CS0061')?.name, 'Ananya Rao')
assert.equal(getStudentByIdentifier(sample, 'unknown'), null)

// 8. computeStudentProfileData
const profileStudent = { usn: 'eng25ct0060', username: 'aarav_codes', name: 'Aarav Sharma', leetcode: 500, codeforces: 300, total: 800, branch: 'ct', year: '2025' }
const profileData = computeStudentProfileData(profileStudent, [profileStudent, ...unranked], branchMap)
assert.equal(profileData.student.name, 'Aarav Sharma')
assert.equal(profileData.lcEasy + profileData.lcMedium + profileData.lcHard, 500)
assert.equal(profileData.cfTotal, 300)
assert.ok(profileData.badges.length > 0)

console.log('✓ All studentAnalytics unit tests passed successfully!')
