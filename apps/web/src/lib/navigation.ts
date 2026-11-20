import {
  AlertOctagon,
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileText,
  Gauge,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types/roles'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Roles that see this item in the navigation. UI convenience only, NOT security. */
  roles: readonly Role[]
}

/**
 * Navigation order follows the blueprint. Role visibility below is an initial assumption
 * derived from the role responsibilities in the master prompt and should be reviewed.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: Gauge, roles: ['administrator', 'manager', 'supervisor'] },
  {
    label: 'Production Orders',
    path: '/production-orders',
    icon: ClipboardList,
    roles: ['manager', 'supervisor', 'operator'],
  },
  {
    label: 'Production Reports',
    path: '/production-reports',
    icon: FileText,
    roles: ['manager', 'supervisor', 'operator'],
  },
  { label: 'Downtime', path: '/downtime', icon: AlertOctagon, roles: ['manager', 'supervisor', 'operator'] },
  { label: 'Quality Control', path: '/quality', icon: ShieldCheck, roles: ['manager', 'supervisor'] },
  { label: 'Approvals', path: '/approvals', icon: CheckSquare, roles: ['supervisor'] },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['manager'] },
  { label: 'Reports', path: '/reports', icon: FileText, roles: ['manager', 'supervisor'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['administrator'] },
]

export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function getDefaultPathForRole(role: Role): string {
  return getNavItemsForRole(role)[0]?.path ?? '/login'
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const item = NAV_ITEMS.find((n) => pathname === n.path || pathname.startsWith(`${n.path}/`))
  return item ? item.roles.includes(role) : true
}
