import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchLeetCodeStats,
  normalizeLeetCodeUsername,
  LeetCodeProviderError,
} from '../_shared/leetcodeProvider.js'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MIN_REQUEST_INTERVAL_SECONDS = 300
const FETCH_LEASE_SECONDS = 30

interface LeetCodeStats {
  provider_username: string
  solved_total: number
  easy_solved: number
  medium_solved: number
  hard_solved: number
  submission_calendar: Record<string, number>
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'content-type': 'application/json',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  stats: Record<string, unknown> | null = null,
  retryAfterSeconds?: number,
) {
  return jsonResponse({
    error: { code, message },
    fetch_status: 'error',
    stats,
    ...(retryAfterSeconds ? { retry_after_seconds: retryAfterSeconds } : {}),
  }, status)
}

function isStatsRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST to refresh LeetCode stats.')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('LeetCode refresh function is missing Supabase configuration.')
    return errorResponse(500, 'server_configuration_error', 'The stats service is not configured.')
  }

  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) {
    return errorResponse(401, 'unauthorized', 'Sign in before refreshing LeetCode stats.')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'invalid_request', 'Request body must be valid JSON.')
  }
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 0
  ) {
    return errorResponse(400, 'invalid_request', 'This function accepts an empty JSON object only.')
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
  if (authError || !authData.user) {
    return errorResponse(401, 'unauthorized', 'Your session is invalid or expired.')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('leetcode_username')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (profileError) {
    console.error('Could not load the requesting user profile:', profileError.message)
    return errorResponse(500, 'profile_lookup_failed', 'Could not load your profile.')
  }
  if (!profile?.leetcode_username) {
    return errorResponse(400, 'leetcode_username_required', 'Add your LeetCode username to your profile first.')
  }

  let username: string
  try {
    username = normalizeLeetCodeUsername(profile.leetcode_username)
  } catch {
    return errorResponse(400, 'invalid_username', 'Your saved LeetCode username has an invalid format.')
  }

  const { data: previousStats, error: statsError } = await adminClient
    .from('leetcode_stats')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (statsError) {
    console.error('Could not load cached LeetCode stats:', statsError.message)
    return errorResponse(500, 'stats_lookup_failed', 'Could not load cached LeetCode stats.')
  }

  const hasFreshStats =
    isStatsRow(previousStats) &&
    previousStats.provider_username === username &&
    previousStats.fetch_status === 'success' &&
    typeof previousStats.fetched_at === 'string' &&
    Date.now() - Date.parse(previousStats.fetched_at) < CACHE_TTL_MS
  if (hasFreshStats) {
    return jsonResponse({ fetch_status: 'success', cached: true, stats: previousStats })
  }

  const { data: claimData, error: claimError } = await adminClient.rpc('claim_leetcode_fetch', {
    p_username: username,
    p_user_id: authData.user.id,
    p_min_interval_seconds: MIN_REQUEST_INTERVAL_SECONDS,
    p_lease_seconds: FETCH_LEASE_SECONDS,
  })
  if (claimError) {
    console.error('Could not claim LeetCode refresh:', claimError.message)
    return errorResponse(500, 'refresh_claim_failed', 'Could not start a stats refresh.', isStatsRow(previousStats) ? previousStats : null)
  }

  const claim = Array.isArray(claimData) ? claimData[0] : null
  if (!claim?.claimed || typeof claim.attempt_token !== 'string') {
    const retryAfter = Math.max(1, Number(claim?.retry_after_seconds) || MIN_REQUEST_INTERVAL_SECONDS)
    return errorResponse(
      429,
      claim?.reason === 'in_progress' ? 'refresh_in_progress' : 'refresh_rate_limited',
      claim?.reason === 'in_progress'
        ? 'A refresh for this LeetCode profile is already running.'
        : 'Please wait before refreshing these stats again.',
      isStatsRow(previousStats) ? previousStats : null,
      retryAfter,
    )
  }

  let fetchedStats: LeetCodeStats
  try {
    fetchedStats = await fetchLeetCodeStats(username)
  } catch (error) {
    const code = error instanceof LeetCodeProviderError ? error.code : 'provider_error'
    const { error: saveError } = await adminClient.rpc('finish_leetcode_fetch_error', {
      p_username: username,
      p_user_id: authData.user.id,
      p_attempt_token: claim.attempt_token,
      p_error_code: code,
    })
    if (saveError) {
      console.error('Could not save LeetCode provider failure status:', saveError.message)
      return errorResponse(500, 'status_persistence_failed', 'The refresh failed and its status could not be saved.', isStatsRow(previousStats) ? previousStats : null)
    }

    console.warn('LeetCode stats refresh failed:', code)
    return errorResponse(
      code === 'upstream_rate_limited' ? 429 : 502,
      code,
      error instanceof Error ? error.message : 'LeetCode stats could not be refreshed.',
      isStatsRow(previousStats) ? previousStats : null,
    )
  }

  const { data: savedStats, error: saveError } = await adminClient.rpc('finish_leetcode_fetch_success', {
    p_username: username,
    p_user_id: authData.user.id,
    p_attempt_token: claim.attempt_token,
    p_provider_username: fetchedStats.provider_username,
    p_solved_total: fetchedStats.solved_total,
    p_easy_solved: fetchedStats.easy_solved,
    p_medium_solved: fetchedStats.medium_solved,
    p_hard_solved: fetchedStats.hard_solved,
    p_submission_calendar: fetchedStats.submission_calendar,
  })
  const persistedStats = Array.isArray(savedStats) ? savedStats[0] : savedStats
  if (saveError || !persistedStats) {
    console.error('Could not persist validated LeetCode stats:', saveError?.message ?? 'No row returned')
    return errorResponse(500, 'stats_persistence_failed', 'Stats were retrieved but could not be saved.', isStatsRow(previousStats) ? previousStats : null)
  }

  return jsonResponse({ fetch_status: 'success', cached: false, stats: persistedStats })
})
