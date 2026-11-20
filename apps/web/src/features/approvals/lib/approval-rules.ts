/**
 * Report review rules. Pure functions, no UI imports.
 *
 * Assumptions to confirm (the blueprint says a supervisor approves or returns, with a required
 * reason on return, and that approved reports must not be silently overwritten):
 * - Only supervisors review. Managers can see the queue's results through reports and history.
 * - Only reports waiting for review (Pending Review or Revised) can be approved or returned.
 * - A reviewer cannot review a report they filed themselves.
 * - A reason (at least 5 characters) is required to return a report.
 * - An approved report cannot be edited. A correction is a traceable "reopen": a supervisor gives
 *   a reason, the report goes back to Returned for Correction and out of the official figures
 *   until it is corrected, resubmitted and approved again. Nothing is overwritten; every step is
 *   in the report's history.
 */
import type { ApprovalItem } from '../types'

export {
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  canApprove,
  canReopen,
  canReturn,
  isSelfReview,
  validateReason,
} from '@shopfloor/shared'

/** Longest-waiting first, so nothing sits at the bottom of the queue. */
export function sortQueue(items: readonly ApprovalItem[]): ApprovalItem[] {
  return [...items].sort(
    (a, b) =>
      Date.parse(a.report.submittedAt ?? a.report.updatedAt) - Date.parse(b.report.submittedAt ?? b.report.updatedAt) ||
      a.report.id.localeCompare(b.report.id),
  )
}

/** Most recent decision first. */
export function sortDecided(items: readonly ApprovalItem[]): ApprovalItem[] {
  return [...items].sort(
    (a, b) =>
      Date.parse(b.report.reviewedAt ?? b.report.updatedAt) - Date.parse(a.report.reviewedAt ?? a.report.updatedAt) ||
      a.report.id.localeCompare(b.report.id),
  )
}
