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
  { leetcode: 50, total: 150, branch: 'cs' },
  { leetcode: 20, total: 200, branch: 'ct' },
]
const stats = calculateCampusStats(campusStudents, branchMap)
assert.equal(stats.totalStudents, 2)
assert.equal(stats.totalSolved, 70)
assert.equal(stats.activeBranchCount, 2)

// 6. processLeaderboardStudents (filtering, tie-breaking, rank assignment)
const unranked = [
  { name: 'Charlie', leetcode: 50, total: 500, branch: 'cs', year: '2025' },
  { name: 'Alice', leetcode: 70, total: 100, branch: 'cs', year: '2025' },
  { name: 'Bob', leetcode: 70, total: 700, branch: 'ct', year: '2025' },
]
const ranked = processLeaderboardStudents(unranked, { selectedBranch: 'ALL', selectedYear: 'ALL', searchQuery: '' }, branchMap)
assert.equal(ranked.length, 3)
assert.equal(ranked[0].name, 'Alice')
assert.equal(ranked[0].rank, 1)
assert.equal(ranked[1].name, 'Bob')
assert.equal(ranked[1].rank, 2)
assert.equal(ranked[2].name, 'Charlie')
assert.equal(ranked[2].rank, 3)
assert.deepEqual(ranked.map((student) => student.total), [70, 70, 50])

// Filter by branch
const cstOnly = processLeaderboardStudents(unranked, { selectedBranch: 'CST', selectedYear: 'ALL', searchQuery: '' }, branchMap)
assert.equal(cstOnly.length, 1)
assert.equal(cstOnly[0].name, 'Bob')
assert.equal(cstOnly[0].rank, 1)

// 7. getStudentByIdentifier
const sample = [
  { usn: 'test-usn-1', username: 'sample_one', name: 'Student One' },
  { usn: 'test-usn-2', username: 'sample_two', name: 'Student Two' },
]
assert.equal(getStudentByIdentifier(sample, 'Sample_One')?.name, 'Student One')
assert.equal(getStudentByIdentifier(sample, 'TEST-USN-2')?.name, 'Student Two')
assert.equal(getStudentByIdentifier(sample, 'unknown'), null)

// 8. computeStudentProfileData
const profileStudent = { usn: 'test-usn-1', username: 'sample_one', name: 'Student One', leetcode: 500, total: 500, branch: 'ct', year: '2025' }
const profileData = computeStudentProfileData(profileStudent, [profileStudent, ...unranked], branchMap)
assert.equal(profileData.student.name, 'Student One')
assert.equal(profileData.student.totalSolved, 500)
assert.equal(profileData.lcEasy + profileData.lcMedium + profileData.lcHard, 500)
assert.ok(profileData.badges.length > 0)

console.log('✓ All studentAnalytics unit tests passed successfully!')
