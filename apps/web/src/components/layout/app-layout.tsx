import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MobileNavigation } from './mobile-navigation'
import { Sidebar } from './sidebar'
import { TopNavbar } from './top-navbar'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-full">
      <Sidebar />
      <MobileNavigation open={menuOpen} onOpenChange={setMenuOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
