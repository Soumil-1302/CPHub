const PROFILE_QUERY = `
  query UserStats($username: String!) {
    matchedUser(username: $username) {
      username
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
      submissionCalendar
    }
  }
`

const MAX_RESPONSE_BYTES = 256 * 1024
const MAX_CALENDAR_ENTRIES = 12_000
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,40}$/

export class LeetCodeProviderError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LeetCodeProviderError'
    this.code = code
  }
}

export function normalizeLeetCodeUsername(username) {
  if (typeof username !== 'string') {
    throw new LeetCodeProviderError('invalid_username', 'A LeetCode username is required.')
  }

  const normalized = username.trim()
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new LeetCodeProviderError('invalid_username', 'The LeetCode username has an invalid format.')
  }

  return normalized.toLowerCase()
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function normalizeCalendar(value) {
  let calendar = value
  if (typeof calendar === 'string') {
    try {
      calendar = JSON.parse(calendar)
    } catch {
      throw new LeetCodeProviderError('invalid_response', 'LeetCode returned an invalid submission calendar.')
    }
  }

  if (!calendar || typeof calendar !== 'object' || Array.isArray(calendar)) {
    throw new LeetCodeProviderError('invalid_response', 'LeetCode returned an invalid submission calendar.')
  }

  const entries = Object.entries(calendar)
  if (entries.length > MAX_CALENDAR_ENTRIES) {
    throw new LeetCodeProviderError('invalid_response', 'The submission calendar exceeded the supported size.')
  }

  for (const [timestamp, count] of entries) {
    if (!/^\d{1,12}$/.test(timestamp) || !isNonNegativeInteger(count)) {
      throw new LeetCodeProviderError('invalid_response', 'LeetCode returned malformed calendar entries.')
    }
  }

  return calendar
}

export function validateLeetCodeResponse(payload, requestedUsername) {
  const username = normalizeLeetCodeUsername(requestedUsername)

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new LeetCodeProviderError('invalid_response', 'LeetCode returned an invalid response.')
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new LeetCodeProviderError('upstream_graphql_error', 'LeetCode could not provide profile statistics.')
  }

  const matchedUser = payload.data?.matchedUser
  if (!matchedUser || typeof matchedUser !== 'object') {
    throw new LeetCodeProviderError('profile_not_found', 'The LeetCode profile was not found or is unavailable.')
  }
  if (
    typeof matchedUser.username !== 'string' ||
    matchedUser.username.toLowerCase() !== username.toLowerCase()
  ) {
    throw new LeetCodeProviderError('username_mismatch', 'LeetCode returned a different profile than requested.')
  }

  const acceptedCounts = matchedUser.submitStats?.acSubmissionNum
  if (!Array.isArray(acceptedCounts)) {
    throw new LeetCodeProviderError('invalid_response', 'LeetCode returned incomplete solve statistics.')
  }

  const counts = new Map()
  for (const item of acceptedCounts) {
    if (
      !item ||
      typeof item.difficulty !== 'string' ||
      !isNonNegativeInteger(item.count) ||
      counts.has(item.difficulty)
    ) {
      throw new LeetCodeProviderError('invalid_response', 'LeetCode returned malformed solve statistics.')
    }
    counts.set(item.difficulty, item.count)
  }

  const requiredDifficulties = ['All', 'Easy', 'Medium', 'Hard']
  if (requiredDifficulties.some((difficulty) => !counts.has(difficulty))) {
    throw new LeetCodeProviderError('invalid_response', 'LeetCode returned incomplete difficulty counts.')
  }

  const solvedTotal = counts.get('All')
  const easySolved = counts.get('Easy')
  const mediumSolved = counts.get('Medium')
  const hardSolved = counts.get('Hard')
  if (easySolved + mediumSolved + hardSolved !== solvedTotal) {
    throw new LeetCodeProviderError('invalid_response', 'LeetCode returned inconsistent solve totals.')
  }

  return {
    provider_username: matchedUser.username,
    solved_total: solvedTotal,
    easy_solved: easySolved,
    medium_solved: mediumSolved,
    hard_solved: hardSolved,
    submission_calendar: normalizeCalendar(matchedUser.submissionCalendar),
  }
}

async function readBoundedBody(response) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new LeetCodeProviderError('response_too_large', 'LeetCode returned an oversized response.')
  }

  if (!response.body) {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new LeetCodeProviderError('response_too_large', 'LeetCode returned an oversized response.')
    }
    return text
  }

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new LeetCodeProviderError('response_too_large', 'LeetCode returned an oversized response.')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export async function fetchLeetCodeStats(
  requestedUsername,
  { fetchImpl = fetch, timeoutMs = 8_000 } = {},
) {
  const username = normalizeLeetCodeUsername(requestedUsername)
  let response
  try {
    response = await fetchImpl('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'CPHub-LeetCode-Stats/1.0',
      },
      body: JSON.stringify({
        query: PROFILE_QUERY,
        variables: { username },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const code = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'upstream_timeout'
      : 'upstream_unavailable'
    throw new LeetCodeProviderError(code, 'The LeetCode stats provider could not be reached.')
  }

  if (!response.ok) {
    const code = response.status === 429 ? 'upstream_rate_limited' : 'upstream_http_error'
    throw new LeetCodeProviderError(code, `LeetCode returned HTTP ${response.status}.`)
  }

  let payload
  try {
    payload = JSON.parse(await readBoundedBody(response))
  } catch (error) {
    if (error instanceof LeetCodeProviderError) throw error
    throw new LeetCodeProviderError('invalid_response', 'LeetCode returned invalid JSON.')
  }

  return validateLeetCodeResponse(payload, username)
}
