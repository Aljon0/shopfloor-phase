import { toCsv, type CsvCell } from '@/lib/csv'
import type { DashboardData } from './aggregate'

export interface CsvExport {
  filename: string
  csv: string
}

const round1 = (value: number | null): CsvCell => (value === null ? null : Math.round(value * 10) / 10)

function fileStem(data: DashboardData, name: string): string {
  return `shopfloor-${name}-${data.range.from}_to_${data.range.to}`
}

/** Daily summary: one row per day. Production columns use approved reports only. */
export function buildDailyCsv(data: DashboardData): CsvExport {
  const csv = toCsv(
    [
      'Date',
      'Planned quantity',
      'Produced quantity',
      'Rejected quantity',
      'Good quantity',
      'Rejection rate (%)',
      'Target achievement (%)',
      'Downtime (min)',
    ],
    data.daily.map((d) => [
      d.date,
      d.plannedQuantity,
      d.producedQuantity,
      d.rejectedQuantity,
      d.goodQuantity,
      round1(d.rejectionRate),
      round1(d.targetAchievement),
      d.downtimeMinutes,
    ]),
  )
  return { filename: `${fileStem(data, 'daily-summary')}.csv`, csv }
}

export function buildLinePerformanceCsv(data: DashboardData): CsvExport {
  const csv = toCsv(
    [
      'Production line',
      'Produced quantity',
      'Rejected quantity',
      'Good quantity',
      'Planned quantity',
      'Rejection rate (%)',
      'Target achievement (%)',
      'Downtime (min)',
    ],
    data.lines.map((l) => [
      l.lineName,
      l.producedQuantity,
      l.rejectedQuantity,
      l.goodQuantity,
      l.plannedQuantity,
      round1(l.rejectionRate),
      round1(l.targetAchievement),
      l.downtimeMinutes,
    ]),
  )
  return { filename: `${fileStem(data, 'line-performance')}.csv`, csv }
}

export function buildDowntimeCsv(data: DashboardData): CsvExport {
  const total = data.kpis.downtimeMinutes
  const csv = toCsv(
    ['Category', 'Events', 'Downtime (min)', 'Share of downtime (%)'],
    data.downtimeByCategory.map((c) => [
      c.label,
      c.events,
      c.minutes,
      total > 0 ? round1((c.minutes / total) * 100) : null,
    ]),
  )
  return { filename: `${fileStem(data, 'downtime-by-category')}.csv`, csv }
}
