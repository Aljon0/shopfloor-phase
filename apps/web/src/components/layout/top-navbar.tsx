import { Bell, ChevronDown, KeyRound, LogOut, Menu, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { useConnectivity } from '@/hooks/use-connectivity'
import { isApiMode } from '@/lib/config'
import { getDefaultPathForRole } from '@/lib/navigation'
import { ROLES, ROLE_LABELS } from '@/types/roles'
import { ChangePasswordDialog } from '@/features/auth/change-password-dialog'
import { Breadcrumbs } from './breadcrumbs'

interface TopNavbarProps {
  onOpenMenu: () => void
}

export function TopNavbar({ onOpenMenu }: TopNavbarProps) {
  const { user, switchRole, signOut } = useAuth()
  const online = useConnectivity()
  const navigate = useNavigate()
  const [changingPassword, setChangingPassword] = useState(false)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={onOpenMenu}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <Badge tone={online ? 'success' : 'danger'} role="status">
        {online ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
        <span className="hidden sm:inline">{online ? 'Connected' : 'Offline'}</span>
        <span className="sr-only sm:hidden">{online ? 'Connected' : 'Offline'}</span>
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <div className="px-3 pb-3 text-sm text-muted">No new notifications.</div>
        </DropdownMenuContent>
      </DropdownMenu>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-primary">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-xs text-muted">{ROLE_LABELS[user.role]}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isApiMode ? <DropdownMenuLabel>{user.name}</DropdownMenuLabel> : <DropdownMenuLabel>Demo: view as role</DropdownMenuLabel>}
            {(isApiMode ? [] : ROLES).map((role) => (
              <DropdownMenuItem
                key={role}
                onSelect={() => {
                  switchRole(role)
                  navigate(getDefaultPathForRole(role))
                }}
              >
                <span className={role === user.role ? 'font-semibold text-primary' : ''}>
                  {ROLE_LABELS[role]}
                </span>
              </DropdownMenuItem>
            ))}
            {isApiMode ? (
              <DropdownMenuItem onSelect={() => setChangingPassword(true)}>
                <KeyRound className="h-4 w-4" aria-hidden="true" /> Change password
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                signOut()
                navigate('/login')
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}
    </header>
  )
}
