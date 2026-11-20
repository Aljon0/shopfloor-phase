import {
  buildAnalytics,
  buildDashboard,
  buildSummary,
  periodFor,
  validateDateRange,
  type ActivityItem,
  type DateRange,
  type ReadModelDowntime,
  type ReadModelReport,
  type ReportStatus,
  type SummaryKind,
  type ShiftId,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest } from '../../lib/errors'
import { factoryToday } from '../orders/orders.service'

const fromDate = (d: Date): string => d.toISOString().slice(0, 10)
const utcDate = (s: string): Date => new Date(`${s}T00:00:00Z`)
const DAY_MS = 86_400_000
const ACTIVITY_FETCH = 30

export function assertRange(range: DateRange): void {
  const error = validateDateRange(range)
  if (error) throw badRequest(error)
}

/**
 * Everything the builders need for a range. Reports: those dated in the range plus the whole review queue
 * (pending counts are across all dates). Downtime: events starting within a day of the range; the builder
 * does the exact factory-date test, so a Manila midnight edge case cannot be missed here.
 */
async function load(db: Db, range: DateRange, withActivity: boolean) {
  const from = utcDate(range.from)
  const to = utcDate(range.to)
  const [lines, products, machines, orders, reportRows, downtimeRows] = await Promise.all([
    db.productionLine.findMany({ orderBy: { name: 'asc' } }),
    db.product.findMany({ orderBy: { name: 'asc' } }),
    db.machine.findMany({ orderBy: { name: 'asc' } }),
    db.productionOrder.findMany({ select: { id: true, orderNumber: true, productId: true } }),
    db.productionReport.findMany({
      where: { OR: [{ reportDate: { gte: from, lte: to } }, { status: { in: ['pending_review', 'revised'] } }] },
      include: { operator: { select: { name: true } } },
    }),
    db.downtimeEvent.findMany({
      where: { startTime: { gte: new Date(from.getTime() - DAY_MS), lt: new Date(to.getTime() + 2 * DAY_MS) } },
    }),
  ])

  const reports: ReadModelReport[] = reportRows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    lineId: r.lineId,
    machineId: r.machineId,
    shift: r.shiftId as ShiftId,
    reportDate: fromDate(r.reportDate),
    status: r.status as ReportStatus,
    operatorName: r.operator.name,
    ...(r.submittedAt ? { submittedAt: r.submittedAt.toISOString() } : {}),
    producedQuantity: r.producedQuantity,
    rejectedQuantity: r.rejectedQuantity,
    shiftTarget: r.shiftTarget,
  }))
  const downtimeEvents: ReadModelDowntime[] = downtimeRows.map((e) => ({
    lineId: e.lineId,
    machineId: e.machineId,
    category: e.category,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
  }))

  return {
    lines: lines.map((l) => ({ id: l.id, name: l.name })),
    products: products.map((p) => ({ id: p.id, name: p.name })),
    machines: machines.map((m) => ({ id: m.id, name: m.name, lineId: m.lineId })),
    orders,
    reports,
    downtimeEvents,
    activity: withActivity ? await loadActivity(db) : [],
  }
}

/**
 * There is no activity table: the feed is derived from what is already recorded.
 * Report history (submitted, resubmitted, approved, returned) and downtime events, newest first.
 */
export async function loadActivity(db: Db): Promise<ActivityItem[]> {
  const [history, downtime] = await Promise.all([
    db.reportHistory.findMany({
      where: { action: { in: ['submitted', 'resubmitted', 'approved', 'returned'] } },
      orderBy: { timestamp: 'desc' },
      take: ACTIVITY_FETCH,
      include: { actor: { select: { name: true } }, report: { select: { id: true, orderId: true } } },
    }),
    db.downtimeEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_FETCH,
      include: { recordedBy: { select: { name: true } } },
    }),
  ])
  const items: ActivityItem[] = []
  for (const h of history) {
    const kind = h.action === 'approved' ? 'report_approved' : h.action === 'returned' ? 'report_returned' : 'report_submitted'
    items.push({
      id: h.id,
      timestamp: h.timestamp.toISOString(),
      actor: h.actor.name,
      kind,
      orderId: h.report.orderId,
      reportId: h.report.id,
      subject: `${h.report.id} · ${h.report.orderId}`,
    })
  }
  for (const e of downtime) {
    items.push({
      id: `${e.id}-rec`,
      timestamp: e.createdAt.toISOString(),
      actor: e.recordedBy.name,
      kind: 'downtime_recorded',
      ...(e.orderId ? { orderId: e.orderId } : {}),
      subject: `${e.id} · ${e.orderId ?? 'No order'}`,
    })
  }
  return items
}

export async function dashboard(db: Db, range: DateRange) {
  assertRange(range)
  const { machines: _machines, ...input } = await load(db, range, true)
  return buildDashboard(input, range)
}

export async function analytics(db: Db, range: DateRange) {
  assertRange(range)
  return buildAnalytics(await load(db, range, false), range)
}

export async function summary(db: Db, kind: SummaryKind, anchor: string, generatedBy: string) {
  const range = periodFor(kind, anchor)
  if (!range) throw badRequest('Invalid date')
  const { machines: _machines, ...input } = await load(db, range, false)
  const result = buildSummary(input, kind, anchor, { generatedBy, generatedAt: new Date().toISOString(), today: factoryToday() })
  if (!result) throw badRequest('Invalid date')
  return result
}
