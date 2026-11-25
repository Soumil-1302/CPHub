/**
 * AuthContext — provides { user, session, loading, signOut } to the whole app.
 *
 * Restores the existing Supabase session on page reload and listens for
 * auth state changes (sign-in, sign-out, token refresh) in real time.
 */
import { useState, useEffect } from 'react'
import {
  getSession,
  onAuthStateChange,
  signOut as authSignOut,
} from '../services/authService'

import AuthContext from './authContextStore'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true while restoring
  const [authEvent, setAuthEvent] = useState(null)

  useEffect(() => {
    // 1. Restore persisted session on mount
    let cancelled = false
    getSession().then((restoredSession) => {
      if (cancelled) return
      setSession(restoredSession)
      setUser(restoredSession?.user ?? null)
      setLoading(false)
    })

    // 2. Listen for future auth changes
    const subscription = onAuthStateChange((event, newSession) => {
      setAuthEvent(event)
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    await authSignOut()
    // State will be updated by the onAuthStateChange listener
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, authEvent, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
