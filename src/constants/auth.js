/**
 * Authentication Configuration
 *
 * Single source of truth for auth-related settings.
 * Keep the accepted student email suffixes centralized here.
 */

/** Exact university email domains accepted for authentication. */
export const ALLOWED_EMAIL_DOMAINS = Object.freeze(['dsu.edu.in'])

/** How many digits Supabase email OTP codes have. */
export const OTP_LENGTH = 6

/** Client-side minimum delay between OTP sends to the same email address. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60

/** @deprecated Use OTP_LENGTH. Kept for existing imports. */
export const OTP_CODE_LENGTH = OTP_LENGTH
