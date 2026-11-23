/**
 * Auth Service — thin wrappers around Supabase Auth.
 *
 * Every auth operation goes through this module so the rest of the app
 * never imports the Supabase client directly for auth purposes.
 */
import { supabase } from './supabaseClient.js'
import { createAuthService } from './authServiceCore.js'

const authService = createAuthService(supabase.auth)

export const {
  isAllowedEmail,
  sendOtp,
  signUp,
  signInWithPassword,
  verifyOtp,
  verifySignupOtp,
  resendSignupOtp,
  requestPasswordReset,
  updatePassword,
  signOut,
} = authService

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
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
  return data.subscription
}
