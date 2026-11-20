import { describe, expect, it } from 'vitest'
import type { DowntimeListItem } from '../types'
import {
  findOverlap,
  isEventLocked,
  isLocalDateTime,
  localDurationMinutes,
  nextEventId,
  summarizeDowntime,
  toFactoryIso,
  toLocalInput,
} from './downtime-rules'

describe('local date-time helpers', () => {
  it('validates real dates and times only', () => {
    expect(isLocalDateTime('2026-11-07T08:30')).toBe(true)
    expect(isLocalDateTime('2026-02-30T08:30')).toBe(false)
    expect(isLocalDateTime('2026-11-07T24:00')).toBe(false)
    expect(isLocalDateTime('2026-11-07')).toBe(false)
    expect(isLocalDateTime('')).toBe(false)
  })
  it('round-trips between local input and ISO with the Manila offset', () => {
    expect(toFactoryIso('2026-11-07T08:30')).toBe('2026-11-07T08:30:00+08:00')
    expect(toLocalInput('2026-11-07T08:30:00+08:00')).toBe('2026-11-07T08:30')
    expect(toLocalInput('2026-11-07T00:10:00Z')).toBe('2026-11-07T08:10')
  })
  it('calculates duration as end - start and rejects non-positive spans', () => {
    expect(localDurationMinutes('2026-11-03T09:00', '2026-11-03T09:35')).toBe(35)
    expect(localDurationMinutes('2026-11-03T23:30', '2026-11-04T00:15')).toBe(45)
    expect(localDurationMinutes('2026-11-03T09:00', '2026-11-03T09:00')).toBeNull()
    expect(localDurationMinutes('2026-11-03T09:30', '2026-11-03T09:00')).toBeNull()
    expect(localDurationMinutes('bad', '2026-11-03T09:00')).toBeNull()
  })
})

describe('findOverlap', () => {
  const events = [{ id: 'DT-0001', machineId: 'm1', startTime: '2026-11-03T09:00:00+08:00', endTime: '2026-11-03T10:00:00+08:00' }]
  const at = (machineId: string, startTime: string, endTime: string) => ({ machineId, startTime, endTime })
  it('detects overlapping ranges on the same machine', () => {
    expect(findOverlap(events, at('m1', '2026-11-03T09:30:00+08:00', '2026-11-03T10:30:00+08:00'))).toBe('DT-0001')
    expect(findOverlap(events, at('m1', '2026-11-03T08:00:00+08:00', '2026-11-03T11:00:00+08:00'))).toBe('DT-0001')
  })
  it('allows touching ranges, other machines and the event being edited', () => {
    expect(findOverlap(events, at('m1', '2026-11-03T10:00:00+08:00', '2026-11-03T10:30:00+08:00'))).toBeUndefined()
    expect(findOverlap(events, at('m1', '2026-11-03T08:30:00+08:00', '2026-11-03T09:00:00+08:00'))).toBeUndefined()
    expect(findOverlap(events, at('m2', '2026-11-03T09:30:00+08:00', '2026-11-03T10:30:00+08:00'))).toBeUndefined()
    expect(findOverlap(events, at('m1', '2026-11-03T09:30:00+08:00', '2026-11-03T10:30:00+08:00'), 'DT-0001')).toBeUndefined()
  })
})

describe('misc rules', () => {
  it('locks events of approved reports only', () => {
    expect(isEventLocked('approved')).toBe(true)
    for (const s of ['draft', 'pending_review', 'returned', 'revised', null] as const) expect(isEventLocked(s)).toBe(false)
  })
  it('numbers events after the highest existing number', () => {
    expect(nextEventId([])).toBe('DT-0001')
    expect(nextEventId(['DT-0001', 'DT-0009', 'DT-0003'])).toBe('DT-0010')
  })
})

describe('summarizeDowntime', () => {
  const item = (id: string, machineId: string, machineName: string, category: DowntimeListItem['event']['category'], minutes: number): DowntimeListItem => ({
    event: { id, lineId: 'l1', machineId, startTime: '2026-11-03T09:00:00+08:00', endTime: '2026-11-03T10:00:00+08:00', category, notes: 'x', recordedBy: 'a' },
    minutes, lineName: 'Line', machineName, reportStatus: null,
  })
  it('totals by category and machine from the same durations, largest first', () => {
    const s = summarizeDowntime([
      item('1', 'm1', 'Laser', 'machine_maintenance', 35),
      item('2', 'm1', 'Laser', 'changeover', 20),
      item('3', 'm2', 'Shear', 'machine_maintenance', 50),
    ])
    expect(s.totalMinutes).toBe(105)
    expect(s.totalEvents).toBe(3)
    expect(s.byCategory.map((r) => [r.key, r.minutes, r.events])).toEqual([['machine_maintenance', 85, 2], ['changeover', 20, 1]])
    expect(s.byMachine.map((r) => [r.label, r.minutes])).toEqual([['Shear', 50], ['Laser', 55]].sort((a, b) => Number(b[1]) - Number(a[1])))
  })
  it('is empty for no events', () => {
    expect(summarizeDowntime([])).toEqual({ totalMinutes: 0, totalEvents: 0, byCategory: [], byMachine: [] })
  })
})
