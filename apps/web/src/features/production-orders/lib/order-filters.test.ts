import { describe, expect, it } from 'vitest'
import type { ProductionOrder } from '@/types/domain'
import type { OrderListItem } from '../types'
import { DEFAULT_FILTERS, filterOrders, hasActiveFilters, parseFilters, sortOrders, toSearchParams } from './order-filters'
import { orderProgress } from './order-rules'

function item(overrides: Partial<ProductionOrder>, productName = 'Metal panels', lineName = 'Cutting Line 01'): OrderListItem {
  const order: ProductionOrder = {
    id: 'PO-2026-001',
    orderNumber: 'PO-2026-001',
    productId: 'p',
    lineId: 'line-cut-01',
    plannedQuantity: 100,
    plannedStart: '2026-11-01',
    dueDate: '2026-11-10',
    priority: 'normal',
    instructions: '',
    status: 'planned',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    ...overrides,
  }
  return { order, productName, lineName, progress: orderProgress(100, []), overdue: false }
}

const items = [
  item({ id: 'PO-2026-001', orderNumber: 'PO-2026-001', status: 'completed', dueDate: '2026-11-03' }, 'Steel mounting brackets'),
  item({ id: 'PO-2026-002', orderNumber: 'PO-2026-002', status: 'in_progress', priority: 'urgent', dueDate: '2026-11-12' }, 'Metal panels', 'Welding Line 01'),
  item({ id: 'PO-2026-003', orderNumber: 'PO-2026-003', status: 'draft', lineId: 'line-weld-01', dueDate: '2026-11-08' }),
  item({ id: 'PO-2026-004', orderNumber: 'PO-2026-004', status: 'in_progress', dueDate: '2026-11-09' }),
]

describe('filterOrders', () => {
  it('returns everything with default filters', () => {
    expect(filterOrders(items, DEFAULT_FILTERS)).toHaveLength(4)
  })

  it('searches order number, product and line, ignoring case and spaces at the ends', () => {
    expect(filterOrders(items, { ...DEFAULT_FILTERS, q: ' po-2026-003 ' })).toHaveLength(1)
    expect(filterOrders(items, { ...DEFAULT_FILTERS, q: 'BRACKETS' })).toHaveLength(1)
    expect(filterOrders(items, { ...DEFAULT_FILTERS, q: 'welding' })).toHaveLength(1)
    expect(filterOrders(items, { ...DEFAULT_FILTERS, q: 'nothing matches' })).toHaveLength(0)
  })

  it('combines status, line and priority filters', () => {
    expect(filterOrders(items, { ...DEFAULT_FILTERS, status: 'in_progress' })).toHaveLength(2)
    expect(filterOrders(items, { ...DEFAULT_FILTERS, status: 'in_progress', priority: 'urgent' })).toHaveLength(1)
    expect(filterOrders(items, { ...DEFAULT_FILTERS, lineId: 'line-weld-01' })).toHaveLength(1)
  })
})

describe('sortOrders', () => {
  it('puts open work first, then orders by due date', () => {
    expect(sortOrders(items).map((i) => i.order.orderNumber)).toEqual([
      'PO-2026-004',
      'PO-2026-002',
      'PO-2026-003',
      'PO-2026-001',
    ])
  })
})

describe('URL filter params', () => {
  it('round-trips non-default filters', () => {
    const filters = { q: 'bracket', status: 'planned' as const, lineId: 'line-cut-01', priority: 'high' as const }
    expect(parseFilters(toSearchParams(filters))).toEqual(filters)
  })

  it('omits defaults and ignores invalid values', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('')
    expect(parseFilters(new URLSearchParams('status=bogus&priority=nope'))).toEqual(DEFAULT_FILTERS)
  })

  it('reports whether any filter is active', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: 'x' })).toBe(true)
  })
})
