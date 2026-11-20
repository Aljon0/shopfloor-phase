/**
 * Read models for the Dashboard, Analytics and the daily/weekly operations summary.
 * Pure functions shared by the API (which computes them from the database) and the web mock mode.
 * The AI never calculates these; they are the official figures.
 *
 * Definitions:
 * - Production figures (produced, good, rejected, planned) count APPROVED reports dated in the range.
 *   Planned = sum of shift targets of those same reports, so target achievement is good / planned.
 * - Downtime counts all recorded downtime events that started within the range.
 * - Pending approvals is the current review queue across all dates.
 * - Analytics uses exactly the dashboard's definitions. Downtime is recorded per machine (and so per line),
 *   not per product or shift, so those breakdowns show no downtime.
 * - A weekly summary covers Monday to Sunday; a period not over yet is marked "in progress".
 */
import { downtimeMinutes, rejectionRate, summarizeQuantities, targetAchievement, type KpiSummary } from './kpi'
import { addDays, eachDate, factoryDateOf, formatDate, isValidDateString } from './dates'
import { DOWNTIME_CATEGORY_LABELS, SHIFT_LABELS, type DowntimeCategory } from './labels'
import type { ReportStatus, ShiftId } from './report-rules'

export type ActivityKind = 'report_submitted' | 'report_approved' | 'report_returned' | 'downtime_recorded'

export interface ActivityItem {
  id: string
  timestamp: string
  actor: string
  kind: ActivityKind
  orderId?: string
  reportId?: string
  /** Short reference such as 'RPT-20261103-CUT-AM · PO-2026-001'. */
  subject: string
  detail?: string
}

export interface ReadModelLine { id: string; name: string }
export interface ReadModelProduct { id: string; name: string }
export interface ReadModelMachine { id: string; name: string; lineId: string }
export interface ReadModelOrder { id: string; orderNumber: string; productId: string }
export interface ReadModelReport {
  id: string
  orderId: string
  lineId: string
  machineId: string
  shift: ShiftId
  reportDate: string
  status: ReportStatus
  operatorName: string
  submittedAt?: string | undefined
  producedQuantity: number
  rejectedQuantity: number
  shiftTarget: number
}
export interface ReadModelDowntime {
  lineId: string
  machineId: string
  category: DowntimeCategory
  startTime: string
  endTime: string
}


export interface DateRange {
  from: string
  to: string
}

export interface DashboardInput {
  lines: readonly ReadModelLine[]
  products: readonly ReadModelProduct[]
  orders: readonly ReadModelOrder[]
  reports: readonly ReadModelReport[]
  downtimeEvents: readonly ReadModelDowntime[]
  activity: readonly ActivityItem[]
}

export interface DashboardKpis extends KpiSummary {
  downtimeMinutes: number
  downtimeEvents: number
  pendingApprovals: number
}

export interface DailyPoint {
  date: string
  label: string
  plannedQuantity: number
  producedQuantity: number
  goodQuantity: number
  rejectedQuantity: number
  rejectionRate: number | null
  targetAchievement: number | null
  downtimeMinutes: number
  /** Reports dated this day that are still awaiting review and so are NOT in the figures above. */
  pendingReports: number
}

export interface LinePerformanceRow {
  lineId: string
  lineName: string
  producedQuantity: number
  goodQuantity: number
  rejectedQuantity: number
  rejectionRate: number | null
  plannedQuantity: number
  targetAchievement: number | null
  downtimeMinutes: number
}

export interface DowntimeCategoryRow {
  category: DowntimeCategory
  label: string
  minutes: number
  events: number
}

export interface PendingReportRow {
  id: string
  orderNumber: string
  productName: string
  lineName: string
  reportDate: string
  operatorName: string
  submittedAt: string | undefined
  producedQuantity: number
  goodQuantity: number
}

export interface DashboardData {
  range: DateRange
  /** Number of approved reports that make up the production figures. */
  approvedReportCount: number
  kpis: DashboardKpis
  daily: DailyPoint[]
  lines: LinePerformanceRow[]
  downtimeByCategory: DowntimeCategoryRow[]
  pendingApprovals: PendingReportRow[]
  recentActivity: ActivityItem[]
}

const RECENT_ACTIVITY_LIMIT = 8

