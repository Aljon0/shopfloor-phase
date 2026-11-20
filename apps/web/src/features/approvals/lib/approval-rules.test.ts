import { describe, expect, it } from 'vitest'
import { canApprove, canReopen, canReturn, isSelfReview, sortDecided, sortQueue, validateReason } from './approval-rules'
import type { ApprovalItem } from '../types'

function item(id: string, submittedAt: string | undefined, reviewedAt?: string): ApprovalItem {
  return { report: { id, submittedAt, reviewedAt, updatedAt: '2026-11-07T00:00:00Z' }, downtimeMinutes: 0 } as unknown as ApprovalItem
}

describe('approval rules', () => {
  it('approves and returns only reports awaiting review', () => {
    for (const s of ['pending_review', 'revised'] as const) {
      expect(canApprove(s)).toBe(true)
      expect(canReturn(s)).toBe(true)
    }
    for (const s of ['draft', 'returned', 'approved'] as const) {
      expect(canApprove(s)).toBe(false)
      expect(canReturn(s)).toBe(false)
    }
  })

  it('reopens only approved reports', () => {
    expect(canReopen('approved')).toBe(true)
    expect(canReopen('pending_review')).toBe(false)
    expect(canReopen('returned')).toBe(false)
  })

  it('requires a reason of 5 to 300 characters', () => {
    expect(validateReason('')).not.toBeNull()
    expect(validateReason('  no  ')).not.toBeNull()
    expect(validateReason('Count is wrong')).toBeNull()
    expect(validateReason('x'.repeat(301))).not.toBeNull()
    expect(validateReason('x'.repeat(300))).toBeNull()
  })

  it('detects self-review ignoring case and spacing', () => {
    expect(isSelfReview('Juan Dela Cruz', 'juan  dela cruz ')).toBe(true)
    expect(isSelfReview('Rosa Villanueva', 'Juan Dela Cruz')).toBe(false)
    expect(isSelfReview('', '')).toBe(false)
  })

  it('sorts the queue oldest first and decisions newest first', () => {
    const q = sortQueue([item('B', '2026-11-07T10:00:00Z'), item('A', '2026-11-06T10:00:00Z')])
    expect(q.map((i) => i.report.id)).toEqual(['A', 'B'])
    const d = sortDecided([item('A', undefined, '2026-11-06T10:00:00Z'), item('B', undefined, '2026-11-07T10:00:00Z')])
    expect(d.map((i) => i.report.id)).toEqual(['B', 'A'])
  })
})
