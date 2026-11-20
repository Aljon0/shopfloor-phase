const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export const FACTORY_TIME_ZONE = 'Asia/Manila'

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

/** The calendar date (YYYY-MM-DD) of an ISO timestamp in factory local time. */
export function factoryDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FACTORY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
