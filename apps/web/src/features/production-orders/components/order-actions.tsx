import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { ProductionOrder } from '@/types/domain'
import { useChangeOrderStatus } from '../hooks/use-orders'
import { MIN_CANCEL_REASON_LENGTH, isEditable, statusActionsFor, type StatusAction } from '../lib/order-rules'
import { OrderRuleError } from '../services/orders-service'

interface OrderActionsProps {
  order: ProductionOrder
  /** Supervisors only. Hiding buttons is not security; the service layer enforces the rules too. */
  canManage: boolean
}

export function OrderActions({ order, canManage }: OrderActionsProps) {
  const change = useChangeOrderStatus(order.orderNumber)
  const [pending, setPending] = useState<StatusAction | null>(null)

  if (!canManage) return null

  const close = () => {
    setPending(null)
    change.reset()
  }

  const errorMessage = change.error
    ? change.error instanceof OrderRuleError
      ? change.error.message
      : 'The status could not be changed. Check the connection and try again.'
    : undefined

  return (
    <>
      {isEditable(order.status) ? (
        <Button asChild variant="secondary">
          <Link to={`/production-orders/${order.orderNumber}/edit`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
      ) : null}

      {statusActionsFor(order.status).map((action) => (
        <Button
          key={action.to}
          variant={action.tone === 'danger' ? 'secondary' : 'primary'}
          className={action.tone === 'danger' ? 'text-danger' : undefined}
          onClick={() => setPending(action)}
        >
          {action.label}
        </Button>
      ))}

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) close()
          }}
          title={pending.confirmTitle}
          description={pending.confirmDescription(order.orderNumber)}
          confirmLabel={pending.label}
          tone={pending.tone}
          pending={change.isPending}
          error={errorMessage}
          {...(pending.requiresReason
            ? { reason: { label: 'Reason', minLength: MIN_CANCEL_REASON_LENGTH } }
            : {})}
          onConfirm={(reason) =>
            change.mutate(
              { to: pending.to, ...(pending.requiresReason ? { reason } : {}) },
              { onSuccess: close },
            )
          }
        />
      ) : null}
    </>
  )
}
