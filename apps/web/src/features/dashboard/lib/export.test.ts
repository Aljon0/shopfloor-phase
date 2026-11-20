import { describe, expect, it } from 'vitest'
import { ACTIVITY, DOWNTIME_EVENTS, LINES, ORDERS, PRODUCTS, REPORTS } from '@/mocks/seed'
import { buildDashboard } from './aggregate'
import { buildDailyCsv, buildDowntimeCsv, buildLinePerformanceCsv } from './export'

const data = buildDashboard(
  {
    lines: LINES,
    products: PRODUCTS,
    orders: ORDERS,
    reports: REPORTS,
    downtimeEvents: DOWNTIME_EVENTS,
    activity: ACTIVITY,
  },
  { from: '2026-11-03', to: '2026-11-04' },
)

describe('dashboard CSV exports', () => {
  it('names files with the selected range', () => {
    expect(buildDailyCsv(data).filename).toBe('shopfloor-daily-summary-2026-11-03_to_2026-11-04.csv')
  })

  it('writes one daily row per chart point plus a header', () => {
    const lines = buildDailyCsv(data).csv.split('\r\n')
    expect(lines).toHaveLength(data.daily.length + 1)
    expect(lines[0]).toContain('Good quantity')
  })

  it('exports one row per production line', () => {
    expect(buildLinePerformanceCsv(data).csv.split('\r\n')).toHaveLength(LINES.length + 1)
  })

  it('exports downtime categories whose minutes add up to the KPI', () => {
    const rows = buildDowntimeCsv(data).csv.split('\r\n').slice(1)
    const minutes = rows.map((r) => Number(r.split(',').slice(-2, -1)[0]))
    expect(minutes.reduce((a, b) => a + b, 0)).toBe(data.kpis.downtimeMinutes)
  })
})
