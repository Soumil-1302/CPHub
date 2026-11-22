/**
 * Auth Service — thin wrappers around Supabase Auth.
 *
 * Every auth operation goes through this module so the rest of the app
 * never imports the Supabase client directly for auth purposes.
 */
import { supabase } from './supabaseClient'
import { ALLOWED_EMAIL_DOMAIN } from '../constants/auth'

/**
 * Validates that an email belongs to the allowed university domain.
 * Uses an exact domain match — no broad suffix check.
 */
export function isAllowedEmail(email) {
  if (!email || typeof email !== 'string') return false
  const clean = email.trim().toLowerCase()
  // Must be valid shape AND end with exactly @<allowed domain>
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) &&
    clean.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
  )
}

/**
 * Sends a one-time-password to the given email via Supabase.
 * Supabase delivers a 6-digit code to the inbox.
 * @returns {{ ok: boolean, message: string }}
 */
export async function sendOtp(email) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // We want a code the user types in, not a magic-link click
        shouldCreateUser: true,
      },
    })
    if (error) {
      return { ok: false, message: error.message }
    }
    return { ok: true, message: 'Verification code sent.' }
  } catch (err) {
    return { ok: false, message: err.message || 'Network error' }
  }
}

/**
 * Verifies the OTP code the user entered.
 * @returns {{ ok: boolean, message: string, session?: object, user?: object }}
 */
export async function verifyOtp(email, token) {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    })
    if (error) {
      // Supabase returns "Token has expired or is invalid" for wrong/expired codes
      const isExpired =
        error.message.toLowerCase().includes('expired') ||
        error.message.toLowerCase().includes('invalid')
      return {
        ok: false,
        message: isExpired
          ? 'That code has expired or is incorrect. Please request a new one.'
          : error.message,
        expired: isExpired,
      }
    }
    return {
      ok: true,
      message: 'Signed in successfully.',
      session: data.session,
      user: data.user,
    }
  } catch (err) {
    return { ok: false, message: err.message || 'Network error' }
  }
}

/**
 * Signs the current user out and clears the local session.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { ok: !error, message: error?.message || 'Signed out.' }
}

/**
 * Returns the current session (or null) from local storage / cookies.
 * This is synchronous-ish — Supabase resolves it from persisted state.
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Subscribes to auth state changes (sign in, sign out, token refresh).
 * Returns the subscription object — call .unsubscribe() to clean up.
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return data.subscription
}
