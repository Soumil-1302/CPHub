import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { beforeEach, test } from 'node:test'
import { createAuthService } from './authServiceCore.js'
import {
  createRequestLock,
  getOtpCooldownSeconds,
  tryAcquireOtpRequest,
  withOtpCooldown,
} from '../utils/otpRequestControls.js'

let sendOtpResponse
let signUpResponse
let signInResponse
let verifyOtpResponse
let resendResponse
let resetResponse
let updatePasswordResponse
let signOutResponse
let sentOtpCalls
let verifiedOtpCalls
let signOutCalls

const mockedSupabaseAuth = {
  signInWithOtp: (...args) => {
    sentOtpCalls.push(args[0])
    return sendOtpResponse(...args)
  },
  signUp: (...args) => signUpResponse(...args),
  signInWithPassword: (...args) => signInResponse(...args),
  verifyOtp: (...args) => {
    verifiedOtpCalls.push(args[0])
    return verifyOtpResponse(...args)
  },
  resend: (...args) => resendResponse(...args),
  resetPasswordForEmail: (...args) => resetResponse(...args),
  updateUser: (...args) => updatePasswordResponse(...args),
  signOut: (...args) => {
    signOutCalls += 1
    return signOutResponse(...args)
  },
}

const {
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
} = createAuthService(mockedSupabaseAuth)

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  sendOtpResponse = async () => ({ error: null })
  signUpResponse = async () => ({
    data: { user: { id: 'user-123', identities: [{ id: 'identity-1' }] } },
    error: null,
  })
  signInResponse = async () => ({
    data: {
      session: { access_token: 'test-access-token' },
      user: { id: 'user-123', email_confirmed_at: '2026-11-23T00:00:00Z' },
    },
    error: null,
  })
  verifyOtpResponse = async () => ({
    data: { session: { access_token: 'test-access-token' }, user: { id: 'user-123' } },
    error: null,
  })
  resendResponse = async () => ({ error: null })
  resetResponse = async () => ({ error: null })
  updatePasswordResponse = async () => ({ data: { user: { id: 'user-123' } }, error: null })
  signOutResponse = async () => ({ error: null })
  sentOtpCalls = []
  verifiedOtpCalls = []
  signOutCalls = 0
})

test('creates password account through Supabase Auth and then verifies signup OTP', async () => {
  let signupRequest
  signUpResponse = async (request) => {
    signupRequest = request
    return {
      data: { user: { id: 'new-user', identities: [{ id: 'new-identity' }] }, session: null },
      error: null,
    }
  }
  const signupResult = await signUp(' Student@DSU.CP.IN ', 'secure-password')
  assert.equal(signupResult.ok, true)
  assert.deepEqual(signupRequest, {
    email: 'student@dsu.cp.in',
    password: 'secure-password',
  })

  const verification = await verifySignupOtp('student@dsu.cp.in', '012345')
  assert.equal(verification.ok, true)
  assert.deepEqual(verifiedOtpCalls.at(-1), {
    email: 'student@dsu.cp.in',
    token: '012345',
    type: 'signup',
  })
})

test('handles duplicate email signup responses and errors', async () => {
  signUpResponse = async () => ({
    data: { user: { id: 'existing-user', identities: [] }, session: null },
    error: null,
  })
  const existingIdentity = await signUp('student@dsu.cp.in', 'password')
  assert.equal(existingIdentity.category, 'duplicate_email')

  signUpResponse = async () => ({
    data: null,
    error: { code: 'user_already_exists', message: 'User already registered' },
  })
  const alreadyRegistered = await signUp('student@dsu.cp.in', 'password')
  assert.equal(alreadyRegistered.category, 'duplicate_email')
})

test('signs in using Supabase password auth and blocks unverified users', async () => {
  let signInRequest
  signInResponse = async (request) => {
    signInRequest = request
    return {
      data: {
        session: { access_token: 'test-access-token' },
        user: { id: 'user-123', email_confirmed_at: '2026-11-23T00:00:00Z' },
      },
      error: null,
    }
  }
  const result = await signInWithPassword('Student@DSU.CP.IN', 'password')
  assert.equal(result.ok, true)
  assert.deepEqual(signInRequest, { email: 'student@dsu.cp.in', password: 'password' })

  signInResponse = async () => ({
    data: { session: null, user: { id: 'unverified-user' } },
    error: null,
  })
  assert.equal((await signInWithPassword('student@dsu.cp.in', 'password')).category, 'unverified_email')
})

