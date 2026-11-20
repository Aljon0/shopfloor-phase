/**
 * Daily and weekly operational summaries. Pure functions, no React.
 *
 * Assumptions to confirm:
 * - A weekly summary covers Monday to Sunday (Sunday has no production in the demo data).
 * - A summary of a period that has not ended yet is allowed and marked "in progress".
 * - Figures follow the dashboard: approved reports only. Reports still in the review flow are listed
 *   separately so nobody mistakes a partial period for a complete one.
 */
import { buildDashboard, type DailyPoint, type DashboardInput, type DashboardKpis, type DateRange, type DowntimeCategoryRow, type LinePerformanceRow } from '@/features/dashboard/lib/aggregate'
import { addDays, isValidDateString } from '@/lib/dates'

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
