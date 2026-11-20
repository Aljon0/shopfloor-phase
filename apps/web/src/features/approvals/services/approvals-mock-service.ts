/**
 * Service boundary for report review (mock backend today, API later). Rules are enforced here, not
 * only in the UI: hiding or disabling buttons is not security, and the backend must repeat them.
 */
import { listReportItems } from '@/features/production-reports/services/reports-service'
import { downtimeMinutes, validateQuantities } from '@/lib/kpi'
import { mockRepository } from '@/mocks/repository'
import type { ActivityItem, ProductionReport, ReportHistoryEntry } from '@/types/domain'
import type { ReportStatus } from '@/types/status'
import { canApprove, canReopen, canReturn, isSelfReview, validateReason } from '../lib/approval-rules'
import type { ApprovalItem } from '../types'

export class ApprovalRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApprovalRuleError'
  }
}

/** Every submitted report (drafts are the operator's own and never reach a reviewer). */
export async function listApprovalItems(): Promise<ApprovalItem[]> {
  const [items, events] = await Promise.all([listReportItems(), mockRepository.listDowntimeEvents()])
  const minutesByReport = new Map<string, number>()
  for (const e of events) {
    if (!e.reportId) continue
    const minutes = downtimeMinutes(e.startTime, e.endTime)
    if (minutes !== null) minutesByReport.set(e.reportId, (minutesByReport.get(e.reportId) ?? 0) + minutes)
  }
  return items
    .filter((i) => i.report.status !== 'draft')
    .map((i) => ({ ...i, downtimeMinutes: minutesByReport.get(i.report.id) ?? 0 }))
}

async function loadForDecision(
  reportId: string,
  reviewer: string,
  allowed: (status: ReportStatus) => boolean,
  notAllowedMessage: string,
): Promise<ProductionReport> {
  const report = (await mockRepository.listReports()).find((r) => r.id === reportId)
  if (!report) throw new ApprovalRuleError(`Report ${reportId} was not found.`)
  if (!allowed(report.status)) throw new ApprovalRuleError(notAllowedMessage)
  if (isSelfReview(reviewer, report.operatorName)) {
    throw new ApprovalRuleError('You filed this report, so another supervisor has to review it.')
  }
  return report
}

function entry(reportId: string, actor: string, action: ReportHistoryEntry['action'], detail: string, timestamp: string): ReportHistoryEntry {
  return { id: `RH-${crypto.randomUUID()}`, reportId, timestamp, actor, action, detail }
}

function activity(report: ProductionReport, actor: string, kind: ActivityItem['kind'], timestamp: string, detail?: string): ActivityItem {
  return {
    id: `ACT-${crypto.randomUUID()}`,
    timestamp,
    actor,
    kind,
    orderId: report.orderId,
    reportId: report.id,
    subject: `${report.id} · ${report.orderId}`,
    ...(detail ? { detail } : {}),
  }
}

/** Drops the previous decision's reason: it is resolved, and stays in the history. */
function withoutReason(report: ProductionReport): ProductionReport {
  const { returnReason: _previous, ...rest } = report
  return rest
}

export async function approveReport(reportId: string, reviewer: string): Promise<ProductionReport> {
  const report = await loadForDecision(reportId, reviewer, canApprove, 'Only reports waiting for review can be approved.')
  // Never approve figures that break the quantity rules, whatever the form allowed earlier.
  if (validateQuantities(report).length > 0) {
    throw new ApprovalRuleError('The quantities on this report are inconsistent. Return it for correction instead.')
  }
  const now = new Date().toISOString()
  const approved: ProductionReport = { ...withoutReason(report), status: 'approved', reviewedAt: now, reviewedBy: reviewer, updatedAt: now }
  return mockRepository.replaceReport(approved, [entry(report.id, reviewer, 'approved', 'Approved', now)], activity(report, reviewer, 'report_approved', now))
}

export async function returnReport(reportId: string, reviewer: string, reason: string): Promise<ProductionReport> {
  const reasonError = validateReason(reason)
  if (reasonError) throw new ApprovalRuleError(reasonError)
  const report = await loadForDecision(reportId, reviewer, canReturn, 'Only reports waiting for review can be returned.')
  const clean = reason.trim()
  const now = new Date().toISOString()
  const returned: ProductionReport = { ...report, status: 'returned', returnReason: clean, reviewedAt: now, reviewedBy: reviewer, updatedAt: now }
  return mockRepository.replaceReport(
    returned,
    [entry(report.id, reviewer, 'returned', `Returned for correction: ${clean}`, now)],
    activity(report, reviewer, 'report_returned', now, clean),
  )
}

/** A traceable correction of an approved report: back to Returned for Correction, with a reason. */
export async function reopenReport(reportId: string, reviewer: string, reason: string): Promise<ProductionReport> {
  const reasonError = validateReason(reason)
  if (reasonError) throw new ApprovalRuleError(reasonError)
  const report = await loadForDecision(reportId, reviewer, canReopen, 'Only approved reports can be reopened for correction.')
  const clean = reason.trim()
  const now = new Date().toISOString()
  const reopened: ProductionReport = { ...report, status: 'returned', returnReason: clean, reviewedAt: now, reviewedBy: reviewer, updatedAt: now }
  return mockRepository.replaceReport(
    reopened,
    [entry(report.id, reviewer, 'reopened', `Reopened for correction: ${clean}`, now)],
    activity(report, reviewer, 'report_returned', now, `Approved report reopened: ${clean}`),
  )
}