test('shows a password-specific message for invalid login credentials', async () => {
  signInResponse = async () => ({
    data: null,
    error: { message: 'Invalid login credentials' },
  })
  const result = await signInWithPassword('student@dsu.cp.in', 'wrong-password')
  assert.equal(result.category, 'invalid_credentials')
  assert.equal(result.message, 'Your email or password is incorrect.')
})

test('resends signup confirmation using the Supabase Auth resend method', async () => {
  let resendRequest
  resendResponse = async (request) => {
    resendRequest = request
    return { error: null }
  }
  assert.equal((await resendSignupOtp('Student@DSU.CP.IN')).ok, true)
  assert.deepEqual(resendRequest, { type: 'signup', email: 'student@dsu.cp.in' })
})

test('requests and completes password recovery through Supabase Auth', async () => {
  const originalWindow = globalThis.window
  globalThis.window = { location: { origin: 'https://cphub.example' } }
  try {
    let resetRequest
    resetResponse = async (...args) => {
      resetRequest = args
      return { error: null }
    }
    assert.equal((await requestPasswordReset('student@dsu.cp.in')).ok, true)
    assert.deepEqual(resetRequest, [
      'student@dsu.cp.in',
      { redirectTo: 'https://cphub.example/login?mode=recovery' },
    ])
    assert.equal((await updatePassword('new-secure-password')).ok, true)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('validates university email domains and blocks unsupported addresses', async () => {
  assert.equal(isAllowedEmail('Student@dsu.cp.in'), true)
  assert.equal(isAllowedEmail('Student@dsu.edu.in'), true)
  assert.equal(isAllowedEmail('student@gmail.com'), false)
  assert.equal(isAllowedEmail('student@notdsu.edu.in'), false)
  assert.equal(isAllowedEmail('not-an-email'), false)

  const result = await sendOtp('student@gmail.com')
  assert.equal(result.category, 'unsupported_email')
  assert.match(result.message, /@dsu\.cp\.in or @dsu\.edu\.in/)
  assert.equal(sentOtpCalls.length, 0)
})

test('requests signup OTP through Supabase without an external sender', async () => {
  const result = await sendOtp(' Student@DSU.CP.IN ')
  assert.equal(result.ok, true)
  assert.deepEqual(sentOtpCalls, [{
    email: 'student@dsu.cp.in',
    options: { shouldCreateUser: true },
  }])
})

test('allows OTP requests for the alternate university domain', async () => {
  const result = await sendOtp(' Student@DSU.EDU.IN ')
  assert.equal(result.ok, true)
  assert.deepEqual(sentOtpCalls, [{
    email: 'student@dsu.edu.in',
    options: { shouldCreateUser: true },
  }])
})

test('verifies a six-digit OTP with the Supabase email OTP type', async () => {
  const result = await verifyOtp('student@dsu.cp.in', '012345')
  assert.equal(result.ok, true)
  assert.equal(result.user.id, 'user-123')
  assert.equal(result.session.access_token, 'test-access-token')
  assert.deepEqual(verifiedOtpCalls, [{
    email: 'student@dsu.cp.in',
    token: '012345',
    type: 'email',
  }])
})

test('rejects malformed or incorrect OTPs', async () => {
  const malformed = await verifyOtp('student@dsu.cp.in', '12345x')
  assert.equal(malformed.category, 'invalid_otp')
  assert.equal(verifiedOtpCalls.length, 0)

  verifyOtpResponse = async () => ({ data: null, error: { message: 'Invalid OTP' } })
  const incorrect = await verifyOtp('student@dsu.cp.in', '123456')
  assert.equal(incorrect.category, 'invalid_otp')
  assert.equal(incorrect.message, 'The verification code is incorrect.')
})

test('reports expired OTPs with a resend instruction', async () => {
  verifyOtpResponse = async () => ({
    data: null,
    error: { code: 'otp_expired', message: 'Token has expired or is invalid' },
  })
  const result = await verifyOtp('student@dsu.cp.in', '123456')
  assert.equal(result.expired, true)
  assert.equal(result.message, 'Your verification code has expired. Request a new one.')
})

test('permits resend after the configured 60-second cooldown', async () => {
  const firstExpiration = withOtpCooldown({}, 'student@dsu.cp.in', 1000)
  assert.equal(getOtpCooldownSeconds(firstExpiration, 'STUDENT@DSU.CP.IN', 60999), 1)
  assert.equal(getOtpCooldownSeconds(firstExpiration, 'student@dsu.cp.in', 61000), 0)

  assert.equal((await sendOtp('student@dsu.cp.in')).ok, true)
  assert.equal((await sendOtp('student@dsu.cp.in')).ok, true)
  assert.equal(sentOtpCalls.length, 2)
})

test('keeps cooldowns isolated per normalized email and prevents early resend', () => {
  const expirations = withOtpCooldown({}, 'Student@DSU.CP.IN', 1000)
  assert.equal(getOtpCooldownSeconds(expirations, 'student@dsu.cp.in', 30000), 31)
  assert.equal(getOtpCooldownSeconds(expirations, 'other@dsu.cp.in', 30000), 0)
  const lock = createRequestLock()
  assert.equal(tryAcquireOtpRequest(lock, expirations, 'student@dsu.cp.in', 30000), false)
  assert.equal(tryAcquireOtpRequest(lock, expirations, 'student@dsu.cp.in', 61000), true)
  lock.release()
})

test('prevents multiple rapid resend clicks from issuing concurrent requests', async () => {
  const lock = createRequestLock()
  const pending = deferred()
  let requestCount = 0
  sendOtpResponse = () => {
    requestCount += 1
    return pending.promise
  }

  async function guardedResend() {
    if (!tryAcquireOtpRequest(lock, {}, 'student@dsu.cp.in', 1000)) return
    try {
      await sendOtp('student@dsu.cp.in')
    } finally {
      lock.release()
    }
  }

  const first = guardedResend()
  const second = guardedResend()
  const third = guardedResend()
  assert.equal(requestCount, 1)
  pending.resolve({ error: null })
  await Promise.all([first, second, third])
  assert.equal(sentOtpCalls.length, 1)
  assert.equal(lock.tryAcquire(), true)
  lock.release()
})

test('maps Supabase rate-limit errors to a safe message', async () => {
  sendOtpResponse = async () => ({
    error: { status: 429, message: 'Sensitive provider response details' },
  })
  const originalWarn = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args)
  try {
    const result = await sendOtp('student@dsu.cp.in')
    assert.equal(result.category, 'rate_limit')
    assert.equal(result.message, 'Too many OTP requests. Please wait before trying again.')
    assert.equal(JSON.stringify(result).includes('Sensitive'), false)
    assert.equal(JSON.stringify(warnings).includes('Sensitive'), false)
  } finally {
    console.warn = originalWarn
  }
})

test('maps SMTP delivery failures without exposing provider response details', async () => {
  sendOtpResponse = async () => ({
    error: { message: 'SMTP delivery failed; secret-api-key=never-show-this' },
  })
  const originalWarn = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args)
  try {
    const result = await sendOtp('student@dsu.cp.in')
    assert.equal(result.category, 'delivery')
    assert.equal(result.message, 'Unable to send your verification email. Please try again later.')
    assert.equal(JSON.stringify(result).includes('never-show-this'), false)
    assert.equal(JSON.stringify(warnings).includes('never-show-this'), false)
  } finally {
    console.warn = originalWarn
  }
})

test('maps network failures to a connectivity message', async () => {
  sendOtpResponse = async () => {
    throw new TypeError('Failed to fetch')
  }
  const result = await sendOtp('student@dsu.cp.in')
  assert.equal(result.category, 'network')
  assert.equal(result.message, 'Unable to connect. Please check your internet connection.')
})

test('reports an unverified email with a clear next step', async () => {
  verifyOtpResponse = async () => ({
    data: null,
    error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
  })
  const result = await verifyOtp('student@dsu.cp.in', '123456')
  assert.equal(result.category, 'unverified_email')
  assert.match(result.message, /not verified/i)
})

test('supports logout followed by another OTP login', async () => {
  assert.equal((await signOut()).ok, true)
  assert.equal(signOutCalls, 1)
  assert.equal((await sendOtp('student@dsu.cp.in')).ok, true)
  assert.equal((await verifyOtp('student@dsu.cp.in', '123456')).ok, true)
})

test('successful verification returns the Auth user id used by the profile trigger', async () => {
  const result = await verifyOtp('student@dsu.cp.in', '012345')
  assert.equal(result.user.id, 'user-123')
  const schema = await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
  const trigger = schema.match(/create or replace function public\.handle_new_user\(\)[\s\S]*?\$\$;/)
  assert.ok(trigger)
  assert.match(trigger[0], /insert into public\.profiles \(id, display_name\)[\s\S]*?new\.id/)
  assert.match(schema, /after insert on auth\.users[\s\S]*?execute function public\.handle_new_user\(\)/)

  const databaseService = await readFile(new URL('./databaseService.js', import.meta.url), 'utf8')
  assert.match(databaseService, /supabase\.auth\.getUser\(\)/)
  assert.match(databaseService, /from\('profiles'\)[\s\S]*?eq\('id', user\.id\)/)
})
