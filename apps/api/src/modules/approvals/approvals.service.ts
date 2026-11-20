import { canApprove, canReopen, canReturn, downtimeMinutes, reportMetrics, validateQuantities, validateReason, type ReportStatus } from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest, ruleViolation } from '../../lib/errors'
import { newId } from '../../lib/ids'
import type { AuthUser } from '../../middleware/context'
import { addHistory, lockReport, reportInclude, toReport } from '../reports/reports.service'

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]

/** Every submitted report (drafts are the operator's own and never reach a reviewer). */
export async function listApprovalItems(db: Db) {
  const rows = await db.productionReport.findMany({
    where: { status: { not: 'draft' } },
    include: {
      ...reportInclude,
      order: { select: { product: { select: { name: true } } } },
      line: { select: { name: true } },
      machine: { select: { name: true } },
      downtime: { select: { startTime: true, endTime: true } },
    },
    orderBy: [{ reportDate: 'desc' }, { id: 'asc' }],
  })
  return rows.map((r) => ({
    report: toReport(r),
    productName: r.order.product.name,
    lineName: r.line.name,
    machineName: r.machine.name,
    metrics: reportMetrics(r),
    downtimeMinutes: r.downtime.reduce((sum, e) => sum + (downtimeMinutes(e.startTime.toISOString(), e.endTime.toISOString()) ?? 0), 0),
  }))
}

async function loadForDecision(tx: Tx, reportId: string, reviewer: AuthUser, allowed: (s: ReportStatus) => boolean, notAllowed: string) {
  const report = await lockReport(tx, reportId)
  if (!allowed(report.status)) throw ruleViolation(notAllowed)
  // Compared by account, not by name, so two people with similar names cannot be confused.
  if (report.operatorId === reviewer.id) throw ruleViolation('You filed this report, so another supervisor has to review it.')
  return report
}

function checkReason(reason: string): string {
  const problem = validateReason(reason)
  if (problem) throw badRequest('Some fields are not valid.', { reason: problem })
  return reason.trim()
}

async function record(tx: Tx, reportId: string, reviewer: AuthUser, decision: 'approved' | 'returned' | 'reopened', reason: string | null) {
  await tx.approval.create({ data: { id: newId('apr'), reportId, decision, reviewerId: reviewer.id, reason } })
}

export async function approveReport(db: Db, reviewer: AuthUser, reportId: string) {
  return db.$transaction(async (tx) => {
    const report = await loadForDecision(tx, reportId, reviewer, canApprove, 'Only reports waiting for review can be approved.')
    // Never approve figures that break the quantity rules, whatever was accepted earlier.
    if (validateQuantities(report).length > 0) throw ruleViolation('The quantities on this report are inconsistent. Return it for correction instead.')
    const updated = await tx.productionReport.update({
      where: { id: reportId },
      data: { status: 'approved', reviewedAt: new Date(), reviewedById: reviewer.id, returnReason: null },
      include: reportInclude,
    })
    await addHistory(tx, reportId, reviewer, 'approved', 'Approved')
    await record(tx, reportId, reviewer, 'approved', null)
    return toReport(updated)
  })
}

export async function returnReport(db: Db, reviewer: AuthUser, reportId: string, rawReason: string) {
  const reason = checkReason(rawReason)
  return db.$transaction(async (tx) => {
    await loadForDecision(tx, reportId, reviewer, canReturn, 'Only reports waiting for review can be returned.')
    const updated = await tx.productionReport.update({
      where: { id: reportId },
      data: { status: 'returned', returnReason: reason, reviewedAt: new Date(), reviewedById: reviewer.id },
      include: reportInclude,
    })
    await addHistory(tx, reportId, reviewer, 'returned', `Returned for correction: ${reason}`)
    await record(tx, reportId, reviewer, 'returned', reason)
    return toReport(updated)
  })
}

/** A traceable correction of an approved report: back to Returned for Correction, with a reason. */
export async function reopenReport(db: Db, reviewer: AuthUser, reportId: string, rawReason: string) {
  const reason = checkReason(rawReason)
  return db.$transaction(async (tx) => {
    await loadForDecision(tx, reportId, reviewer, canReopen, 'Only approved reports can be reopened for correction.')
    const updated = await tx.productionReport.update({
      where: { id: reportId },
      data: { status: 'returned', returnReason: reason, reviewedAt: new Date(), reviewedById: reviewer.id },
      include: reportInclude,
    })
    await addHistory(tx, reportId, reviewer, 'reopened', `Reopened for correction: ${reason}`)
    await record(tx, reportId, reviewer, 'reopened', reason)
    return toReport(updated)
  })
}

