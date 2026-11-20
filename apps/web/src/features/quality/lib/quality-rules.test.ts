import { describe, expect, it } from 'vitest'
import type { InspectionItem } from '../types'
import { canInspectOrder, nextInspectionId, passRate, passedQuantity, summarizeInspections } from './quality-rules'

const item = (id: string, inspected: number, failed: number, defectId?: string, defectName: string | null = null): InspectionItem => ({
  inspection: {
    id, orderId: 'PO-1', productId: 'p1', inspectionDate: '2026-11-03', inspectedQuantity: inspected,
    passedQuantity: inspected - failed, failedQuantity: failed, ...(defectId ? { defectId } : {}), notes: '', inspector: 'Rosa',
    createdAt: '2026-11-03T10:00:00+08:00', updatedAt: '2026-11-03T10:00:00+08:00',
  },
  productName: 'Bracket', lineName: 'Cutting Line 01', defectName, reportStatus: null, passRate: passRate(inspected - failed, inspected),
})

describe('quality rules', () => {
  it('allows inspections on orders in progress or completed only', () => {
    expect(canInspectOrder('in_progress')).toBe(true)
    expect(canInspectOrder('completed')).toBe(true)
    for (const s of ['draft', 'planned', 'cancelled'] as const) expect(canInspectOrder(s)).toBe(false)
  })
  it('calculates pass rate without dividing by zero', () => {
    expect(passRate(116, 120)).toBeCloseTo(96.667, 3)
    expect(passRate(0, 0)).toBeNull()
  })
  it('derives passed = inspected - failed and rejects impossible combinations', () => {
    expect(passedQuantity(120, 4)).toBe(116)
    expect(passedQuantity(10, 10)).toBe(0)
    expect(passedQuantity(10, 11)).toBeNull()
    expect(passedQuantity(0, 0)).toBeNull()
    expect(passedQuantity(Number.NaN, 1)).toBeNull()
    expect(passedQuantity(10.5, 1)).toBeNull()
  })
  it('numbers inspections per year after the highest', () => {
    expect(nextInspectionId([], '2026')).toBe('QI-2026-0001')
    expect(nextInspectionId(['QI-2026-0003', 'QI-2026-0010', 'QI-2025-0099'], '2026')).toBe('QI-2026-0011')
  })
  it('summarizes from summed quantities, not averaged percentages', () => {
    const s = summarizeInspections([
      item('a', 100, 10, 'd1', 'Burr'),
      item('b', 10, 0),
      item('c', 50, 5, 'd2', 'Weld defect'),
      item('d', 20, 4, 'd1', 'Burr'),
    ])
    expect(s).toMatchObject({ inspections: 4, inspected: 180, passed: 161, failed: 19 })
    expect(s.passRate).toBeCloseTo((161 / 180) * 100, 6)
    expect(s.failureRate).toBeCloseTo((19 / 180) * 100, 6)
    expect(s.byDefect.map((r) => [r.label, r.failed, r.inspections])).toEqual([['Burr', 14, 2], ['Weld defect', 5, 1]])
  })
  it('summarizes nothing as nulls and no rows', () => {
    expect(summarizeInspections([])).toEqual({ inspections: 0, inspected: 0, passed: 0, failed: 0, passRate: null, failureRate: null, byDefect: [] })
  })
})
