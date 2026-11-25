import { useContext } from 'react'
import AuthContext from './authContextStore'

/**
 * Hook to access auth state from any component.
 * @returns {{ user: object|null, session: object|null, loading: boolean, signOut: () => Promise }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return ctx
}
