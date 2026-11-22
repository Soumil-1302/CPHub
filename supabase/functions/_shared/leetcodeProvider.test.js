import assert from 'node:assert/strict'
import {
  fetchLeetCodeStats,
  normalizeLeetCodeUsername,
  validateLeetCodeResponse,
} from './leetcodeProvider.js'

const validPayload = {
  data: {
    matchedUser: {
      username: 'sample_user',
      submitStats: {
        acSubmissionNum: [
          { difficulty: 'All', count: 10 },
          { difficulty: 'Easy', count: 3 },
          { difficulty: 'Medium', count: 5 },
          { difficulty: 'Hard', count: 2 },
        ],
      },
      submissionCalendar: JSON.stringify({ '1700000000': 4 }),
    },
  },
}

assert.equal(normalizeLeetCodeUsername(' sample_user '), 'sample_user')
assert.throws(() => normalizeLeetCodeUsername('https://leetcode.com/u/sample_user'))

const stats = validateLeetCodeResponse(validPayload, 'SAMPLE_USER')
assert.deepEqual(stats, {
  provider_username: 'sample_user',
  solved_total: 10,
  easy_solved: 3,
  medium_solved: 5,
  hard_solved: 2,
  submission_calendar: { '1700000000': 4 },
})

assert.throws(
  () => validateLeetCodeResponse(validPayload, 'different_user'),
  /different profile/,
)

const inconsistentPayload = structuredClone(validPayload)
inconsistentPayload.data.matchedUser.submitStats.acSubmissionNum[1].count = 4
assert.throws(
  () => validateLeetCodeResponse(inconsistentPayload, 'sample_user'),
  /inconsistent solve totals/,
)

const malformedCalendarPayload = structuredClone(validPayload)
malformedCalendarPayload.data.matchedUser.submissionCalendar = '{"not-a-timestamp":1}'
assert.throws(
  () => validateLeetCodeResponse(malformedCalendarPayload, 'sample_user'),
  /malformed calendar entries/,
)

let requestedUrl
let requestOptions
const fetchedStats = await fetchLeetCodeStats('sample_user', {
  fetchImpl: async (url, options) => {
    requestedUrl = url
    requestOptions = options
    return new Response(JSON.stringify(validPayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  },
})
assert.equal(requestedUrl, 'https://leetcode.com/graphql/')
assert.equal(requestOptions.method, 'POST')
assert.ok(requestOptions.signal)
assert.equal('authorization' in requestOptions.headers, false)
assert.equal('cookie' in requestOptions.headers, false)
assert.deepEqual(JSON.parse(requestOptions.body).variables, { username: 'sample_user' })
assert.equal(fetchedStats.solved_total, 10)

await assert.rejects(
  fetchLeetCodeStats('sample_user', {
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  }),
  /HTTP 503/,
)

await assert.rejects(
  fetchLeetCodeStats('sample_user', {
    timeoutMs: 1,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error('Expected request timeout')), 100)
      signal.addEventListener('abort', () => {
        clearTimeout(keepAlive)
        reject(signal.reason)
      }, { once: true })
    }),
  }),
  /could not be reached/,
)

console.log('✓ LeetCode provider validation tests passed successfully!')
