import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RouteLoading } from '@/components/shared/route-loading'
import { RestrictedState } from '@/components/shared/restricted-state'
import { useAuth } from '@/hooks/use-auth'
import { canAccessPath } from '@/lib/navigation'

/** Redirects to /login without a (mock) session. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <RouteLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * UI-level role check so users do not land on screens meant for other roles.
 * This is NOT security: authorization must be enforced by the backend API.
 */
export function RequireRoleAccess() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (user && !canAccessPath(user.role, pathname)) return <RestrictedState />
  return <Outlet />
}
