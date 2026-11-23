import { ALLOWED_EMAIL_DOMAINS, OTP_LENGTH } from '../constants/auth.js'

function classifyAuthError(error) {
  const message = typeof error?.message === 'string' ? error.message : ''
  const code = typeof error?.code === 'string' ? error.code : ''
  const status = Number.isInteger(error?.status) ? error.status : undefined
  const details = `${code} ${message}`.toLowerCase()

  if (status === 429 || /rate.?limit|too many requests|over_email_send_rate_limit/.test(details)) {
    return { category: 'rate_limit', message: 'Too many OTP requests. Please wait before trying again.' }
  }
  if (/already registered|already exists|user_already_exists|email_exists/.test(details)) {
    return {
      category: 'duplicate_email',
      message: 'An account with this email already exists. Sign in instead.',
    }
  }
  if (/invalid login credentials|invalid credentials/.test(details)) {
    return {
      category: 'invalid_credentials',
      message: 'Your email or password is incorrect.',
    }
  }
  if (/otp_expired|token_expired|expired/.test(details)) {
    return { category: 'expired', message: 'Your verification code has expired. Request a new one.' }
  }
  if (/invalid.*(otp|token|code)|(otp|token|code).*(invalid|incorrect)/.test(details)) {
    return { category: 'invalid_otp', message: 'The verification code is incorrect.' }
  }
  if (/email_not_confirmed|email not confirmed|user not confirmed/.test(details)) {
    return {
      category: 'unverified_email',
      message: 'Your email address is not verified. Request a new OTP and enter it to verify your email.',
    }
  }
  if (/smtp|email.*(delivery|send)|send.*email|failed to send|sending.*email|resend/.test(details)) {
    return {
      category: 'delivery',
      message: 'Unable to send your verification email. Please try again later.',
    }
  }
  if (
    error?.name === 'TypeError' ||
    /failed to fetch|network|connection|timed? ?out|internet|load failed/.test(details)
  ) {
    return {
      category: 'network',
      message: 'Unable to connect. Please check your internet connection.',
    }
  }
  return {
    category: 'unknown',
    message: 'Unable to complete your authentication request. Please try again later.',
  }
}

function logAuthFailure(operation, error, category) {
  const status = Number.isInteger(error?.status) ? error.status : undefined
  console.warn('[CPHub auth] Supabase request failed', { operation, category, status })
}

function authFailure(operation, error) {
  const failure = classifyAuthError(error)
  logAuthFailure(operation, error, failure.category)
  return { ok: false, ...failure, expired: failure.category === 'expired' }
}

export function isAllowedEmail(email) {
  if (!email || typeof email !== 'string') return false
  const clean = email.trim().toLowerCase()
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) &&
    ALLOWED_EMAIL_DOMAINS.some((domain) => clean.endsWith(`@${domain}`))
  )
}

export function createAuthService(auth) {
  const allowedDomains = ALLOWED_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(' or ')

  function unsupportedEmailResult() {
    return {
      ok: false,
      category: 'unsupported_email',
      message: `Please use a valid university email address ending in ${allowedDomains}.`,
    }
  }

  async function sendOtp(email) {
    if (!isAllowedEmail(email)) return unsupportedEmailResult()

    try {
      const { error } = await auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })
      if (error) return authFailure('send_otp', error)
      return { ok: true, message: 'Verification code sent.' }
    } catch (error) {
      return authFailure('send_otp', error)
    }
  }

  async function signUp(email, password) {
    if (!isAllowedEmail(email)) return unsupportedEmailResult()
    if (typeof password !== 'string' || password.length === 0) {
      return {
        ok: false,
        category: 'invalid_password',
        message: 'Enter a password to create your account.',
      }
    }

    try {
      const { data, error } = await auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) return authFailure('sign_up', error)
      if (data.user?.identities?.length === 0) {
        return {
          ok: false,
          category: 'duplicate_email',
          message: 'An account with this email already exists. Sign in instead.',
        }
      }
      return {
        ok: true,
        message: 'Account created. Enter the verification code sent to your email.',
        user: data.user,
      }
    } catch (error) {
      return authFailure('sign_up', error)
    }
  }

  async function signInWithPassword(email, password) {
    if (!isAllowedEmail(email)) return unsupportedEmailResult()
    if (typeof password !== 'string' || password.length === 0) {
      return {
        ok: false,
        category: 'invalid_password',
        message: 'Enter your password to sign in.',
      }
    }

    try {
      const { data, error } = await auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) return authFailure('password_sign_in', error)
      if (!data.user?.email_confirmed_at && !data.user?.confirmed_at) {
        return {
          ok: false,
          category: 'unverified_email',
          message: 'Verify your email address before signing in.',
        }
      }
      return {
        ok: true,
        message: 'Signed in successfully.',
        session: data.session,
        user: data.user,
      }
    } catch (error) {
      return authFailure('password_sign_in', error)
    }
  }

  async function verifyOtp(email, token, type = 'email') {
    if (!isAllowedEmail(email)) return unsupportedEmailResult()
    if (typeof token !== 'string' || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(token.trim())) {
      return {
        ok: false,
        category: 'invalid_otp',
        message: 'The verification code is incorrect.',
        expired: false,
      }
    }

    try {
      const { data, error } = await auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type,
      })
      if (error) return authFailure('verify_otp', error)
      return {
        ok: true,
        message: 'Signed in successfully.',
        session: data.session,
        user: data.user,
      }
    } catch (error) {
      return authFailure('verify_otp', error)
    }
  }

  async function verifySignupOtp(email, token) {
    return verifyOtp(email, token, 'signup')
  }

  async function resendSignupOtp(email) {
    if (!isAllowedEmail(email)) return unsupportedEmailResult()

    try {
      const { error } = await auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      })
      if (error) return authFailure('resend_signup_otp', error)
      return { ok: true, message: 'A new verification code has been sent.' }
    } catch (error) {
      return authFailure('resend_signup_otp', error)
    }
  }

  async function requestPasswordReset(email) {
    if (!isAllowedEmail(email)) return unsupportedEmailResult()

    try {
      const redirectTo = `${window.location.origin}/login?mode=recovery`
      const { error } = await auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
      if (error) return authFailure('password_reset', error)
      return {
        ok: true,
        message: 'If an account exists for this email, a password reset email has been sent.',
      }
    } catch (error) {
      return authFailure('password_reset', error)
    }
  }

  async function updatePassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
      return {
        ok: false,
        category: 'invalid_password',
        message: 'Enter a new password.',
      }
    }

    try {
      const { data, error } = await auth.updateUser({ password })
      if (error) return authFailure('password_update', error)
      return { ok: true, message: 'Your password has been updated.', user: data.user }
    } catch (error) {
      return authFailure('password_update', error)
    }
  }

  async function signOut() {
    const { error } = await auth.signOut()
    return { ok: !error, message: error?.message || 'Signed out.' }
  }

  return {
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
  }
}
