import type { Priority } from '@/types/domain'
import type { OrderStatus } from '@/types/status'
import type { OrderFilters, OrderListItem } from '../types'
import { ORDER_STATUS_OPTIONS, PRIORITIES } from './order-rules'

export const DEFAULT_FILTERS: OrderFilters = { q: '', status: 'all', lineId: 'all', priority: 'all' }

const STATUS_VALUES = new Set<string>(ORDER_STATUS_OPTIONS.map((o) => o.value))
const PRIORITY_VALUES = new Set<string>(PRIORITIES)

export function hasActiveFilters(f: OrderFilters): boolean {
  return f.q.trim() !== '' || f.status !== 'all' || f.lineId !== 'all' || f.priority !== 'all'
}

/** Reads filters from the URL, ignoring values that are not valid options. */
export function parseFilters(params: URLSearchParams): OrderFilters {
  const status = params.get('status') ?? 'all'
  const priority = params.get('priority') ?? 'all'
  return {
    q: params.get('q') ?? '',
    status: STATUS_VALUES.has(status) ? (status as OrderStatus) : 'all',
    lineId: params.get('line') ?? 'all',
    priority: PRIORITY_VALUES.has(priority) ? (priority as Priority) : 'all',
  }
}

/** Writes only non-default filters, keeping URLs short. */
export function toSearchParams(f: OrderFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.q.trim() !== '') params.set('q', f.q)
  if (f.status !== 'all') params.set('status', f.status)
  if (f.lineId !== 'all') params.set('line', f.lineId)
  if (f.priority !== 'all') params.set('priority', f.priority)
  return params
}

export function filterOrders(items: readonly OrderListItem[], f: OrderFilters): OrderListItem[] {
  const query = f.q.trim().toLowerCase()
  return items.filter((item) => {
    if (f.status !== 'all' && item.order.status !== f.status) return false
    if (f.lineId !== 'all' && item.order.lineId !== f.lineId) return false
    if (f.priority !== 'all' && item.order.priority !== f.priority) return false
    if (query === '') return true
    const haystack = `${item.order.orderNumber} ${item.productName} ${item.lineName}`.toLowerCase()
    return haystack.includes(query)
  })
}

const STATUS_RANK: Record<OrderStatus, number> = {
  in_progress: 0,
  planned: 1,
  draft: 2,
  completed: 3,
  cancelled: 4,
}

/** Open work first (In Progress, Planned, Draft), then by due date, then order number. */
export function sortOrders(items: readonly OrderListItem[]): OrderListItem[] {
  return [...items].sort(
    (a, b) =>
      STATUS_RANK[a.order.status] - STATUS_RANK[b.order.status] ||
      a.order.dueDate.localeCompare(b.order.dueDate) ||
      a.order.orderNumber.localeCompare(b.order.orderNumber),
  )
}
