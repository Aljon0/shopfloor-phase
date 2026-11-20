import { isValidDateString } from '@/lib/dates'
import type { ShiftId } from '@/types/domain'
import type { ReportStatus } from '@/types/status'
import type { ReportFilters, ReportListItem } from '../types'
import { REPORT_STATUS_OPTIONS, SHIFTS } from './report-rules'

export const DEFAULT_REPORT_FILTERS: ReportFilters = { q: '', status: 'all', lineId: 'all', shift: 'all', from: '', to: '' }

const STATUS_VALUES = new Set<string>(REPORT_STATUS_OPTIONS.map((o) => o.value))
const SHIFT_VALUES = new Set<string>(SHIFTS)

export function hasActiveReportFilters(f: ReportFilters): boolean {
  return (
    f.q.trim() !== '' || f.status !== 'all' || f.lineId !== 'all' || f.shift !== 'all' || f.from !== '' || f.to !== ''
  )
}

/** Reads filters from the URL, ignoring values that are not valid options. */
export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const status = params.get('status') ?? 'all'
  const shift = params.get('shift') ?? 'all'
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  return {
    q: params.get('q') ?? '',
    status: STATUS_VALUES.has(status) ? (status as ReportStatus) : 'all',
    lineId: params.get('line') ?? 'all',
    shift: SHIFT_VALUES.has(shift) ? (shift as ShiftId) : 'all',
    from: isValidDateString(from) ? from : '',
    to: isValidDateString(to) ? to : '',
  }
}

/** Writes only non-default filters, keeping URLs short. */
export function reportFiltersToParams(f: ReportFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.q.trim() !== '') params.set('q', f.q)
  if (f.status !== 'all') params.set('status', f.status)
  if (f.lineId !== 'all') params.set('line', f.lineId)
  if (f.shift !== 'all') params.set('shift', f.shift)
  if (f.from !== '') params.set('from', f.from)
  if (f.to !== '') params.set('to', f.to)
  return params
}

export function filterReports<T extends ReportListItem>(items: readonly T[], f: ReportFilters): T[] {
  const query = f.q.trim().toLowerCase()
  return items.filter(({ report, lineName, machineName, productName }) => {
    if (f.status !== 'all' && report.status !== f.status) return false
    if (f.lineId !== 'all' && report.lineId !== f.lineId) return false
    if (f.shift !== 'all' && report.shift !== f.shift) return false
    if (f.from !== '' && report.reportDate < f.from) return false
    if (f.to !== '' && report.reportDate > f.to) return false
    if (query === '') return true
    const haystack =
      `${report.id} ${report.orderId} ${report.operatorName} ${machineName} ${lineName} ${productName}`.toLowerCase()
    return haystack.includes(query)
  })
}

/** Newest date first; within a date, morning before night, then by report number. */
export function sortReports(items: readonly ReportListItem[]): ReportListItem[] {
  return [...items].sort(
    (a, b) =>
      b.report.reportDate.localeCompare(a.report.reportDate) ||
      SHIFTS.indexOf(a.report.shift) - SHIFTS.indexOf(b.report.shift) ||
      a.report.id.localeCompare(b.report.id),
  )
}