const inRange = (date: string, { from, to }: DateRange): boolean => date >= from && date <= to

interface DatedDowntime {
  event: ReadModelDowntime
  date: string
  minutes: number
}

function datedDowntime(events: readonly ReadModelDowntime[], range: DateRange): DatedDowntime[] {
  const result: DatedDowntime[] = []
  for (const event of events) {
    const minutes = downtimeMinutes(event.startTime, event.endTime)
    if (minutes === null) continue
    const date = factoryDateOf(event.startTime)
    if (inRange(date, range)) result.push({ event, date, minutes })
  }
  return result
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

function toRecord(r: ReadModelReport) {
  return {
    producedQuantity: r.producedQuantity,
    rejectedQuantity: r.rejectedQuantity,
    plannedQuantity: r.shiftTarget,
  }
}

export function buildDashboard(input: DashboardInput, range: DateRange): DashboardData {
  const reportsInRange = input.reports.filter((r) => inRange(r.reportDate, range))
  const approved = reportsInRange.filter((r) => r.status === 'approved')
  const downtime = datedDowntime(input.downtimeEvents, range)
  const pending = input.reports.filter((r) => r.status === 'pending_review' || r.status === 'revised')

  const totals = summarizeQuantities(approved.map(toRecord))

  const kpis: DashboardKpis = {
    ...totals,
    downtimeMinutes: sum(downtime.map((d) => d.minutes)),
    downtimeEvents: downtime.length,
    pendingApprovals: pending.length,
  }

  // One point per date that has any report in the range (the factory may not run every day).
  const reportDates = new Set(reportsInRange.map((r) => r.reportDate))
  const daily: DailyPoint[] = eachDate(range.from, range.to)
    .filter((date) => reportDates.has(date))
    .map((date) => {
      const day = summarizeQuantities(approved.filter((r) => r.reportDate === date).map(toRecord))
      return {
        date,
        label: formatDate(date),
        plannedQuantity: day.plannedQuantity,
        producedQuantity: day.producedQuantity,
        goodQuantity: day.goodQuantity,
        rejectedQuantity: day.rejectedQuantity,
        rejectionRate: day.rejectionRate,
        targetAchievement: day.targetAchievement,
        downtimeMinutes: sum(downtime.filter((d) => d.date === date).map((d) => d.minutes)),
        pendingReports: reportsInRange.filter(
          (r) => r.reportDate === date && (r.status === 'pending_review' || r.status === 'revised'),
        ).length,
      }
    })

  const lines: LinePerformanceRow[] = input.lines.map((line) => {
    const s = summarizeQuantities(approved.filter((r) => r.lineId === line.id).map(toRecord))
    return {
      lineId: line.id,
      lineName: line.name,
      producedQuantity: s.producedQuantity,
      goodQuantity: s.goodQuantity,
      rejectedQuantity: s.rejectedQuantity,
      rejectionRate: rejectionRate(s.rejectedQuantity, s.producedQuantity),
      plannedQuantity: s.plannedQuantity,
      targetAchievement: targetAchievement(s.goodQuantity, s.plannedQuantity),
      downtimeMinutes: sum(downtime.filter((d) => d.event.lineId === line.id).map((d) => d.minutes)),
    }
  })

  const byCategory = new Map<DowntimeCategory, DowntimeCategoryRow>()
  for (const d of downtime) {
    const existing = byCategory.get(d.event.category)
    if (existing) {
      existing.minutes += d.minutes
      existing.events += 1
    } else {
      byCategory.set(d.event.category, {
        category: d.event.category,
        label: DOWNTIME_CATEGORY_LABELS[d.event.category],
        minutes: d.minutes,
        events: 1,
      })
    }
  }
  const downtimeByCategory = [...byCategory.values()].sort((a, b) => b.minutes - a.minutes)

  const orderById = new Map(input.orders.map((o) => [o.id, o]))
  const productById = new Map(input.products.map((p) => [p.id, p]))
  const lineById = new Map(input.lines.map((l) => [l.id, l]))

  const pendingApprovals: PendingReportRow[] = pending
    .map((r) => {
      const order = orderById.get(r.orderId)
      return {
        id: r.id,
        orderNumber: order?.orderNumber ?? r.orderId,
        productName: (order && productById.get(order.productId)?.name) ?? 'Unknown product',
        lineName: lineById.get(r.lineId)?.name ?? r.lineId,
        reportDate: r.reportDate,
        operatorName: r.operatorName,
        submittedAt: r.submittedAt,
        producedQuantity: r.producedQuantity,
        goodQuantity: r.producedQuantity - r.rejectedQuantity,
      }
    })
    .sort((a, b) => Date.parse(a.submittedAt ?? '') - Date.parse(b.submittedAt ?? ''))

  const recentActivity = [...input.activity]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, RECENT_ACTIVITY_LIMIT)

  return {
    range,
    approvedReportCount: approved.length,
    kpis,
    daily,
    lines,
    downtimeByCategory,
    pendingApprovals,
    recentActivity,
  }
}


