import { OTP_RESEND_COOLDOWN_SECONDS } from '../constants/auth.js'

export function createRequestLock() {
  let locked = false

  return {
    tryAcquire() {
      if (locked) return false
      locked = true
      return true
    },
    release() {
      locked = false
    },
  }
}

export function withOtpCooldown(expirations, email, now = Date.now()) {
  const key = email.trim().toLowerCase()
  return {
    ...expirations,
    [key]: now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
  }
}

export function getOtpCooldownSeconds(expirations, email, now) {
  const key = email.trim().toLowerCase()
  return Math.max(0, Math.ceil(((expirations[key] ?? 0) - now) / 1000))
}

export function tryAcquireOtpRequest(lock, expirations, email, now) {
  if (getOtpCooldownSeconds(expirations, email, now) > 0) return false
  return lock.tryAcquire()
}
