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
import { isAwaitingReview, type ReportStatus } from './report-rules'

export const MIN_REASON_LENGTH = 5
export const MAX_REASON_LENGTH = 300

export function canApprove(status: ReportStatus): boolean {
  return isAwaitingReview(status)
}

export function canReturn(status: ReportStatus): boolean {
  return isAwaitingReview(status)
}

export function canReopen(status: ReportStatus): boolean {
  return status === 'approved'
}

/** Returns an error message, or null when the reason is acceptable. */
export function validateReason(reason: string): string | null {
  const trimmed = reason.trim()
  if (trimmed.length < MIN_REASON_LENGTH) return `Enter a reason of at least ${MIN_REASON_LENGTH} characters.`
  if (trimmed.length > MAX_REASON_LENGTH) return `Keep the reason under ${MAX_REASON_LENGTH} characters.`
  return null
}

/** True when the reviewer is the person who filed the report (names compared ignoring case and spacing). */
export function isSelfReview(reviewer: string, operatorName: string): boolean {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalize(reviewer) !== '' && normalize(reviewer) === normalize(operatorName)
}
