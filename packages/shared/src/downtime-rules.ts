/**
 * Downtime business rules. Pure functions, no UI or framework imports.
 *
 * Assumptions to confirm (the blueprint lists the fields but not these rules):
 * - Operators and supervisors can record and edit events; managers read them.
 * - Duration is always end - start (never entered), and an event is at most 24 hours.
 * - Events cannot start or end after the factory's current date.
 * - Two events on the same machine cannot overlap in time.
 * - An event cannot be linked to an Approved report, and an event linked to one is locked,
 *   so approving a report does not leave editable records behind it.
 * - A linked order must be on the machine's production line.
 */
import { downtimeMinutes } from './kpi'
import { DOWNTIME_CATEGORY_LABELS, type DowntimeCategory } from './labels'
import type { ReportStatus } from './report-rules'

export interface DowntimeSummaryRow {
  key: string
  label: string
  minutes: number
  events: number
}

export interface DowntimeSummary {
  totalMinutes: number
  totalEvents: number
  byCategory: DowntimeSummaryRow[]
  byMachine: DowntimeSummaryRow[]
}

/** The few fields a summary needs, so the web and the API can pass their own item shapes. */
export interface DowntimeSummarySource {
  event: { category: DowntimeCategory; machineId: string }
  minutes: number
  machineName: string
}

interface TimedEvent {
  id: string
  machineId: string
  startTime: string
  endTime: string
}

export const MAX_DOWNTIME_MINUTES = 24 * 60
export const MAX_DOWNTIME_NOTES_LENGTH = 300
export const MIN_NOTES_LENGTH = 3

export const CATEGORY_OPTIONS = (Object.keys(DOWNTIME_CATEGORY_LABELS) as DowntimeCategory[]).map((value) => ({
  value,
  label: DOWNTIME_CATEGORY_LABELS[value],
}))

const FACTORY_OFFSET = '+08:00'
const LOCAL_FORMAT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/

/** True for 'YYYY-MM-DDTHH:mm' with a real date and time. */
export function isLocalDateTime(value: string): boolean {
  const m = LOCAL_FORMAT.exec(value)
  if (!m) return false
  const hour = Number(m[2])
  const minute = Number(m[3])
  if (hour > 23 || minute > 59) return false
  const date = new Date(`${m[1]}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(m[1] ?? '')
}

/** Factory-local 'YYYY-MM-DDTHH:mm' -> ISO with the Manila offset (no daylight saving there). */
export function toFactoryIso(local: string): string {
  return `${local}:00${FACTORY_OFFSET}`
}

/** ISO timestamp -> factory-local 'YYYY-MM-DDTHH:mm' for a datetime-local input. */
export function toLocalInput(iso: string): string {
  return new Date(Date.parse(iso) + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

/** Minutes between two local values, or null when either is invalid or end is not after start (a 0-minute stop is not an event). */
export function localDurationMinutes(start: string, end: string): number | null {
  if (!isLocalDateTime(start) || !isLocalDateTime(end)) return null
  const minutes = downtimeMinutes(toFactoryIso(start), toFactoryIso(end))
  return minutes === null || minutes <= 0 ? null : minutes
}

/** An event linked to an approved report is part of an approved record and is read-only. */
export function isEventLocked(reportStatus: ReportStatus | null): boolean {
  return reportStatus === 'approved'
}

/** The id of another event on the same machine whose time range overlaps the candidate, if any. */
export function findOverlap(
  events: readonly TimedEvent[],
  candidate: Omit<TimedEvent, 'id'>,
  excludeId?: string,
): string | undefined {
  const start = Date.parse(candidate.startTime)
  const end = Date.parse(candidate.endTime)
  return events.find(
    (e) =>
      e.id !== excludeId &&
      e.machineId === candidate.machineId &&
      Date.parse(e.startTime) < end &&
      start < Date.parse(e.endTime),
  )?.id
}

/** Next DT-NNNN number after the highest existing one. */
export function nextEventId(existing: readonly string[]): string {
  const highest = existing.reduce((max, id) => {
    const n = Number(/^DT-(\d+)$/.exec(id)?.[1] ?? 0)
    return n > max ? n : max
  }, 0)
  return `DT-${String(highest + 1).padStart(4, '0')}`
}

function toRows(map: Map<string, DowntimeSummaryRow>): DowntimeSummaryRow[] {
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label))
}

/** Totals by category and by machine, from the same durations the table shows. */
export function summarizeDowntime(items: readonly DowntimeSummarySource[]): DowntimeSummary {
  const byCategory = new Map<string, DowntimeSummaryRow>()
  const byMachine = new Map<string, DowntimeSummaryRow>()
  let totalMinutes = 0
  for (const { event, minutes, machineName } of items) {
    totalMinutes += minutes
    const c = byCategory.get(event.category) ?? { key: event.category, label: DOWNTIME_CATEGORY_LABELS[event.category], minutes: 0, events: 0 }
    c.minutes += minutes
    c.events += 1
    byCategory.set(event.category, c)
    const m = byMachine.get(event.machineId) ?? { key: event.machineId, label: machineName, minutes: 0, events: 0 }
    m.minutes += minutes
    m.events += 1
    byMachine.set(event.machineId, m)
  }
  return { totalMinutes, totalEvents: items.length, byCategory: toRows(byCategory), byMachine: toRows(byMachine) }
}
