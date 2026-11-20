import { describe, expect, it } from 'vitest'
import { downtimeMinutes, goodQuantity, validateQuantities } from '@/lib/kpi'
import { DOWNTIME_EVENTS, MACHINES, ORDERS, REPORTS } from './seed'

describe('mock dataset consistency', () => {
  it('has valid quantities on every report', () => {
    for (const r of REPORTS) {
      expect(validateQuantities(r), r.id).toEqual([])
    }
  })

  it('links every report to an existing order on the same line, inside its date window', () => {
    for (const r of REPORTS) {
      const order = ORDERS.find((o) => o.id === r.orderId)
      expect(order, r.id).toBeDefined()
      expect(order?.lineId, r.id).toBe(r.lineId)
      expect(MACHINES.find((m) => m.id === r.machineId)?.lineId, r.id).toBe(r.lineId)
      expect(r.reportDate >= (order?.plannedStart ?? ''), r.id).toBe(true)
      expect(r.reportDate <= (order?.dueDate ?? ''), r.id).toBe(true)
    }
  })

  it('never plans fewer units than an order has produced', () => {
    for (const o of ORDERS) {
      const produced = REPORTS.filter((r) => r.orderId === o.id).reduce((s, r) => s + r.producedQuantity, 0)
      expect(produced, o.orderNumber).toBeLessThanOrEqual(o.plannedQuantity)
    }
  })

  it('has positive, calculable downtime durations', () => {
    for (const e of DOWNTIME_EVENTS) {
      const minutes = downtimeMinutes(e.startTime, e.endTime)
      expect(minutes, e.id).not.toBeNull()
      expect(minutes ?? 0, e.id).toBeGreaterThan(0)
    }
  })

  it('contains the blueprint sample scenario for PO-2026-001', () => {
    const order = ORDERS.find((o) => o.orderNumber === 'PO-2026-001')
    expect(order?.plannedQuantity).toBe(500)
    expect(order?.lineId).toBe('line-cut-01')

    const report = REPORTS.find((r) => r.orderId === 'PO-2026-001' && r.shift === 'morning')
    expect(report?.producedQuantity).toBe(210)
    expect(report?.rejectedQuantity).toBe(8)
    expect(report ? goodQuantity(report) : 0).toBe(202)
    expect(report?.status).toBe('approved')

    const downtime = DOWNTIME_EVENTS.find((e) => e.reportId === report?.id)
    expect(downtime?.category).toBe('machine_maintenance')
    expect(downtime ? downtimeMinutes(downtime.startTime, downtime.endTime) : null).toBe(35)
  })

  it('includes pending, returned and draft reports for the approvals demo', () => {
    const statuses = new Set(REPORTS.map((r) => r.status))
    expect(statuses.has('pending_review')).toBe(true)
    expect(statuses.has('returned')).toBe(true)
    expect(statuses.has('draft')).toBe(true)
  })
})