export type Dimension = 'line' | 'product' | 'machine' | 'shift'

export interface AnalyticsInput extends DashboardInput {
  machines: readonly ReadModelMachine[]
}

export interface BreakdownRow {
  key: string
  label: string
  /** Line name for machines, so machines can be grouped visually. */
  group?: string
  reports: number
  producedQuantity: number
  goodQuantity: number
  rejectedQuantity: number
  plannedQuantity: number
  rejectionRate: number | null
  targetAchievement: number | null
  /** null when downtime is not recorded for this dimension. */
  downtimeMinutes: number | null
}

export interface AnalyticsData {
  range: DateRange
  approvedReportCount: number
  daily: DailyPoint[]
  downtimeByCategory: DowntimeCategoryRow[]
  totals: { producedQuantity: number; goodQuantity: number; rejectedQuantity: number; plannedQuantity: number; rejectionRate: number | null; targetAchievement: number | null; downtimeMinutes: number }
  breakdowns: Record<Dimension, BreakdownRow[]>
}

function row(key: string, label: string, reports: readonly ReadModelReport[], downtime: number | null, group?: string): BreakdownRow {
  const s = summarizeQuantities(reports.map(toRecord))
  return {
    key,
    label,
    ...(group ? { group } : {}),
    reports: reports.length,
    producedQuantity: s.producedQuantity,
    goodQuantity: s.goodQuantity,
    rejectedQuantity: s.rejectedQuantity,
    plannedQuantity: s.plannedQuantity,
    rejectionRate: rejectionRate(s.rejectedQuantity, s.producedQuantity),
    targetAchievement: targetAchievement(s.goodQuantity, s.plannedQuantity),
    downtimeMinutes: downtime,
  }
}

/** Highest output first; ties by name, so the order is stable. */
const byOutput = (a: BreakdownRow, b: BreakdownRow): number =>
  b.producedQuantity - a.producedQuantity || (b.downtimeMinutes ?? 0) - (a.downtimeMinutes ?? 0) || a.label.localeCompare(b.label)

export function buildAnalytics(input: AnalyticsInput, range: DateRange): AnalyticsData {
  const dashboard = buildDashboard(input, range)
  const approved = input.reports.filter((r) => r.status === 'approved' && r.reportDate >= range.from && r.reportDate <= range.to)

  const events = input.downtimeEvents
    .map((event) => ({ event, minutes: downtimeMinutes(event.startTime, event.endTime), date: factoryDateOf(event.startTime) }))
    .filter((d): d is { event: typeof d.event; minutes: number; date: string } => d.minutes !== null && d.date >= range.from && d.date <= range.to)
  const minutesFor = (pick: (e: (typeof events)[number]['event']) => boolean): number =>
    events.filter((d) => pick(d.event)).reduce((s, d) => s + d.minutes, 0)

  const orderProduct = new Map(input.orders.map((o) => [o.id, o.productId]))
  const lineName = new Map(input.lines.map((l) => [l.id, l.name]))

  const line = input.lines.map((l) => row(l.id, l.name, approved.filter((r) => r.lineId === l.id), minutesFor((e) => e.lineId === l.id)))
  const machine = input.machines.map((m) => row(m.id, m.name, approved.filter((r) => r.machineId === m.id), minutesFor((e) => e.machineId === m.id), lineName.get(m.lineId)))
  const product = input.products.map((p) => row(p.id, p.name, approved.filter((r) => orderProduct.get(r.orderId) === p.id), null))
  const shifts = (Object.keys(SHIFT_LABELS) as ShiftId[]).map((s) => row(s, SHIFT_LABELS[s], approved.filter((r) => r.shift === s), null))

  // Hide rows that did nothing in the period, except when nothing at all happened.
  const active = (rows: BreakdownRow[]) => rows.filter((r) => r.reports > 0 || (r.downtimeMinutes ?? 0) > 0).sort(byOutput)

  const totals = summarizeQuantities(approved.map(toRecord))
  return {
    range,
    approvedReportCount: approved.length,
    daily: dashboard.daily,
    downtimeByCategory: dashboard.downtimeByCategory,
    totals: {
      producedQuantity: totals.producedQuantity,
      goodQuantity: totals.goodQuantity,
      rejectedQuantity: totals.rejectedQuantity,
      plannedQuantity: totals.plannedQuantity,
      rejectionRate: totals.rejectionRate,
      targetAchievement: totals.targetAchievement,
      downtimeMinutes: dashboard.kpis.downtimeMinutes,
    },
    breakdowns: { line: active(line), machine: active(machine), product: active(product), shift: active(shifts) },
  }
}


