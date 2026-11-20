import { z } from 'zod'
import { isValidDateString } from '@/lib/dates'

export const MAX_PLANNED_QUANTITY = 1_000_000
export const MAX_INSTRUCTIONS_LENGTH = 1000

/**
 * Validation for the order form (also reused by the service layer, so the rules live in one place).
 * `minPlanned` is the quantity already reported against the order; planned quantity cannot go below it.
 */
export function buildOrderFormSchema(minPlanned = 0) {
  const floor = Math.max(1, minPlanned)
  return z
    .object({
      productId: z.string().min(1, 'Select a product'),
      lineId: z.string().min(1, 'Select a production line'),
      plannedQuantity: z
        .number({ error: 'Enter a whole number' })
        .int('Enter a whole number')
        .min(
          floor,
          minPlanned > 1 ? `Cannot be less than the ${minPlanned} units already reported` : 'Must be at least 1',
        )
        .max(MAX_PLANNED_QUANTITY, `Must be ${MAX_PLANNED_QUANTITY.toLocaleString('en-US')} or less`),
      plannedStart: z.string().refine(isValidDateString, 'Enter a valid date'),
      dueDate: z.string().refine(isValidDateString, 'Enter a valid date'),
      priority: z.enum(['low', 'normal', 'high', 'urgent']),
      instructions: z.string().trim().max(MAX_INSTRUCTIONS_LENGTH, `Keep instructions under ${MAX_INSTRUCTIONS_LENGTH} characters`),
      status: z.enum(['draft', 'planned']),
    })
    .refine(
      (v) => !isValidDateString(v.plannedStart) || !isValidDateString(v.dueDate) || v.dueDate >= v.plannedStart,
      { path: ['dueDate'], message: 'Due date cannot be before the planned start date' },
    )
}

export type OrderFormValues = z.infer<ReturnType<typeof buildOrderFormSchema>>
