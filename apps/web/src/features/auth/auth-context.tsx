import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api-client'
import { isApiMode } from '@/lib/config'
import { ROLES, type Role, type SessionUser } from '@/types/roles'

const STORAGE_KEY = 'shopfloor.mock-session'

/**
 * Mock mode: a name + role demo session kept in localStorage.
 * API mode: the real session lives in an httpOnly cookie; this context only mirrors who the server says is signed in.
 */
export interface AuthContextValue {
  user: SessionUser | null
  /** True while API mode is asking the server who is signed in (first page load). */
  loading: boolean
  /** Mock mode only. */
  signIn: (name: string, role: Role) => void
  /** API mode only. Throws ApiError with the server's message. */
  signInWithPassword: (email: string, password: string) => Promise<SessionUser>
  signOut: () => void
  /** Mock mode only (the demo role switcher). */
  switchRole: (role: Role) => void
}

interface ApiUser {
  id: string
  name: string
  role: Role
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.role === 'string' &&
    (ROLES as readonly string[]).includes(v.role)
  )
}

function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSessionUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveSession(user: SessionUser | null): void {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable: session lasts for this page load only */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(isApiMode ? null : loadSession)
  const [loading, setLoading] = useState(isApiMode)

  useEffect(() => {
    if (!isApiMode) return
    let cancelled = false
    api
      .get<{ user: ApiUser }>('/auth/me')
      .then((r) => !cancelled && setUser({ id: r.user.id, name: r.user.name, role: r.user.role }))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((next: SessionUser | null) => {
    setUser(next)
    if (!isApiMode) saveSession(next)
  }, [])

  const signIn = useCallback(
    (name: string, role: Role) => update({ id: 'mock-user', name: name.trim() || 'Demo User', role }),
    [update],
  )
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: ApiUser }>('/auth/login', { email, password })
    const next: SessionUser = { id: r.user.id, name: r.user.name, role: r.user.role }
    setUser(next)
    return next
  }, [])
  const signOut = useCallback(() => {
    if (isApiMode) void api.post('/auth/logout').catch(() => undefined)
    update(null)
  }, [update])
  const switchRole = useCallback(
    (role: Role) => setUser((prev) => {
      if (!prev || isApiMode) return prev
      const next = { ...prev, role }
      saveSession(next)
      return next
    }),
    [],
  )

  const value = useMemo(
    () => ({ user, loading, signIn, signInWithPassword, signOut, switchRole }),
    [user, loading, signIn, signInWithPassword, signOut, switchRole],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
