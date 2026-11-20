import { describe, expect, it } from 'vitest'
import type { ProductionReport } from '@/types/domain'
import {
  canTransition,
  describeChanges,
  isEditable,
  isOverdue,
  lockedFields,
  nextOrderNumber,
  orderProgress,
  statusActionsFor,
} from './order-rules'

function report(overrides: Partial<ProductionReport>): ProductionReport {
  return {
    id: 'R',
    orderId: 'PO-1',
    lineId: 'l',
    machineId: 'm',
    shift: 'morning',
    reportDate: '2026-11-03',
    operatorName: 'Op',
    shiftTarget: 100,
    producedQuantity: 100,
    rejectedQuantity: 10,
    status: 'approved',
    createdAt: '2026-11-03T08:00:00+08:00',
    updatedAt: '2026-11-03T08:00:00+08:00',
    ...overrides,
  }
}

describe('status transitions', () => {
  it('allows the forward path and cancellation from open statuses', () => {
    expect(canTransition('draft', 'planned')).toBe(true)
    expect(canTransition('planned', 'in_progress')).toBe(true)
    expect(canTransition('in_progress', 'completed')).toBe(true)
    expect(canTransition('draft', 'cancelled')).toBe(true)
    expect(canTransition('in_progress', 'cancelled')).toBe(true)
  })

  it('blocks skipping steps, going backwards and leaving final statuses', () => {
    expect(canTransition('draft', 'in_progress')).toBe(false)
    expect(canTransition('draft', 'completed')).toBe(false)
    expect(canTransition('in_progress', 'planned')).toBe(false)
    expect(canTransition('completed', 'in_progress')).toBe(false)
    expect(canTransition('cancelled', 'draft')).toBe(false)
    expect(statusActionsFor('completed')).toEqual([])
    expect(statusActionsFor('cancelled')).toEqual([])
  })

  it('requires a reason only for cancellation', () => {
    const reasons = statusActionsFor('planned').map((a) => [a.to, a.requiresReason])
    expect(reasons).toEqual([
      ['in_progress', false],
      ['cancelled', true],
    ])
  })
})

describe('editing rules', () => {
  it('lets only open orders be edited', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('planned')).toBe(true)
    expect(isEditable('in_progress')).toBe(true)
    expect(isEditable('completed')).toBe(false)
    expect(isEditable('cancelled')).toBe(false)
  })

  it('locks product and line once production has started', () => {
    expect(lockedFields('planned')).toEqual([])
    expect(lockedFields('in_progress')).toEqual(['productId', 'lineId'])
  })
})

describe('nextOrderNumber', () => {
  it('continues from the highest sequence for the year', () => {
    expect(nextOrderNumber(['PO-2026-001', 'PO-2026-007', 'PO-2026-003'], 2026)).toBe('PO-2026-008')
  })

  it('starts at 001 for a new year and ignores other years and malformed numbers', () => {
    expect(nextOrderNumber(['PO-2025-044', 'PO-2026-abc', 'XX-2026-009'], 2026)).toBe('PO-2026-001')
  })
})

describe('isOverdue', () => {
  it('flags open orders past their due date only', () => {
    expect(isOverdue({ status: 'in_progress', dueDate: '2026-11-06' }, '2026-11-07')).toBe(true)
    expect(isOverdue({ status: 'in_progress', dueDate: '2026-11-07' }, '2026-11-07')).toBe(false)
    expect(isOverdue({ status: 'completed', dueDate: '2026-11-01' }, '2026-11-07')).toBe(false)
    expect(isOverdue({ status: 'cancelled', dueDate: '2026-11-01' }, '2026-11-07')).toBe(false)
  })
})

describe('orderProgress', () => {
  it('counts approved reports as official progress and keeps pending separate', () => {
    const progress = orderProgress(500, [
      report({ id: 'A', status: 'approved', producedQuantity: 210, rejectedQuantity: 8 }),
      report({ id: 'B', status: 'pending_review', producedQuantity: 100, rejectedQuantity: 5 }),
      report({ id: 'C', status: 'draft', producedQuantity: 999 }),
      report({ id: 'D', status: 'returned', producedQuantity: 999 }),
    ])
    expect(progress.approvedGood).toBe(202)
    expect(progress.percent).toBeCloseTo(40.4, 5)
    expect(progress.pendingGood).toBe(95)
    expect(progress.pendingReportCount).toBe(1)
    expect(progress.committedProduced).toBe(310)
  })

  it('has no percentage when nothing is planned', () => {
    expect(orderProgress(0, []).percent).toBeNull()
  })
})

describe('describeChanges', () => {
  const before = {
    productId: 'p1',
    lineId: 'l1',
    plannedQuantity: 500,
    plannedStart: '2026-11-03',
    dueDate: '2026-11-10',
    priority: 'normal' as const,
    instructions: 'a',
  }
  const display = (_f: string, v: string | number) => String(v)

  it('lists changed fields and summarizes instruction edits', () => {
    const after = { ...before, plannedQuantity: 600, dueDate: '2026-11-12', instructions: 'b' }
    expect(describeChanges(before, after, display)).toBe(
      'Planned quantity: 500 → 600; Due date: 2026-11-10 → 2026-11-12; Instructions changed',
    )
  })

  it('returns an empty string when nothing changed', () => {
    expect(describeChanges(before, { ...before }, display)).toBe('')
  })
})
