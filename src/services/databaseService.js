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
 * Fetches all profiles, ordered by total solved (via a joined stats query).
 * Used for the leaderboard.
 * @param {Object} options - { limit?, offset?, branch?, graduation_year? }
 */
export async function getLeaderboard({
  limit = 100,
  offset = 0,
  branch,
  graduationYear,
} = {}) {
  let query = supabase
    .from('profiles')
    .select(`
      *,
      leetcode_stats (
        solved_total,
        easy_solved,
        medium_solved,
        hard_solved,
        fetched_at,
        fetch_status
      )
    `)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (branch) {
    query = query.eq('branch', branch)
  }
  if (graduationYear) {
    query = query.eq('graduation_year', graduationYear)
  }

  const { data, error } = await query

  return { data, error }
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
  const { data, error } = await supabase.functions.invoke('leetcode-refresh', {
    body: {},
  })
  return { data, error }
}
