/**
 * Dashboard aggregation. Pure functions, independent of React and of where data comes from.
 *
 * Definitions (shown to users in the dashboard UI):
 * - Production figures (produced, good, rejected, planned) count APPROVED reports dated in the range.
 *   Planned = sum of shift targets of those same reports, so target achievement is
 *   good / planned over summed quantities.
 * - Downtime counts all recorded downtime events that started within the range.
 * - Pending approvals is the current review queue across all dates.
 */
import { downtimeMinutes, rejectionRate, summarizeQuantities, targetAchievement, type KpiSummary } from '@/lib/kpi'
import { eachDate, factoryDateOf, formatDate } from '@/lib/dates'
import { DOWNTIME_CATEGORY_LABELS } from '@/lib/labels'
import type {
  ActivityItem,
  DowntimeCategory,
  DowntimeEvent,
  Product,
  ProductionLine,
  ProductionOrder,
  ProductionReport,
} from '@/types/domain'

export interface DateRange {
  from: string
  to: string
}

export interface DashboardInput {
  lines: readonly ProductionLine[]
  products: readonly Product[]
  orders: readonly ProductionOrder[]
  reports: readonly ProductionReport[]
  downtimeEvents: readonly DowntimeEvent[]
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
  event: DowntimeEvent
  date: string
  minutes: number
}

function datedDowntime(events: readonly DowntimeEvent[], range: DateRange): DatedDowntime[] {
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

function toRecord(r: ProductionReport) {
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
