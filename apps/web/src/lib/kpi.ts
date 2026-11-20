/**
 * Official production calculations (blueprint section 7).
 * Pure functions, no UI or framework imports. Never delegate these figures to AI.
 *
 * Display convention (documented): a ratio that cannot be calculated returns `null`
 * and the UI shows "—" (not applicable). It is never shown as 0 and never divides by zero.
 */

export interface QuantityInput {
  producedQuantity: number
  rejectedQuantity: number
}

export interface QuantityTotals {
  producedQuantity: number
  rejectedQuantity: number
  goodQuantity: number
  /** Sum of planned quantities. Aggregate ratios use these sums, never averaged percentages. */
  plannedQuantity: number
}

export interface KpiSummary extends QuantityTotals {
  /** Percent 0-100, or null when produced quantity is 0. */
  rejectionRate: number | null
  /** Percent (may exceed 100), or null when planned quantity is 0. */
  targetAchievement: number | null
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/** Returns human-readable validation errors; an empty array means the quantities are valid. */
export function validateQuantities({ producedQuantity, rejectedQuantity }: QuantityInput): string[] {
  const errors: string[] = []
  if (!isNonNegativeInteger(producedQuantity)) {
    errors.push('Produced quantity must be a whole number of 0 or more.')
  }
  if (!isNonNegativeInteger(rejectedQuantity)) {
    errors.push('Rejected quantity must be a whole number of 0 or more.')
  }
  if (errors.length === 0 && rejectedQuantity > producedQuantity) {
    errors.push('Rejected quantity cannot exceed produced quantity.')
  }
  return errors
}

/** Good quantity = produced quantity - rejected quantity. Assumes validated input. */
export function goodQuantity({ producedQuantity, rejectedQuantity }: QuantityInput): number {
  return producedQuantity - rejectedQuantity
}

/** Rejection rate (%) = rejected / produced x 100. Null when produced is 0. */
export function rejectionRate(rejectedQuantity: number, producedQuantity: number): number | null {
  if (producedQuantity <= 0) return null
  return (rejectedQuantity / producedQuantity) * 100
}

/** Target achievement (%) = good / planned x 100. Null when planned is 0. */
export function targetAchievement(goodQty: number, plannedQuantity: number): number | null {
  if (plannedQuantity <= 0) return null
  return (goodQty / plannedQuantity) * 100
}

export interface QuantityRecord extends QuantityInput {
  plannedQuantity: number
}

/** Aggregates records by SUMMING quantities first, then deriving ratios from the sums. */
export function summarizeQuantities(records: readonly QuantityRecord[]): KpiSummary {
  let produced = 0
  let rejected = 0
  let planned = 0
  for (const r of records) {
    produced += r.producedQuantity
    rejected += r.rejectedQuantity
    planned += r.plannedQuantity
  }
  const good = produced - rejected
  return {
    producedQuantity: produced,
    rejectedQuantity: rejected,
    goodQuantity: good,
    plannedQuantity: planned,
    rejectionRate: rejectionRate(rejected, produced),
    targetAchievement: targetAchievement(good, planned),
  }
}

/**
 * Downtime duration in whole minutes = end - start.
 * Returns null for unparseable timestamps or an end before the start.
 */
export function downtimeMinutes(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.round((end - start) / 60_000)
}
