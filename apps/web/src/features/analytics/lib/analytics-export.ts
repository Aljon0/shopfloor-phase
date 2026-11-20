import { toCsv, type CsvCell } from '@/lib/csv'
import type { AnalyticsData, BreakdownRow, Dimension } from './analytics'

export const DIMENSION_LABELS: Record<Dimension, string> = {
  line: 'Production line',
  product: 'Product',
  machine: 'Machine',
  shift: 'Shift',
}

const round1 = (v: number | null): CsvCell => (v === null ? null : Math.round(v * 10) / 10)

export function buildBreakdownCsv(data: AnalyticsData, dimension: Dimension): { filename: string; csv: string } {
  const rows: BreakdownRow[] = data.breakdowns[dimension]
  const csv = toCsv(
    [DIMENSION_LABELS[dimension], 'Approved reports', 'Produced quantity', 'Rejected quantity', 'Good quantity', 'Planned quantity', 'Rejection rate (%)', 'Target achievement (%)', 'Downtime (min)'],
    rows.map((r) => [r.label, r.reports, r.producedQuantity, r.rejectedQuantity, r.goodQuantity, r.plannedQuantity, round1(r.rejectionRate), round1(r.targetAchievement), r.downtimeMinutes]),
  )
  return { filename: `shopfloor-analytics-by-${dimension}-${data.range.from}_to_${data.range.to}.csv`, csv }
}

export function buildTrendCsv(data: AnalyticsData): { filename: string; csv: string } {
  const csv = toCsv(
    ['Date', 'Produced quantity', 'Rejected quantity', 'Good quantity', 'Planned quantity', 'Rejection rate (%)', 'Target achievement (%)', 'Downtime (min)'],
    data.daily.map((d) => [d.date, d.producedQuantity, d.rejectedQuantity, d.goodQuantity, d.plannedQuantity, round1(d.rejectionRate), round1(d.targetAchievement), d.downtimeMinutes]),
  )
  return { filename: `shopfloor-analytics-trends-${data.range.from}_to_${data.range.to}.csv`, csv }
}
