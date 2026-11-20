import { CircleCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { canManageOrders } from '@/lib/permissions'
import { OrderActions } from './components/order-actions'
import { OrderProgressCard } from './components/order-progress-card'
import { OrderSummaryCard } from './components/order-summary-card'
import { OrderTabs } from './components/order-tabs'
import { PriorityBadge } from './components/priority-badge'
import { useOrderDetail } from './hooks/use-orders'

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order" className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams<{ orderId: string }>()
  const { user } = useAuth()
  const location = useLocation()
  const detail = useOrderDetail(orderId)
  const [dismissed, setDismissed] = useState(false)

  const notice = (location.state as { notice?: string } | null)?.notice

  if (detail.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void detail.refetch()} />
      </Card>
    )
  }
  if (detail.isPending) return <DetailSkeleton />
  if (!detail.data) {
    return (
      <>
        <PageHeader title="Order not found" />
        <Card>
          <EmptyState
            title={`${orderId} does not exist`}
            description="Check the order number, or go back to the list."
            action={
              <Button asChild variant="secondary">
                <Link to="/production-orders">Back to orders</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const data = detail.data
  const { order } = data

  return (
    <>
      {notice && !dismissed ? (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-success-bg px-4 py-2.5 text-sm text-success"
        >
          <span className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            {notice}
          </span>
          <button
            type="button"
            aria-label="Dismiss message"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/60"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {data.productName} · {data.lineName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderActions order={order} canManage={canManageOrders(user?.role)} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OrderSummaryCard detail={data} />
          </div>
          <OrderProgressCard progress={data.progress} />
        </div>
        <OrderTabs detail={data} />
      </div>
    </>
  )
}
