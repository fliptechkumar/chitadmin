import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { loadSession, setSignedOutHandler, signIn, signOut } from './client'
import type { SessionUser } from './types'
import { clearCache } from './useApi'

type AuthValue = {
  /** Undefined while the stored session is being read. */
  user: SessionUser | null | undefined
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)

  useEffect(() => {
    setSignedOutHandler(() => {
      clearCache()
      setUser(null)
    })
    loadSession().then((s) => setUser(s?.user ?? null))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      login: async (username, password) => {
        const u = await signIn(username, password)
        clearCache()
        setUser(u)
      },
      logout: async () => {
        await signOut()
        clearCache()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
