import { describe, expect, it } from 'vitest'
import type { DowntimeListItem } from '../types'
import { DEFAULT_DOWNTIME_FILTERS, downtimeFiltersToParams, filterDowntime, hasActiveDowntimeFilters, parseDowntimeFilters, sortDowntime } from './downtime-filters'

const item = (id: string, start: string, over: Partial<DowntimeListItem['event']> = {}, names: Partial<DowntimeListItem> = {}): DowntimeListItem => ({
  event: { id, lineId: 'line-cut-01', machineId: 'mc-lc-01', startTime: start, endTime: start, category: 'machine_maintenance', notes: 'Blade change', recordedBy: 'Juan', ...over },
  minutes: 35, lineName: 'Cutting Line 01', machineName: 'Laser Cutter LC-01', reportStatus: null, ...names,
})
const items = [
  item('DT-0001', '2026-11-03T09:00:00+08:00'),
  item('DT-0002', '2026-11-04T23:30:00+08:00', { lineId: 'line-weld-01', machineId: 'mc-wc-01', category: 'equipment_failure', notes: 'Wire feeder jam' }, { lineName: 'Welding Line 01', machineName: 'Welding Cell WC-01' }),
]

describe('downtime filters', () => {
  it('filters by line, machine, category and date range (by factory start day)', () => {
    expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, lineId: 'line-weld-01' })).toHaveLength(1)
    expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, machineId: 'mc-lc-01' })).toHaveLength(1)
    expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, category: 'equipment_failure' })).toHaveLength(1)
    expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, from: '2026-11-04' })).toHaveLength(1)
    expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, to: '2026-11-03' })).toHaveLength(1)
  })
  it('searches id, reason, machine and category label', () => {
    for (const q of ['dt-0002', 'feeder', 'wc-01', 'equipment failure']) expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, q })).toHaveLength(1)
    expect(filterDowntime(items, { ...DEFAULT_DOWNTIME_FILTERS, q: 'zzz' })).toHaveLength(0)
  })
  it('sorts newest first', () => expect(sortDowntime(items).map((i) => i.event.id)).toEqual(['DT-0002', 'DT-0001']))
  it('round-trips through URL params and ignores invalid values', () => {
    const f = { ...DEFAULT_DOWNTIME_FILTERS, q: 'jam', category: 'changeover' as const, from: '2026-11-01' }
    expect(parseDowntimeFilters(downtimeFiltersToParams(f))).toEqual(f)
    expect(parseDowntimeFilters(new URLSearchParams('category=bogus&from=2026-13-01'))).toEqual(DEFAULT_DOWNTIME_FILTERS)
    expect(hasActiveDowntimeFilters(DEFAULT_DOWNTIME_FILTERS)).toBe(false)
    expect(hasActiveDowntimeFilters(f)).toBe(true)
  })
})
