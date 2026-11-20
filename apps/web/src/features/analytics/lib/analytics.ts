/**
 * Analytics aggregation. Pure functions, no React.
 *
 * Uses exactly the dashboard's definitions so the two screens can never disagree:
 * production figures count APPROVED reports dated in the range; planned = the sum of those
 * reports' shift targets; rejection rate and target achievement are null when the denominator is 0.
 * Downtime counts every recorded event that started in the range. Downtime is recorded per
 * machine (and so per line), not per product or shift, so those breakdowns show no downtime.
 */
import { buildDashboard, type DailyPoint, type DashboardInput, type DateRange, type DowntimeCategoryRow } from '@/features/dashboard/lib/aggregate'
import { SHIFT_LABELS } from '@/lib/labels'
import { downtimeMinutes, rejectionRate, summarizeQuantities, targetAchievement } from '@/lib/kpi'
import { factoryDateOf } from '@/lib/dates'
import type { Machine, ProductionReport, ShiftId } from '@/types/domain'

export type Dimension = 'line' | 'product' | 'machine' | 'shift'

export interface AnalyticsInput extends DashboardInput {
  machines: readonly Machine[]
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

const toRecord = (r: ProductionReport) => ({
  producedQuantity: r.producedQuantity,
  rejectedQuantity: r.rejectedQuantity,
  plannedQuantity: r.shiftTarget,
})

function row(key: string, label: string, reports: readonly ProductionReport[], downtime: number | null, group?: string): BreakdownRow {
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
