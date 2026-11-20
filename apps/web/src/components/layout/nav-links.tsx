import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { NavItem } from '@/lib/navigation'

interface NavLinksProps {
  items: NavItem[]
  onNavigate?: () => void
}

/** Shared by the desktop Sidebar and the MobileNavigation drawer. */
export function NavLinks({ items, onNavigate }: NavLinksProps) {
  return (
    <ul className="space-y-1">
      {items.map(({ label, path, icon: Icon }) => (
        <li key={path}>
          <NavLink
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium',
                isActive ? 'bg-blue-50 text-primary' : 'text-ink hover:bg-neutral-bg',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
