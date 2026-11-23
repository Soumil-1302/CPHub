import { supabase } from './supabaseClient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const STATUS_MESSAGES = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested CPHub resource was not found.',
  500: 'The CPHub server encountered an error. Please try again later.',
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'api_error', details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new ApiError('Unable to verify your sign-in session. Please sign in again.', {
      status: 401,
      code: 'session_unavailable',
    })
  }

  let session = data?.session
  if (!session?.access_token) {
    throw new ApiError('Sign in to continue.', { status: 401, code: 'session_required' })
  }

  if (
    typeof session.expires_at === 'number' &&
    session.expires_at * 1000 <= Date.now() + 30_000
  ) {
    const refreshed = await supabase.auth.refreshSession()
    session = refreshed.data?.session
    if (refreshed.error || !session?.access_token) {
      throw new ApiError('Your session has expired. Please sign in again.', {
        status: 401,
        code: 'session_expired',
      })
    }
  }

  return session.access_token
}

async function parseResponse(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(
      STATUS_MESSAGES[response.status] || 'The CPHub server returned an invalid response.',
      { status: response.status, code: 'invalid_response' },
    )
  }

  if (!response.ok || payload?.success === false) {
    const backendError = payload?.error
    const message =
      (typeof backendError?.message === 'string' && backendError.message) ||
      STATUS_MESSAGES[response.status] ||
      'The request could not be completed. Please try again.'
    throw new ApiError(message, {
      status: response.status,
      code: backendError?.code || `http_${response.status}`,
      details: backendError?.details || null,
    })
  }

  return payload?.data ?? payload
}

export async function apiRequest(path, { auth = false, ...options } = {}) {
  if (!API_BASE_URL) {
    throw new ApiError('The CPHub API is not configured.', { code: 'api_not_configured' })
  }

  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) headers.set('Authorization', `Bearer ${await getAccessToken()}`)

  let response
  try {
    response = await fetch(
      `${API_BASE_URL.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
      { ...options, headers },
    )
  } catch {
    throw new ApiError('Unable to connect to the CPHub API. Check your connection and try again.', {
      code: 'network_error',
    })
  }
  return parseResponse(response)
}

export function getApiErrorMessage(error, fallback = 'The request could not be completed.') {
  return error instanceof ApiError && error.message ? error.message : fallback
}
