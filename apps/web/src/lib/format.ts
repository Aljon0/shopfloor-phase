/** Shown when a value cannot be calculated (e.g. rejection rate with zero produced). */
export const NOT_APPLICABLE = '—'

const numberFormat = new Intl.NumberFormat('en-PH')

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatPercent(value: number | null, fractionDigits = 1): string {
  if (value === null) return NOT_APPLICABLE
  return `${value.toFixed(fractionDigits)}%`
}

/** 95 -> '1 h 35 min'; 35 -> '35 min'; 0 -> '0 min'. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
