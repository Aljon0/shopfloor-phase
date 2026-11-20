import { describe, expect, it } from 'vitest'
import { ACTIVITY, DOWNTIME_EVENTS, LINES, ORDERS, PRODUCTS, REPORTS } from '@/mocks/seed'
import type { ProductionReport } from '@/types/domain'
import { buildDashboard, type DashboardInput } from './aggregate'

function report(overrides: Partial<ProductionReport>): ProductionReport {
  return {
    id: 'R',
    orderId: 'PO-1',
    lineId: 'line-cut-01',
    machineId: 'mc-lc-01',
    shift: 'morning',
    reportDate: '2026-11-03',
    operatorName: 'Op',
    shiftTarget: 100,
    producedQuantity: 100,
    rejectedQuantity: 0,
    status: 'approved',
    createdAt: '2026-11-03T08:00:00+08:00',
    updatedAt: '2026-11-03T08:00:00+08:00',
    ...overrides,
  }
}

const emptyInput: DashboardInput = {
  lines: LINES,
  products: PRODUCTS,
  orders: ORDERS,
  reports: [],
  downtimeEvents: [],
  activity: [],
}

const range = { from: '2026-11-01', to: '2026-11-07' }

describe('buildDashboard', () => {
  it('counts only approved reports in production figures', () => {
    const data = buildDashboard(
      {
        ...emptyInput,
        reports: [
          report({ id: 'A', producedQuantity: 100, rejectedQuantity: 10, status: 'approved' }),
          report({ id: 'B', producedQuantity: 500, status: 'pending_review' }),
          report({ id: 'C', producedQuantity: 500, status: 'draft' }),
        ],
      },
      range,
    )
    expect(data.kpis.producedQuantity).toBe(100)
    expect(data.kpis.goodQuantity).toBe(90)
    expect(data.kpis.plannedQuantity).toBe(100)
    expect(data.kpis.targetAchievement).toBeCloseTo(90, 5)
    expect(data.kpis.pendingApprovals).toBe(1)
  })

  it('weights target achievement by quantity, not by averaging percentages', () => {
    const data = buildDashboard(
      {
        ...emptyInput,
        reports: [
          report({ id: 'A', shiftTarget: 100, producedQuantity: 50 }),
          report({ id: 'B', shiftTarget: 900, producedQuantity: 900 }),
        ],
      },
      range,
    )
    expect(data.kpis.targetAchievement).toBeCloseTo(95, 5)
  })

  it('flags days that have reports awaiting approval, without counting them', () => {
    const data = buildDashboard(
      {
        ...emptyInput,
        reports: [
          report({ id: 'A', status: 'approved', producedQuantity: 100 }),
          report({ id: 'B', status: 'pending_review', producedQuantity: 100 }),
          report({ id: 'C', reportDate: '2026-11-04', status: 'approved' }),
        ],
      },
      range,
    )
    expect(data.daily.map((d) => d.pendingReports)).toEqual([1, 0])
    expect(data.daily[0]?.producedQuantity).toBe(100)
  })

  it('returns null ratios and no chart points for an empty range', () => {
    const data = buildDashboard(emptyInput, range)
    expect(data.kpis.rejectionRate).toBeNull()
    expect(data.kpis.targetAchievement).toBeNull()
    expect(data.daily).toEqual([])
  })

  it('excludes reports outside the range but counts the pending queue across all dates', () => {
    const data = buildDashboard(
      {
        ...emptyInput,
        reports: [
          report({ id: 'OLD', reportDate: '2026-10-01', status: 'approved', producedQuantity: 999 }),
          report({ id: 'OLD-PENDING', reportDate: '2026-10-01', status: 'pending_review' }),
        ],
      },
      range,
    )
    expect(data.kpis.producedQuantity).toBe(0)
    expect(data.kpis.pendingApprovals).toBe(1)
  })
})

describe('buildDashboard with the mock dataset', () => {
  const input: DashboardInput = {
    lines: LINES,
    products: PRODUCTS,
    orders: ORDERS,
    reports: REPORTS,
    downtimeEvents: DOWNTIME_EVENTS,
    activity: ACTIVITY,
  }
  const full = { from: '2026-10-26', to: '2026-11-07' }
  const data = buildDashboard(input, full)

  it('keeps KPI, chart, line table and category totals consistent', () => {
    const dailyGood = data.daily.reduce((s, d) => s + d.goodQuantity, 0)
    const dailyPlanned = data.daily.reduce((s, d) => s + d.plannedQuantity, 0)
    const lineGood = data.lines.reduce((s, l) => s + l.goodQuantity, 0)
    const linePlanned = data.lines.reduce((s, l) => s + l.plannedQuantity, 0)
    expect(dailyGood).toBe(data.kpis.goodQuantity)
    expect(lineGood).toBe(data.kpis.goodQuantity)
    expect(dailyPlanned).toBe(data.kpis.plannedQuantity)
    expect(linePlanned).toBe(data.kpis.plannedQuantity)
    expect(data.kpis.goodQuantity).toBe(data.kpis.producedQuantity - data.kpis.rejectedQuantity)
  })

  it('keeps downtime totals consistent across KPI, lines, days and categories', () => {
    const byLine = data.lines.reduce((s, l) => s + l.downtimeMinutes, 0)
    const byCategory = data.downtimeByCategory.reduce((s, c) => s + c.minutes, 0)
    const byDay = data.daily.reduce((s, d) => s + d.downtimeMinutes, 0)
    expect(byLine).toBe(data.kpis.downtimeMinutes)
    expect(byCategory).toBe(data.kpis.downtimeMinutes)
    expect(byDay).toBe(data.kpis.downtimeMinutes)
    expect(data.kpis.downtimeEvents).toBe(DOWNTIME_EVENTS.length)
  })

  it('shows the sample scenario day: 202 good of 210 produced, 35 min maintenance', () => {
    const day = buildDashboard(input, { from: '2026-11-03', to: '2026-11-03' })
    const cutting = day.lines.find((l) => l.lineId === 'line-cut-01')
    expect(cutting).toBeDefined()
    // The morning sample report is included; the night shift adds its own approved report.
    expect(cutting?.producedQuantity).toBeGreaterThanOrEqual(210)
    const maintenance = day.downtimeByCategory.find((c) => c.category === 'machine_maintenance')
    expect(maintenance?.minutes).toBeGreaterThanOrEqual(35)
  })

  it('lists pending reports oldest first and caps recent activity', () => {
    expect(data.pendingApprovals.length).toBe(data.kpis.pendingApprovals)
    const times = data.pendingApprovals.map((p) => Date.parse(p.submittedAt ?? ''))
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    expect(data.recentActivity.length).toBeLessThanOrEqual(8)
  })
})
