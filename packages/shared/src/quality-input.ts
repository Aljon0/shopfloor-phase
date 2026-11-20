import { isValidDateString } from './dates'
import { MAX_INSPECTION_QUANTITY, MAX_INSPECTION_NOTES_LENGTH } from './quality-rules'

/** What the inspector enters. Passed quantity is calculated (inspected - failed), never typed. */
export interface InspectionInput {
  /** Production order number. The product comes from the order. */
  orderId: string
  /** Report number, or '' when the inspection is not tied to a report. */
  reportId: string
  inspectionDate: string
  inspectedQuantity: number
  failedQuantity: number
  /** Defect classification, or '' when nothing failed. */
  defectId: string
  notes: string
}

export interface InspectionValidationContext {
  today: string
  /** Planned start of the inspection's order, if known. */
  orderStart: string | undefined
}

function quantityError(value: unknown, label: string, min: number): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return `Enter the ${label} quantity as a whole number`
  if (!Number.isInteger(value)) return 'Enter a whole number'
  if (value < min) return min === 0 ? 'Cannot be negative' : 'Must be at least 1'
  if (value > MAX_INSPECTION_QUANTITY) return `Must be ${MAX_INSPECTION_QUANTITY.toLocaleString('en-US')} or less`
  return undefined
}

/**
 * Field checks for an inspection. Same rules and wording as the inspection form; the API runs this on
 * every save. Returns a message per invalid field; an empty object means valid.
 */
export function validateInspectionInput(input: InspectionInput, ctx: InspectionValidationContext): Partial<Record<keyof InspectionInput, string>> {
  const errors: Partial<Record<keyof InspectionInput, string>> = {}
  if (!input.orderId) errors.orderId = 'Select a production order'
  const dateOk = typeof input.inspectionDate === 'string' && isValidDateString(input.inspectionDate)
  if (!dateOk) errors.inspectionDate = 'Enter a valid date'
  const inspected = quantityError(input.inspectedQuantity, 'inspected', 1)
  if (inspected) errors.inspectedQuantity = inspected
  const failed = quantityError(input.failedQuantity, 'failed', 0)
  if (failed) errors.failedQuantity = failed
  if (typeof input.notes !== 'string') errors.notes = 'Enter notes as text'
  else if (input.notes.trim().length > MAX_INSPECTION_NOTES_LENGTH) errors.notes = `Keep notes under ${MAX_INSPECTION_NOTES_LENGTH} characters`

  // Cross-field checks run even when a quantity failed a range check, and are skipped only when a
  // value is the wrong kind altogether (not a whole number, not text), exactly as the form does.
  const wrongKind =
    !Number.isInteger(input.inspectedQuantity) || !Number.isInteger(input.failedQuantity) ||
    typeof input.defectId !== 'string' || typeof input.notes !== 'string' || typeof input.inspectionDate !== 'string'
  if (wrongKind) return errors

  if (dateOk) {
    if (input.inspectionDate > ctx.today) errors.inspectionDate = 'Inspection date cannot be in the future'
    else if (ctx.orderStart !== undefined && input.inspectionDate < ctx.orderStart) {
      errors.inspectionDate = `Inspection date is before the order's planned start (${ctx.orderStart})`
    }
  }
  if (input.failedQuantity > input.inspectedQuantity) errors.failedQuantity = 'Cannot be more than the inspected quantity'
  else if (input.failedQuantity > 0 && input.defectId === '') errors.defectId = 'Select a defect classification'
  return errors
}
