import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Factory, X } from 'lucide-react'
import { getNavItemsForRole } from '@/lib/navigation'
import { useAuth } from '@/hooks/use-auth'
import { NavLinks } from './nav-links'

interface MobileNavigationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Slide-in drawer replacing the sidebar below the lg breakpoint. */
export function MobileNavigation({ open, onOpenChange }: MobileNavigationProps) {
  const { user } = useAuth()
  const items = user ? getNavItemsForRole(user.role) : []

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-panel shadow-pop lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" aria-hidden="true" />
              <DialogPrimitive.Title className="text-sm font-semibold">ShopFloor</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-neutral-bg"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
          <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
            <NavLinks items={items} onNavigate={() => onOpenChange(false)} />
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
