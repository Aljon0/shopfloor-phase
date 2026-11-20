import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import type { OrderDetail } from '../types'
import { PriorityBadge } from './priority-badge'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

export function OrderSummaryCard({ detail }: { detail: OrderDetail }) {
  const { order, productName, lineName, overdue } = detail
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Product">{productName}</Field>
          <Field label="Production line">{lineName}</Field>
          <Field label="Planned quantity">
            <span className="tabular-nums">{formatNumber(order.plannedQuantity)}</span>
          </Field>
          <Field label="Planned start">{formatDate(order.plannedStart, true)}</Field>
          <Field label="Due date">
            {formatDate(order.dueDate, true)}
            {overdue ? (
              <Badge tone="danger" className="ml-2">
                Overdue
              </Badge>
            ) : null}
          </Field>
          <Field label="Priority">
            <PriorityBadge priority={order.priority} />
          </Field>
          <Field label="Created">
            {order.createdBy}, {formatFactoryDateTime(order.createdAt)}
          </Field>
          <Field label="Last updated">{formatFactoryDateTime(order.updatedAt)}</Field>
        </dl>

        <div>
          <p className="text-xs font-medium text-muted">Instructions</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
            {order.instructions || <span className="text-muted">No instructions.</span>}
          </p>
        </div>

        {order.status === 'cancelled' && order.cancelReason ? (
          <p role="note" className="rounded-md bg-neutral-bg px-3 py-2 text-sm text-ink">
            <span className="font-medium">Cancelled.</span> Reason: {order.cancelReason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
