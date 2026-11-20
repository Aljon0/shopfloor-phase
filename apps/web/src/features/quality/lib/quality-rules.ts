/**
 * Basic quality-inspection rules. Pure functions, no UI imports.
 *
 * This is a record of what was inspected, not a certified quality-management system.
 *
 * Assumptions to confirm (the blueprint lists the fields but not these rules):
 * - Supervisors act as inspectors and manage records; managers read them.
 * - Passed + failed = inspected, always. The inspector enters inspected and failed; passed is calculated.
 * - A defect classification is required when anything failed, and is dropped when nothing failed.
 * - Inspections apply to orders that are In Progress or Completed. The order cannot change after creation.
 * - A linked report must belong to the same order, and the inspected quantity cannot exceed what
 *   that report produced.
 * - Inspection date: not in the future and not before the order's planned start.
 * - Unlike downtime, inspections are not locked by report approval: they do not feed the official KPIs.
 */
import { rejectionRate } from '@/lib/kpi'
import type { OrderStatus } from '@/types/status'
import type { DefectSummaryRow, InspectionItem, QualitySummary } from '../types'

export const MAX_NOTES_LENGTH = 300
export const MAX_INSPECTION_QUANTITY = 1_000_000
export const NO_DEFECT_KEY = 'none'

export function canInspectOrder(status: OrderStatus): boolean {
  return status === 'in_progress' || status === 'completed'
}

/** Pieces that passed as a percent of pieces inspected; null when nothing was inspected. */
export function passRate(passed: number, inspected: number): number | null {
  return inspected > 0 ? (passed / inspected) * 100 : null
}

/** Passed = inspected - failed. Null while the two numbers do not make sense together. */
export function passedQuantity(inspected: number, failed: number): number | null {
  if (!Number.isInteger(inspected) || !Number.isInteger(failed)) return null
  if (inspected < 1 || failed < 0 || failed > inspected) return null
  return inspected - failed
}

/** Next QI-YYYY-NNNN: the highest number already used in that year, plus one. */
export function nextInspectionId(existing: readonly string[], year: string): string {
  const prefix = `QI-${year}-`
  const highest = existing.reduce((max, id) => {
    if (!id.startsWith(prefix)) return max
    const n = Number(id.slice(prefix.length))
    return Number.isInteger(n) && n > max ? n : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

/** Totals for the inspections shown, from summed quantities. Failures grouped by defect, largest first. */
export function summarizeInspections(items: readonly InspectionItem[]): QualitySummary {
  const byDefect = new Map<string, DefectSummaryRow>()
  let inspected = 0
  let passed = 0
  let failed = 0
  for (const { inspection, defectName } of items) {
    inspected += inspection.inspectedQuantity
    passed += inspection.passedQuantity
    failed += inspection.failedQuantity
    if (inspection.failedQuantity === 0) continue
    const key = inspection.defectId ?? NO_DEFECT_KEY
    const row = byDefect.get(key) ?? { key, label: defectName ?? 'Unclassified', failed: 0, inspections: 0 }
    row.failed += inspection.failedQuantity
    row.inspections += 1
    byDefect.set(key, row)
  }
  return {
    inspections: items.length,
    inspected,
    passed,
    failed,
    passRate: passRate(passed, inspected),
    failureRate: rejectionRate(failed, inspected),
    byDefect: [...byDefect.values()].sort((a, b) => b.failed - a.failed || a.label.localeCompare(b.label)),
  }
}