export type SummaryKind = 'daily' | 'weekly'

export interface SummaryMeta {
  generatedBy: string
  /** ISO timestamp. */
  generatedAt: string
  /** Factory's current date, used to flag periods that are not over yet. */
  today: string
}

export interface ReportsExcluded {
  awaitingReview: number
  returned: number
  draft: number
}

export interface OperationalSummary {
  kind: SummaryKind
  title: string
  range: DateRange
  meta: SummaryMeta
  inProgress: boolean
  approvedReportCount: number
  kpis: DashboardKpis
  lines: LinePerformanceRow[]
  /** Weekly summaries show each day; a daily summary has one point at most. */
  daily: DailyPoint[]
  downtimeByCategory: DowntimeCategoryRow[]
  /** Reports dated in the period that are NOT in the figures. */
  excluded: ReportsExcluded
}

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

export function periodFor(kind: SummaryKind, anchor: string): DateRange | null {
  if (!isValidDateString(anchor)) return null
  if (kind === 'daily') return { from: anchor, to: anchor }
  const from = weekStart(anchor)
  return { from, to: addDays(from, 6) }
}

/** Moves the anchor date by whole days or weeks. */
export function shiftAnchor(kind: SummaryKind, anchor: string, direction: -1 | 1): string {
  return addDays(anchor, direction * (kind === 'daily' ? 1 : 7))
}

export function summaryTitle(kind: SummaryKind, range: DateRange): string {
  return kind === 'daily' ? `Daily operations summary ${range.from}` : `Weekly operations summary ${range.from} to ${range.to}`
}

export function buildSummary(input: DashboardInput, kind: SummaryKind, anchor: string, meta: SummaryMeta): OperationalSummary | null {
  const range = periodFor(kind, anchor)
  if (!range) return null
  const dash = buildDashboard(input, range)
  const inPeriod = input.reports.filter((r) => r.reportDate >= range.from && r.reportDate <= range.to)
  const count = (status: string[]) => inPeriod.filter((r) => status.includes(r.status)).length
  return {
    kind,
    title: summaryTitle(kind, range),
    range,
    meta,
    inProgress: range.to >= meta.today,
    approvedReportCount: dash.approvedReportCount,
    kpis: dash.kpis,
    lines: dash.lines,
    daily: dash.daily,
    downtimeByCategory: dash.downtimeByCategory,
    excluded: {
      awaitingReview: count(['pending_review', 'revised']),
      returned: count(['returned']),
      draft: count(['draft']),
    },
  }
}

export const MAX_RANGE_DAYS = 366

/** Returns an error message for an unusable range, or null when it is fine. Used by the API; the web shows the same texts. */
export function validateDateRange(range: DateRange): string | null {
  if (!isValidDateString(range.from) || !isValidDateString(range.to)) return 'Enter a valid start and end date.'
  if (range.from > range.to) return 'The start date must be on or before the end date.'
  if (addDays(range.from, MAX_RANGE_DAYS) < range.to) return `Choose a range of ${MAX_RANGE_DAYS} days or less.`
  return null
}
