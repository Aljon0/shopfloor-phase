import { ClipboardList, Plus, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { canManageOrders } from '@/lib/permissions'
import { OrderFiltersBar } from './components/order-filters-bar'
import { OrdersTable } from './components/orders-table'
import { useOrderItems, useOrderReference } from './hooks/use-orders'
import { DEFAULT_FILTERS, filterOrders, hasActiveFilters, parseFilters, sortOrders, toSearchParams } from './lib/order-filters'
import type { OrderFilters } from './types'

export function ProductionOrdersPage() {
  const { user } = useAuth()
  const canManage = canManageOrders(user?.role)

  // Filters live in the URL so a filtered view can be bookmarked and survives going back.
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const setFilters = (next: OrderFilters) => setParams(toSearchParams(next), { replace: true })

  const orders = useOrderItems()
  const reference = useOrderReference()

  const visible = useMemo(() => sortOrders(filterOrders(orders.data ?? [], filters)), [orders.data, filters])
  const total = orders.data?.length ?? 0

  const newOrderButton = canManage ? (
    <Button asChild>
      <Link to="/production-orders/new">
        <Plus className="h-4 w-4" aria-hidden="true" />
        New order
      </Link>
    </Button>
  ) : null

  return (
    <>
      <PageHeader
        title="Production Orders"
        description="Create, search and track production orders."
        actions={newOrderButton}
      />

      <OrderFiltersBar filters={filters} onChange={setFilters} lines={reference.data?.lines ?? []} />

      {orders.isError ? (
        <Card>
          <ErrorState onRetry={() => void orders.refetch()} />
        </Card>
      ) : orders.isPending ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading orders">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No production orders yet"
            description="Orders you create will appear here."
            action={newOrderButton}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No orders match these filters"
            description="Try a different search or clear the filters."
            action={
              hasActiveFilters(filters) ? (
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted" aria-live="polite">
            Showing {visible.length} of {total} {total === 1 ? 'order' : 'orders'}
          </p>
          <OrdersTable items={visible} canManage={canManage} />
        </>
      )}
    </>
  )
}
