/**
 * Authentication Configuration
 *
 * Single source of truth for auth-related settings.
 * To allow a different university, change ALLOWED_EMAIL_DOMAIN here only.
 */

/** Only emails ending with exactly "@<this domain>" may sign in. */
export const ALLOWED_EMAIL_DOMAIN = 'dsu.edu.in'

/** How many digits the OTP code has (matches Supabase default). */
export const OTP_CODE_LENGTH = 6
