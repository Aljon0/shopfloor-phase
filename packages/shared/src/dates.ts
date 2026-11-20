const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}
