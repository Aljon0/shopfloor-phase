import { isValidDateString, factoryDateOf } from '@/lib/dates'
import { DOWNTIME_CATEGORY_LABELS } from '@/lib/labels'
import type { DowntimeCategory } from '@/types/domain'
import type { DowntimeFilters, DowntimeListItem } from '../types'

export const DEFAULT_DOWNTIME_FILTERS: DowntimeFilters = { q: '', lineId: 'all', machineId: 'all', category: 'all', from: '', to: '' }

export function hasActiveDowntimeFilters(f: DowntimeFilters): boolean {
  return f.q.trim() !== '' || f.lineId !== 'all' || f.machineId !== 'all' || f.category !== 'all' || f.from !== '' || f.to !== ''
}

export function parseDowntimeFilters(params: URLSearchParams): DowntimeFilters {
  const category = params.get('category') ?? 'all'
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  return {
    q: params.get('q') ?? '',
    lineId: params.get('line') ?? 'all',
    machineId: params.get('machine') ?? 'all',
    category: category in DOWNTIME_CATEGORY_LABELS ? (category as DowntimeCategory) : 'all',
    from: isValidDateString(from) ? from : '',
    to: isValidDateString(to) ? to : '',
  }
}

export function downtimeFiltersToParams(f: DowntimeFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.q.trim() !== '') params.set('q', f.q)
  if (f.lineId !== 'all') params.set('line', f.lineId)
  if (f.machineId !== 'all') params.set('machine', f.machineId)
  if (f.category !== 'all') params.set('category', f.category)
  if (f.from !== '') params.set('from', f.from)
  if (f.to !== '') params.set('to', f.to)
  return params
}

/** Date filters use the day the event started, in factory time (same as the dashboard). */
export function filterDowntime(items: readonly DowntimeListItem[], f: DowntimeFilters): DowntimeListItem[] {
  const query = f.q.trim().toLowerCase()
  return items.filter(({ event, lineName, machineName }) => {
    if (f.lineId !== 'all' && event.lineId !== f.lineId) return false
    if (f.machineId !== 'all' && event.machineId !== f.machineId) return false
    if (f.category !== 'all' && event.category !== f.category) return false
    const day = factoryDateOf(event.startTime)
    if (f.from !== '' && day < f.from) return false
    if (f.to !== '' && day > f.to) return false
    if (query === '') return true
    const haystack = `${event.id} ${event.notes} ${event.orderId ?? ''} ${event.reportId ?? ''} ${event.recordedBy} ${machineName} ${lineName} ${DOWNTIME_CATEGORY_LABELS[event.category]}`.toLowerCase()
    return haystack.includes(query)
  })
}

/** Newest first. */
export function sortDowntime(items: readonly DowntimeListItem[]): DowntimeListItem[] {
  return [...items].sort((a, b) => Date.parse(b.event.startTime) - Date.parse(a.event.startTime) || a.event.id.localeCompare(b.event.id))
}
