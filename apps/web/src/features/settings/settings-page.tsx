import { NavLink, Navigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { RestrictedState } from '@/components/shared/restricted-state'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/cn'
import { canManageSettings } from '@/lib/permissions'
import { AuditSection } from './components/audit-section'
import { CategoriesSection } from './components/categories-section'
import { DefectsSection } from './components/defects-section'
import { LinesSection } from './components/lines-section'
import { MachinesSection } from './components/machines-section'
import { ProductsSection } from './components/products-section'
import { ShiftsSection } from './components/shifts-section'
import { SystemSection } from './components/system-section'
import { UsersSection } from './components/users-section'
import { useSettingsData } from './hooks/use-settings'

const SECTIONS = [
  { id: 'users', label: 'Users and roles' },
  { id: 'products', label: 'Products' },
  { id: 'machines', label: 'Machines' },
  { id: 'lines', label: 'Production lines' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'defects', label: 'Defect types' },
  { id: 'categories', label: 'Downtime categories' },
  { id: 'system', label: 'System' },
  { id: 'changes', label: 'Change log' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']
const isSection = (value: string | undefined): value is SectionId => SECTIONS.some((s) => s.id === value)

export function SettingsPage() {
  const { user } = useAuth()
  const { section } = useParams<{ section: string }>()
  const query = useSettingsData()

  if (!canManageSettings(user?.role)) return <RestrictedState description="Only administrators can change settings." />
  if (section === undefined) return <Navigate to="/settings/users" replace />
  if (!isSection(section)) return <Navigate to="/settings/users" replace />

  const data = query.data
  return (
    <>
      <PageHeader title="Settings" description="Users, reference data and system information." />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              to={`/settings/${s.id}`}
              className={({ isActive }) =>
                cn(
                  'flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-neutral-bg hover:text-ink',
                )
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          {query.isError && !data ? (
            <Card>
              <ErrorState onRetry={() => void query.refetch()} />
            </Card>
          ) : !data ? (
            <div role="status" aria-label="Loading settings" className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : section === 'users' ? (
            <UsersSection users={data.users} />
          ) : section === 'products' ? (
            <ProductsSection products={data.products} openOrders={data.openOrders.byProduct} />
          ) : section === 'machines' ? (
            <MachinesSection machines={data.machines} lines={data.lines} />
          ) : section === 'lines' ? (
            <LinesSection lines={data.lines} machines={data.machines} openOrders={data.openOrders.byLine} />
          ) : section === 'shifts' ? (
            <ShiftsSection shifts={data.shifts} />
          ) : section === 'defects' ? (
            <DefectsSection defects={data.defectTypes} />
          ) : section === 'categories' ? (
            <CategoriesSection />
          ) : section === 'system' ? (
            <SystemSection />
          ) : (
            <AuditSection entries={data.audit} />
          )}
        </div>
      </div>
    </>
  )
}
