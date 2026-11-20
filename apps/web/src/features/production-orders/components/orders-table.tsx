import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { isEditable } from '../lib/order-rules'
import type { OrderListItem } from '../types'
import { OrderProgressCell } from './order-progress'
import { PriorityBadge } from './priority-badge'

interface OrdersTableProps {
  items: OrderListItem[]
  canManage: boolean
}

export function OrdersTable({ items, canManage }: OrdersTableProps) {
  return (
    <Card>
      <Table>
        <THead>
          <Tr>
            <Th>Order</Th>
            <Th>Product</Th>
            <Th>Line</Th>
            <Th className="text-right">Planned qty</Th>
            <Th>Progress</Th>
            <Th>Start</Th>
            <Th>Due</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {items.map(({ order, productName, lineName, progress, overdue }) => (
            <Tr key={order.id}>
              <Td>
                <Link
                  to={`/production-orders/${order.orderNumber}`}
                  className="font-medium text-primary hover:underline"
                >
                  {order.orderNumber}
                </Link>
              </Td>
              <Td>{productName}</Td>
              <Td>{lineName}</Td>
              <Td className="text-right tabular-nums">{formatNumber(order.plannedQuantity)}</Td>
              <Td>
                <OrderProgressCell progress={progress} />
              </Td>
              <Td>{formatDate(order.plannedStart)}</Td>
              <Td>
                <span className={overdue ? 'font-medium text-danger' : undefined}>{formatDate(order.dueDate)}</span>
                {overdue ? (
                  <Badge tone="danger" className="ml-2">
                    Overdue
                  </Badge>
                ) : null}
              </Td>
              <Td>
                <PriorityBadge priority={order.priority} />
              </Td>
              <Td>
                <StatusBadge status={order.status} />
              </Td>
              <Td className="text-right">
                {canManage && isEditable(order.status) ? (
                  <Link
                    to={`/production-orders/${order.orderNumber}/edit`}
                    className="font-medium text-primary hover:underline"
                    aria-label={`Edit ${order.orderNumber}`}
                  >
                    Edit
                  </Link>
                ) : null}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}
