/**
 * Date helpers. Calendar dates are plain 'YYYY-MM-DD' strings (factory local dates);
 * timestamps are ISO strings with an offset and are displayed in factory local time.
 */

export const FACTORY_TIME_ZONE = 'Asia/Manila'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Inclusive list of dates from `from` to `to`; empty if the range is invalid or reversed. */
export function eachDate(from: string, to: string): string[] {
  if (!isValidDateString(from) || !isValidDateString(to) || from > to) return []
  const dates: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d)
  return dates
}

/** 'Nov 3' (same-year context) or 'Nov 3, 2026' when `withYear` is set. */
export function formatDate(date: string, withYear = false): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(`${date}T00:00:00Z`))
}

/** Formats an ISO timestamp in factory local time, e.g. 'Nov 3, 9:45 AM'. */
export function formatFactoryDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: FACTORY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatFactoryTime(ms: number): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: FACTORY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

/** The calendar date (YYYY-MM-DD) of an ISO timestamp in factory local time. */
export function factoryDateOf(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FACTORY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
  return parts
}
