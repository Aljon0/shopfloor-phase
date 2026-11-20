import { isValidDateString } from './dates'
import { MAX_NOTES_LENGTH, MAX_REPORT_QUANTITY, validateReportDate, type ReportInput } from './report-rules'

export interface ReportValidationContext {
  /** Factory-local today, YYYY-MM-DD. */
  today: string
  /** Planned start of the report's order, if known. */
  orderStart: string | undefined
}

function quantityError(value: unknown, label: string): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return `Enter the ${label} quantity as a whole number`
  if (!Number.isInteger(value)) return 'Enter a whole number'
  if (value < 0) return 'Cannot be negative'
  if (value > MAX_REPORT_QUANTITY) return `Must be ${MAX_REPORT_QUANTITY.toLocaleString('en-US')} or less`
  return undefined
}

/**
 * Field checks for what an operator enters on a report. Same rules and wording as the report form;
 * the API runs this on every save. Returns a message per invalid field; empty means valid.
 * Cross-field checks (date against today and the order start, rejected against produced) run only
 * once every single field is valid, exactly as the form does.
 */
export function validateReportInput(input: ReportInput, ctx: ReportValidationContext): Partial<Record<keyof ReportInput, string>> {
  const errors: Partial<Record<keyof ReportInput, string>> = {}
  if (!input.orderId) errors.orderId = 'Select a production order'
  if (!input.machineId) errors.machineId = 'Select a machine'
  if (input.shift !== 'morning' && input.shift !== 'night') errors.shift = 'Select a shift'
  if (typeof input.reportDate !== 'string' || !isValidDateString(input.reportDate)) errors.reportDate = 'Enter a valid date'
  const produced = quantityError(input.producedQuantity, 'produced')
  if (produced) errors.producedQuantity = produced
  const rejected = quantityError(input.rejectedQuantity, 'rejected')
  if (rejected) errors.rejectedQuantity = rejected
  if (typeof input.notes !== 'string') errors.notes = 'Enter notes as text'
  else if (input.notes.trim().length > MAX_NOTES_LENGTH) errors.notes = `Keep notes under ${MAX_NOTES_LENGTH} characters`

  // The form's cross-field checks run even when a single field failed a range check (an invalid date
  // or a negative quantity), and are skipped only when a value is the wrong kind altogether (not a whole number, not a valid shift, not text).
  const wrongKind =
    !Number.isInteger(input.producedQuantity) ||
    !Number.isInteger(input.rejectedQuantity) ||
    (input.shift !== 'morning' && input.shift !== 'night') ||
    typeof input.reportDate !== 'string' || typeof input.notes !== 'string'
  if (wrongKind) return errors

  if (!errors.reportDate) {
    const dateError = validateReportDate(input.reportDate, ctx.today, ctx.orderStart)
    if (dateError) errors.reportDate = dateError
  }
  if (input.rejectedQuantity > input.producedQuantity) errors.rejectedQuantity ??= 'Cannot be more than the produced quantity'
  return errors
}
