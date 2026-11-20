import { z } from 'zod'
import { isValidDateString } from '@/lib/dates'
import { validateQuantities } from '@/lib/kpi'
import { MAX_NOTES_LENGTH, MAX_REPORT_QUANTITY, validateReportDate } from './report-rules'

export interface ReportSchemaContext {
  /** Factory-local today, YYYY-MM-DD. */
  today: string
  /** Planned start date of each order, by order number. */
  orderStarts: Readonly<Record<string, string>>
}

const quantity = (label: string) =>
  z
    .number({ error: `Enter the ${label} quantity as a whole number` })
    .int('Enter a whole number')
    .min(0, 'Cannot be negative')
    .max(MAX_REPORT_QUANTITY, `Must be ${MAX_REPORT_QUANTITY.toLocaleString('en-US')} or less`)

/**
 * Validation for the report form. The service layer runs the same schema, so the rules live in one
 * place and cannot be bypassed by skipping the form.
 */
export function buildReportFormSchema(ctx: ReportSchemaContext) {
  return z
    .object({
      orderId: z.string().min(1, 'Select a production order'),
      machineId: z.string().min(1, 'Select a machine'),
      shift: z.enum(['morning', 'night'], { error: 'Select a shift' }),
      reportDate: z.string().refine(isValidDateString, 'Enter a valid date'),
      producedQuantity: quantity('produced'),
      rejectedQuantity: quantity('rejected'),
      notes: z.string().trim().max(MAX_NOTES_LENGTH, `Keep notes under ${MAX_NOTES_LENGTH} characters`),
    })
    .superRefine((v, c) => {
      if (isValidDateString(v.reportDate)) {
        const message = validateReportDate(v.reportDate, ctx.today, ctx.orderStarts[v.orderId])
        if (message) c.addIssue({ code: 'custom', path: ['reportDate'], message })
      }
      const quantityErrors = validateQuantities(v)
      if (quantityErrors.length > 0 && v.rejectedQuantity > v.producedQuantity) {
        c.addIssue({ code: 'custom', path: ['rejectedQuantity'], message: 'Cannot be more than the produced quantity' })
      }
    })
}

export type ReportFormValues = z.infer<ReturnType<typeof buildReportFormSchema>>
