import { beforeAll, describe, expect, it } from 'vitest'
import { setMockLatency } from '@/mocks/repository'
import {
  OrderRuleError,
  changeOrderStatus,
  createOrder,
  getOrderDetail,
  listOrderItems,
  updateOrder,
} from './orders-service'
import type { OrderInput } from '../types'

const input: OrderInput = {
  productId: 'prod-bracket',
  lineId: 'line-cut-01',
  plannedQuantity: 300,
  plannedStart: '2026-11-09',
  dueDate: '2026-11-12',
  priority: 'high',
  instructions: 'Deburr edges.',
}

beforeAll(() => setMockLatency(0))

describe('orders service (mock backend)', () => {
  it('creates an order with the next number, audit metadata and a history entry', async () => {
    const order = await createOrder(input, 'draft', 'Rosa Villanueva')
    expect(order.orderNumber).toBe('PO-2026-008')
    expect(order.status).toBe('draft')
    expect(order.createdBy).toBe('Rosa Villanueva')

    const detail = await getOrderDetail('PO-2026-008')
    expect(detail?.timeline[0]?.description).toBe('created the order')
    expect(detail?.timeline[0]?.actor).toBe('Rosa Villanueva')
    expect(detail?.reports).toEqual([])
    expect((await listOrderItems()).some((i) => i.order.orderNumber === 'PO-2026-008')).toBe(true)
  })

  it('rejects invalid input with a readable message', async () => {
    await expect(createOrder({ ...input, dueDate: '2026-11-01' }, 'draft', 'x')).rejects.toThrow(OrderRuleError)
    await expect(createOrder({ ...input, plannedQuantity: 0 }, 'draft', 'x')).rejects.toThrow('Must be at least 1')
    await expect(createOrder({ ...input, productId: 'nope' }, 'draft', 'x')).rejects.toThrow('valid product')
  })

  it('records what changed when an order is edited, and skips no-op saves', async () => {
    await updateOrder('PO-2026-008', { ...input, plannedQuantity: 350 }, 'Rosa Villanueva')
    const detail = await getOrderDetail('PO-2026-008')
    expect(detail?.order.plannedQuantity).toBe(350)
    expect(detail?.timeline[0]?.detail).toBe('Planned quantity: 300 → 350')

    const historyBefore = detail?.timeline.length
    await updateOrder('PO-2026-008', { ...input, plannedQuantity: 350 }, 'Rosa Villanueva')
    expect((await getOrderDetail('PO-2026-008'))?.timeline.length).toBe(historyBefore)
  })

  it('follows the status workflow and locks product and line once in progress', async () => {
    await changeOrderStatus('PO-2026-008', 'planned', 'Rosa Villanueva')
    await expect(changeOrderStatus('PO-2026-008', 'completed', 'x')).rejects.toThrow('Cannot change status')
    await changeOrderStatus('PO-2026-008', 'in_progress', 'Rosa Villanueva')

    const locked = { ...input, plannedQuantity: 350, productId: 'prod-frame' }
    await expect(updateOrder('PO-2026-008', locked, 'x')).rejects.toThrow('cannot be changed once production has started')
    await expect(updateOrder('PO-2026-008', { ...input, plannedQuantity: 400 }, 'x')).resolves.toBeDefined()
  })

  it('will not lower planned quantity below the quantity already reported', async () => {
    const detail = await getOrderDetail('PO-2026-003')
    expect(detail).not.toBeNull()
    const order = detail?.order
    if (!order || !detail) return
    const reported = detail.progress.committedProduced
    expect(reported).toBeGreaterThan(0)
    const current: OrderInput = {
      productId: order.productId,
      lineId: order.lineId,
      plannedQuantity: reported - 1,
      plannedStart: order.plannedStart,
      dueDate: order.dueDate,
      priority: order.priority,
      instructions: order.instructions,
    }
    await expect(updateOrder('PO-2026-003', current, 'x')).rejects.toThrow('already reported')
  })

  it('requires a reason to cancel, keeps it, and then blocks further edits', async () => {
    await expect(changeOrderStatus('PO-2026-008', 'cancelled', 'x', '  ')).rejects.toThrow('reason')
    await changeOrderStatus('PO-2026-008', 'cancelled', 'Rosa Villanueva', 'Customer cancelled the job')

    const detail = await getOrderDetail('PO-2026-008')
    expect(detail?.order.status).toBe('cancelled')
    expect(detail?.order.cancelReason).toBe('Customer cancelled the job')
    expect(detail?.timeline[0]?.detail).toContain('Customer cancelled the job')
    await expect(updateOrder('PO-2026-008', input, 'x')).rejects.toThrow('cannot be edited')
    await expect(changeOrderStatus('PO-2026-008', 'planned', 'x')).rejects.toThrow('Cannot change status')
  })

  it('shows reports, downtime and merged activity for the sample order PO-2026-001', async () => {
    const detail = await getOrderDetail('PO-2026-001')
    expect(detail?.order.plannedQuantity).toBe(500)
    expect(detail?.reports.some((r) => r.producedQuantity === 210 && r.goodQuantity === 202)).toBe(true)
    expect(detail?.downtime.some((d) => d.minutes === 35 && d.category === 'machine_maintenance')).toBe(true)
    expect(detail?.progress.approvedGood).toBeGreaterThanOrEqual(202)

    const times = (detail?.timeline ?? []).map((t) => Date.parse(t.timestamp))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    expect(detail?.timeline.some((t) => t.description.startsWith('submitted RPT-'))).toBe(true)
    expect(detail?.timeline.some((t) => t.description === 'created the order')).toBe(true)
  })

  it('returns null for an unknown order', async () => {
    expect(await getOrderDetail('PO-2026-999')).toBeNull()
  })
})
