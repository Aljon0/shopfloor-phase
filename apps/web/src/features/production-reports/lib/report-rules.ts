/**
 * Production report business rules. Pure functions, no UI or framework imports.
 *
 * Assumptions to confirm (the blueprint describes the report fields but not these rules):
 * - Only operators file reports. A draft or a returned report can be edited; once submitted
 *   (Pending Review / Revised) or Approved it is read-only. Approval and return belong to Phase 6.
 * - Reports can only be started against orders that are In Progress.
 * - A report's date cannot be in the future or before the order's planned start.
 * - One report per machine, per shift, per date.
 * - A report's order cannot be changed after it is created.
 * - Submitting a returned report marks it "Revised" so the reviewer can tell it was corrected.
 * - Only drafts can be deleted.
 */
import { goodQuantity, rejectionRate, targetAchievement, validateQuantities } from '@/lib/kpi'
import type { ProductionReport, ShiftId } from '@/types/domain'
import type { OrderStatus, ReportStatus } from '@/types/status'
import type { ReportInput, ReportMetrics } from '../types'

export const MAX_NOTES_LENGTH = 500
export const MAX_REPORT_QUANTITY = 1_000_000

export const REPORT_STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'returned', label: 'Returned for Correction' },
  { value: 'revised', label: 'Revised' },
  { value: 'approved', label: 'Approved' },
]

export const SHIFTS: readonly ShiftId[] = ['morning', 'night']

export const SHIFT_OPTIONS: { value: ShiftId; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'night', label: 'Night' },
]

/** Drafts and returned reports are the operator's to change. */
export function isReportEditable(status: ReportStatus): boolean {
  return status === 'draft' || status === 'returned'
}

export function canSubmitReport(status: ReportStatus): boolean {
  return isReportEditable(status)
}

export function isReportDeletable(status: ReportStatus): boolean {
  return status === 'draft'
}

/** Status after a submit: a first submission is Pending Review, a corrected one is Revised. */
export function statusAfterSubmit(status: ReportStatus): ReportStatus | null {
  if (status === 'draft') return 'pending_review'
  if (status === 'returned') return 'revised'
  return null
}

export function canReportAgainstOrder(status: OrderStatus): boolean {
  return status === 'in_progress'
}

/** True for reports waiting on (or sent back to) a supervisor, so awaiting a decision. */
export function isAwaitingReview(status: ReportStatus): boolean {
  return status === 'pending_review' || status === 'revised'
}

/**
 * Report number: RPT-YYYYMMDD-<line code>-<AM|PM>. When that number is taken (a second machine on
 * the same line, shift and date) a sequence is appended: RPT-20261107-CUT-AM-2. Never reuses one.
 */
export function buildReportId(existing: readonly string[], date: string, lineCode: string, shift: ShiftId): string {
  const base = `RPT-${date.replace(/-/g, '')}-${lineCode}-${shift === 'morning' ? 'AM' : 'PM'}`
  const taken = new Set(existing)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** Derived values. Same formulas as the dashboard: good = produced - rejected, rate = rejected / produced. */
export function reportMetrics(r: Pick<ProductionReport, 'producedQuantity' | 'rejectedQuantity' | 'shiftTarget'>): ReportMetrics {
  const good = goodQuantity(r)
  return {
    goodQuantity: good,
    rejectionRate: rejectionRate(r.rejectedQuantity, r.producedQuantity),
    targetAchievement: targetAchievement(good, r.shiftTarget),
  }
}

/** Returns an error message, or null when the date is acceptable. */
export function validateReportDate(date: string, today: string, orderStart: string | undefined): string | null {
  if (date > today) return 'Report date cannot be in the future'
  if (orderStart !== undefined && date < orderStart) return `Report date is before the order's planned start (${orderStart})`
  return null
}

/** The report already filed for this machine, shift and date, if any. */
export function findSlotConflict(
  reports: readonly Pick<ProductionReport, 'id' | 'machineId' | 'shift' | 'reportDate'>[],
  slot: Pick<ReportInput, 'machineId' | 'shift' | 'reportDate'>,
  excludeId?: string,
): string | undefined {
  return reports.find(
    (r) =>
      r.id !== excludeId &&
      r.machineId === slot.machineId &&
      r.shift === slot.shift &&
      r.reportDate === slot.reportDate,
  )?.id
}

export { validateQuantities }

type EditableField = Exclude<keyof ReportInput, 'orderId'>

const FIELD_LABELS: Record<EditableField, string> = {
  machineId: 'Machine',
  shift: 'Shift',
  reportDate: 'Report date',
  producedQuantity: 'Produced',
  rejectedQuantity: 'Rejected',
  notes: 'Notes',
}

const COMPARED_FIELDS = Object.keys(FIELD_LABELS) as EditableField[]

/** Human-readable summary of what changed, for the audit history. Empty string = no changes. */
export function describeReportChanges(
  before: ReportInput,
  after: ReportInput,
  display: (field: EditableField, value: string | number) => string,
): string {
  const parts: string[] = []
  for (const field of COMPARED_FIELDS) {
    if (before[field] === after[field]) continue
    parts.push(
      field === 'notes'
        ? 'Notes changed'
        : `${FIELD_LABELS[field]}: ${display(field, before[field])} → ${display(field, after[field])}`,
    )
  }
  return parts.join('; ')
}
