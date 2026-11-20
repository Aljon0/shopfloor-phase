import { z } from 'zod'
import { isValidDateString } from '@/lib/dates'
import { MAX_INSPECTION_QUANTITY, MAX_NOTES_LENGTH } from './quality-rules'

export interface InspectionSchemaContext {
  today: string
  /** Planned start of each order, by order number. */
  orderStarts: Readonly<Record<string, string>>
}

const quantity = (label: string, min: number) =>
  z
    .number({ error: `Enter the ${label} quantity as a whole number` })
    .int('Enter a whole number')
    .min(min, min === 0 ? 'Cannot be negative' : 'Must be at least 1')
    .max(MAX_INSPECTION_QUANTITY, `Must be ${MAX_INSPECTION_QUANTITY.toLocaleString('en-US')} or less`)

/** Validation for the inspection form. The service runs the same schema, so the rules live in one place. */
export function buildInspectionFormSchema(ctx: InspectionSchemaContext) {
  return z
    .object({
      orderId: z.string().min(1, 'Select a production order'),
      reportId: z.string(),
      inspectionDate: z.string().refine(isValidDateString, 'Enter a valid date'),
      inspectedQuantity: quantity('inspected', 1),
      failedQuantity: quantity('failed', 0),
      defectId: z.string(),
      notes: z.string().trim().max(MAX_NOTES_LENGTH, `Keep notes under ${MAX_NOTES_LENGTH} characters`),
    })
    .superRefine((v, c) => {
      if (isValidDateString(v.inspectionDate)) {
        if (v.inspectionDate > ctx.today) {
          c.addIssue({ code: 'custom', path: ['inspectionDate'], message: 'Inspection date cannot be in the future' })
        } else {
          const start = ctx.orderStarts[v.orderId]
          if (start !== undefined && v.inspectionDate < start) {
            c.addIssue({ code: 'custom', path: ['inspectionDate'], message: `Inspection date is before the order's planned start (${start})` })
          }
        }
      }
      if (v.failedQuantity > v.inspectedQuantity) {
        c.addIssue({ code: 'custom', path: ['failedQuantity'], message: 'Cannot be more than the inspected quantity' })
      } else if (v.failedQuantity > 0 && v.defectId === '') {
        c.addIssue({ code: 'custom', path: ['defectId'], message: 'Select a defect classification' })
      }
    })
}

export type InspectionFormValues = z.infer<ReturnType<typeof buildInspectionFormSchema>>
