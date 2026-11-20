import { Factory } from 'lucide-react'
import { getNavItemsForRole } from '@/lib/navigation'
import { useAuth } from '@/hooks/use-auth'
import { NavLinks } from './nav-links'

export function Sidebar() {
  const { user } = useAuth()
  const items = user ? getNavItemsForRole(user.role) : []

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-panel lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-line px-4">
        <Factory className="h-5 w-5 text-primary" aria-hidden="true" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">ShopFloor</p>
          <p className="text-xs text-muted">Northstar Metalworks</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
        <NavLinks items={items} />
      </nav>
    </aside>
  )
}
