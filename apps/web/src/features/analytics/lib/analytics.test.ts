import { describe, expect, it } from 'vitest'
import { buildDashboard } from '@/features/dashboard/lib/aggregate'
import { DOWNTIME_EVENTS, LINES, MACHINES, ORDERS, PRODUCTS, REPORTS, ACTIVITY } from '@/mocks/seed'
import { buildAnalytics, type AnalyticsInput } from './analytics'
import { buildBreakdownCsv, buildTrendCsv } from './analytics-export'

const input: AnalyticsInput = {
  lines: LINES,
  products: PRODUCTS,
  machines: MACHINES,
  orders: ORDERS,
  reports: REPORTS,
  downtimeEvents: DOWNTIME_EVENTS,
  activity: ACTIVITY,
}
const range = { from: '2026-11-01', to: '2026-11-07' }
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('analytics aggregation', () => {
  const data = buildAnalytics(input, range)
  const dash = buildDashboard(input, range)

  it('agrees with the dashboard on totals, daily points and downtime categories', () => {
    expect(data.totals.producedQuantity).toBe(dash.kpis.producedQuantity)
    expect(data.totals.goodQuantity).toBe(dash.kpis.goodQuantity)
    expect(data.totals.rejectedQuantity).toBe(dash.kpis.rejectedQuantity)
    expect(data.totals.plannedQuantity).toBe(dash.kpis.plannedQuantity)
    expect(data.totals.downtimeMinutes).toBe(dash.kpis.downtimeMinutes)
    expect(data.daily).toEqual(dash.daily)
    expect(data.downtimeByCategory).toEqual(dash.downtimeByCategory)
  })

  it('every dimension that sees all approved reports adds up to the totals', () => {
    for (const d of ['line', 'machine', 'product', 'shift'] as const) {
      expect(sum(data.breakdowns[d].map((r) => r.producedQuantity)), d).toBe(data.totals.producedQuantity)
      expect(sum(data.breakdowns[d].map((r) => r.rejectedQuantity)), d).toBe(data.totals.rejectedQuantity)
      expect(sum(data.breakdowns[d].map((r) => r.reports)), d).toBe(data.approvedReportCount)
    }
  })

  it('line and machine downtime add up to total downtime; product and shift show none', () => {
    expect(sum(data.breakdowns.line.map((r) => r.downtimeMinutes ?? 0))).toBe(data.totals.downtimeMinutes)
    expect(sum(data.breakdowns.machine.map((r) => r.downtimeMinutes ?? 0))).toBe(data.totals.downtimeMinutes)
    expect(data.breakdowns.product.every((r) => r.downtimeMinutes === null)).toBe(true)
    expect(data.breakdowns.shift.every((r) => r.downtimeMinutes === null)).toBe(true)
  })

  it('computes rates from summed quantities and sorts by output', () => {
    for (const r of data.breakdowns.line) {
      expect(r.rejectionRate).toBe(r.producedQuantity > 0 ? (r.rejectedQuantity / r.producedQuantity) * 100 : null)
      expect(r.goodQuantity).toBe(r.producedQuantity - r.rejectedQuantity)
    }
    const produced = data.breakdowns.line.map((r) => r.producedQuantity)
    expect(produced).toEqual([...produced].sort((a, b) => b - a))
  })

  it('counts approved reports only', () => {
    const approvedOnly = REPORTS.filter((r) => r.status === 'approved' && r.reportDate >= range.from && r.reportDate <= range.to)
    expect(data.approvedReportCount).toBe(approvedOnly.length)
    expect(data.totals.producedQuantity).toBe(sum(approvedOnly.map((r) => r.producedQuantity)))
  })

  it('returns empty breakdowns and null rates for a period with no activity', () => {
    const empty = buildAnalytics(input, { from: '2025-01-01', to: '2025-01-07' })
    expect(empty.approvedReportCount).toBe(0)
    expect(empty.totals.rejectionRate).toBeNull()
    expect(empty.totals.targetAchievement).toBeNull()
    expect(empty.breakdowns.line).toEqual([])
    expect(empty.daily).toEqual([])
  })

  it('exports CSV with the same figures and a dated filename', () => {
    const { filename, csv } = buildBreakdownCsv(data, 'line')
    expect(filename).toBe('shopfloor-analytics-by-line-2026-11-01_to_2026-11-07.csv')
    expect(csv.split('\r\n')).toHaveLength(data.breakdowns.line.length + 1)
    expect(buildTrendCsv(data).csv.split('\r\n')).toHaveLength(data.daily.length + 1)
  })
})
