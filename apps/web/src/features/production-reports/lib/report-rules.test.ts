import { describe, expect, it } from 'vitest'
import {
  buildReportId,
  canReportAgainstOrder,
  canSubmitReport,
  describeReportChanges,
  findSlotConflict,
  isAwaitingReview,
  isReportDeletable,
  isReportEditable,
  reportMetrics,
  statusAfterSubmit,
  validateReportDate,
} from './report-rules'
import type { ReportInput } from '../types'

describe('report workflow rules', () => {
  it('lets the operator edit only drafts and returned reports', () => {
    expect(isReportEditable('draft')).toBe(true)
    expect(isReportEditable('returned')).toBe(true)
    for (const s of ['pending_review', 'revised', 'approved'] as const) expect(isReportEditable(s)).toBe(false)
    expect(canSubmitReport('draft')).toBe(true)
    expect(canSubmitReport('approved')).toBe(false)
  })

  it('submits a draft as Pending Review and a returned report as Revised', () => {
    expect(statusAfterSubmit('draft')).toBe('pending_review')
    expect(statusAfterSubmit('returned')).toBe('revised')
    expect(statusAfterSubmit('pending_review')).toBeNull()
    expect(statusAfterSubmit('approved')).toBeNull()
  })

  it('deletes drafts only', () => {
    expect(isReportDeletable('draft')).toBe(true)
    expect(isReportDeletable('returned')).toBe(false)
  })

  it('treats pending and revised reports as awaiting review', () => {
    expect(isAwaitingReview('pending_review')).toBe(true)
    expect(isAwaitingReview('revised')).toBe(true)
    expect(isAwaitingReview('returned')).toBe(false)
  })

  it('allows new reports only against orders in progress', () => {
    expect(canReportAgainstOrder('in_progress')).toBe(true)
    for (const s of ['draft', 'planned', 'completed', 'cancelled'] as const) expect(canReportAgainstOrder(s)).toBe(false)
  })
})

describe('buildReportId', () => {
  it('uses the line code and shift', () => {
    expect(buildReportId([], '2026-11-07', 'CUT', 'morning')).toBe('RPT-20261107-CUT-AM')
    expect(buildReportId([], '2026-11-07', 'WLD', 'night')).toBe('RPT-20261107-WLD-PM')
  })
  it('appends a sequence instead of reusing a taken number', () => {
    const taken = ['RPT-20261107-CUT-AM']
    expect(buildReportId(taken, '2026-11-07', 'CUT', 'morning')).toBe('RPT-20261107-CUT-AM-2')
    expect(buildReportId([...taken, 'RPT-20261107-CUT-AM-2'], '2026-11-07', 'CUT', 'morning')).toBe('RPT-20261107-CUT-AM-3')
  })
})

describe('reportMetrics', () => {
  it('matches the blueprint sample: 210 produced, 8 rejected', () => {
    const m = reportMetrics({ producedQuantity: 210, rejectedQuantity: 8, shiftTarget: 250 })
    expect(m.goodQuantity).toBe(202)
    expect(m.rejectionRate).toBeCloseTo(3.8095, 3)
    expect(m.targetAchievement).toBeCloseTo(80.8, 5)
  })
  it('returns null ratios instead of dividing by zero', () => {
    const m = reportMetrics({ producedQuantity: 0, rejectedQuantity: 0, shiftTarget: 0 })
    expect(m.rejectionRate).toBeNull()
    expect(m.targetAchievement).toBeNull()
    expect(m.goodQuantity).toBe(0)
  })
})

describe('validateReportDate', () => {
  it('rejects future dates and dates before the order starts', () => {
    expect(validateReportDate('2026-11-08', '2026-11-07', '2026-11-04')).toMatch('future')
    expect(validateReportDate('2026-11-03', '2026-11-07', '2026-11-04')).toMatch('planned start')
  })
  it('accepts today and the start date', () => {
    expect(validateReportDate('2026-11-07', '2026-11-07', '2026-11-04')).toBeNull()
    expect(validateReportDate('2026-11-04', '2026-11-07', '2026-11-04')).toBeNull()
    expect(validateReportDate('2026-11-04', '2026-11-07', undefined)).toBeNull()
  })
})

describe('findSlotConflict', () => {
  const reports = [{ id: 'R1', machineId: 'm1', shift: 'morning' as const, reportDate: '2026-11-07' }]
  it('finds a report on the same machine, shift and date', () => {
    expect(findSlotConflict(reports, { machineId: 'm1', shift: 'morning', reportDate: '2026-11-07' })).toBe('R1')
  })
  it('ignores other machines, shifts, dates and the report being edited', () => {
    expect(findSlotConflict(reports, { machineId: 'm2', shift: 'morning', reportDate: '2026-11-07' })).toBeUndefined()
    expect(findSlotConflict(reports, { machineId: 'm1', shift: 'night', reportDate: '2026-11-07' })).toBeUndefined()
    expect(findSlotConflict(reports, { machineId: 'm1', shift: 'morning', reportDate: '2026-11-06' })).toBeUndefined()
    expect(findSlotConflict(reports, { machineId: 'm1', shift: 'morning', reportDate: '2026-11-07' }, 'R1')).toBeUndefined()
  })
})

describe('describeReportChanges', () => {
  const before: ReportInput = {
    orderId: 'PO-1', machineId: 'm1', shift: 'morning', reportDate: '2026-11-07',
    producedQuantity: 200, rejectedQuantity: 5, notes: '',
  }
  const show = (_f: string, v: string | number) => String(v)
  it('lists changed fields and is empty when nothing changed', () => {
    expect(describeReportChanges(before, { ...before }, show)).toBe('')
    expect(describeReportChanges(before, { ...before, producedQuantity: 210, rejectedQuantity: 8 }, show)).toBe(
      'Produced: 200 → 210; Rejected: 5 → 8',
    )
    expect(describeReportChanges(before, { ...before, notes: 'x' }, show)).toBe('Notes changed')
  })
})
