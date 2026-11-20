import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { RestrictedState } from '@/components/shared/restricted-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { canManageOrders } from '@/lib/permissions'
import { OrderForm } from './components/order-form'
import { useCreateOrder, useOrderDetail, useOrderReference, useUpdateOrder } from './hooks/use-orders'
import { isEditable, ORDER_STATUS_LABELS } from './lib/order-rules'
import { OrderRuleError } from './services/orders-service'
import type { InitialOrderStatus, OrderInput } from './types'

function messageFor(error: unknown): string {
  return error instanceof OrderRuleError ? error.message : 'The order could not be saved. Check the connection and try again.'
}

function FormSkeleton() {
  return (
    <Card className="space-y-4 p-5" role="status" aria-label="Loading form">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </Card>
  )
}

function CreateOrderView() {
  const navigate = useNavigate()
  const reference = useOrderReference()
  const create = useCreateOrder()
  const [error, setError] = useState<string>()

  const handleSubmit = async (input: OrderInput, status: InitialOrderStatus) => {
    setError(undefined)
    try {
      const order = await create.mutateAsync({ input, status })
      navigate(`/production-orders/${order.orderNumber}`, {
        replace: true,
        state: { notice: `${order.orderNumber} was created as ${ORDER_STATUS_LABELS[order.status]}.` },
      })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <>
      <PageHeader title="New production order" description="Enter the order details. The order number is assigned when you save." />
      {reference.isError ? (
        <Card>
          <ErrorState onRetry={() => void reference.refetch()} />
        </Card>
      ) : !reference.data ? (
        <FormSkeleton />
      ) : (
        <OrderForm
          reference={reference.data}
          submitting={create.isPending}
          submitError={error}
          onSubmit={(input, status) => void handleSubmit(input, status)}
          onCancel={() => navigate('/production-orders')}
        />
      )}
    </>
  )
}

function EditOrderView({ orderNumber }: { orderNumber: string }) {
  const navigate = useNavigate()
  const detail = useOrderDetail(orderNumber)
  const reference = useOrderReference()
  const update = useUpdateOrder(orderNumber)
  const [error, setError] = useState<string>()
  const backTo = `/production-orders/${orderNumber}`

  const handleSubmit = async (input: OrderInput) => {
    setError(undefined)
    try {
      await update.mutateAsync(input)
      navigate(backTo, { replace: true, state: { notice: `${orderNumber} was updated.` } })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  if (detail.isError || reference.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void Promise.all([detail.refetch(), reference.refetch()])} />
      </Card>
    )
  }
  if (detail.isPending || !reference.data) {
    return (
      <>
        <PageHeader title={`Edit ${orderNumber}`} />
        <FormSkeleton />
      </>
    )
  }
  if (!detail.data) {
    return (
      <>
        <PageHeader title="Order not found" />
        <Card>
          <EmptyState
            title={`${orderNumber} does not exist`}
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

  const { order, progress } = detail.data
  if (!isEditable(order.status)) {
    return (
      <>
        <PageHeader title={`Edit ${orderNumber}`} />
        <Card>
          <EmptyState
            title={`${ORDER_STATUS_LABELS[order.status]} orders cannot be edited`}
            description="Completed and cancelled orders are final."
            action={
              <Button asChild variant="secondary">
                <Link to={backTo}>Back to order</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title={`Edit ${orderNumber}`} description="Changes are recorded in the order's activity history." />
      <OrderForm
        reference={reference.data}
        existing={order}
        committedProduced={progress.committedProduced}
        submitting={update.isPending}
        submitError={error}
        onSubmit={(input) => void handleSubmit(input)}
        onCancel={() => navigate(backTo)}
      />
    </>
  )
}

/** Serves both /production-orders/new and /production-orders/:orderId/edit. */
export function OrderFormPage() {
  const { user } = useAuth()
  const { orderId } = useParams<{ orderId: string }>()

  if (!canManageOrders(user?.role)) {
    return <RestrictedState description="Only supervisors can create or edit production orders." />
  }
  return orderId ? <EditOrderView orderNumber={orderId} /> : <CreateOrderView />
}
