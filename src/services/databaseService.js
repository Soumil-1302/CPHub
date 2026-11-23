/**
 * Database Service — CRUD operations for profiles and leetcode_stats.
 *
 * Every Supabase table query goes through this module so components
 * never import the Supabase client directly for data access.
 */
import { supabase } from './supabaseClient'

// ═══════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════

/**
 * Fetches the current user's own profile.
 * @returns {{ data: object|null, error: object|null }}
 */
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Not signed in' } }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { data, error }
}

/**
 * Fetches a profile by user ID.
 */
export async function getProfileById(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

/**
 * Fetches a profile by USN (case-insensitive).
 */
export async function getProfileByUsn(usn) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('usn', usn)
    .single()

  return { data, error }
}

/**
 * Fetches a profile by LeetCode username.
 */
export async function getProfileByLeetcodeUsername(lcUsername) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('leetcode_username', lcUsername)
    .single()

  return { data, error }
}

/**
 * Updates the current user's profile.
 * Only pass the fields you want to change.
 * @param {Object} updates - { display_name?, usn?, branch?, graduation_year?, leetcode_username? }
 */
export async function updateMyProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Not signed in' } }

  // Only allow safe fields — never let the caller set id or created_at
  const safe = {}
  const allowed = ['display_name', 'usn', 'branch', 'graduation_year', 'leetcode_username']
  for (const key of allowed) {
    if (key in updates) {
      safe[key] = updates[key]
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(safe)
    .eq('id', user.id)
    .select()
    .single()

  return { data, error }
}

/**
 * Fetches a public, paginated leaderboard from the FastAPI backend.
 */
export async function getLeaderboard({
  limit = 20,
  offset = 0,
  branch,
  graduationYear,
  sortBy = 'total_solved',
  sortOrder = 'desc',
  search,
} = {}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (!apiBaseUrl) {
    return { data: null, error: { message: 'The CPHub API is not configured.' } }
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort_by: sortBy,
    sort_order: sortOrder,
  })
  if (branch && branch !== 'ALL') params.set('branch', branch)
  if (graduationYear && graduationYear !== 'ALL') params.set('year', graduationYear)
  if (search?.trim()) params.set('search', search.trim())

  let response
  try {
    response = await fetch(
      `${apiBaseUrl.replace(/\/+$/, '')}/api/leaderboard?${params.toString()}`,
      { headers: { Accept: 'application/json' } },
    )
  } catch {
    return { data: null, error: { message: 'Unable to connect to the CPHub API.' } }
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    return { data: null, error: { message: 'The CPHub API returned an invalid response.' } }
  }
  if (!response.ok || payload?.success !== true) {
    return {
      data: null,
      error: { message: payload?.error?.message || 'Unable to load the leaderboard.' },
    }
  }

  return { data: payload.data, error: null }
}

// ═══════════════════════════════════════════
// LEETCODE STATS
// ═══════════════════════════════════════════

/**
 * Fetches LeetCode stats for a given user.
 */
export async function getLeetcodeStats(userId) {
  const { data, error } = await supabase
    .from('leetcode_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return { data, error }
}

/**
 * Requests a server-side LeetCode refresh for the signed-in user.
 * The browser sends no LeetCode request or credentials.
 */
export async function refreshMyLeetcodeStats() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { data: null, error: sessionError }
  if (!session?.access_token) {
    return { data: null, error: { message: 'Sign in before refreshing LeetCode stats.' } }
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (!apiBaseUrl) {
    return { data: null, error: { message: 'The CPHub API is not configured.' } }
  }

  let response
  try {
    response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/leetcode/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/json',
      },
    })
  } catch {
    return {
      data: null,
      error: { message: 'Unable to connect to the CPHub API. Please try again later.' },
    }
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    return {
      data: null,
      error: { message: 'The CPHub API returned an invalid response.' },
    }
  }

  const data = {
    stats: payload?.data || null,
    cached: payload?.cached === true,
    fetch_status: payload?.success ? 'success' : 'error',
    retry_after_seconds: payload?.error?.retry_after_seconds,
  }
  const error = response.ok
    ? null
    : { message: payload?.error?.message || 'Could not refresh LeetCode stats.' }

  return { data, error }
}
