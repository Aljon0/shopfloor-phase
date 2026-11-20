import { isValidDateString } from './dates'
import type { OrderInput } from './order-rules'

export const MAX_PLANNED_QUANTITY = 1_000_000
export const MAX_INSTRUCTIONS_LENGTH = 1000

const PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent']

/**
 * Field-by-field checks for an order's entered values. Same rules and wording as the order form;
 * the API runs this on every create and edit. `minPlanned` is the quantity already reported.
 * Returns a message per invalid field; an empty object means valid.
 */
export function validateOrderInput(input: OrderInput, minPlanned = 0): Partial<Record<keyof OrderInput, string>> {
  const errors: Partial<Record<keyof OrderInput, string>> = {}
  const floor = Math.max(1, minPlanned)
  if (!input.productId) errors.productId = 'Select a product'
  if (!input.lineId) errors.lineId = 'Select a production line'
  const q = input.plannedQuantity
  if (typeof q !== 'number' || !Number.isInteger(q)) errors.plannedQuantity = 'Enter a whole number'
  else if (q < floor) errors.plannedQuantity = minPlanned > 1 ? `Cannot be less than the ${minPlanned} units already reported` : 'Must be at least 1'
  else if (q > MAX_PLANNED_QUANTITY) errors.plannedQuantity = `Must be ${MAX_PLANNED_QUANTITY.toLocaleString('en-US')} or less`
  if (typeof input.plannedStart !== 'string' || !isValidDateString(input.plannedStart)) errors.plannedStart = 'Enter a valid date'
  if (typeof input.dueDate !== 'string' || !isValidDateString(input.dueDate)) errors.dueDate = 'Enter a valid date'
  if (!errors.plannedStart && !errors.dueDate && input.dueDate < input.plannedStart) errors.dueDate = 'Due date cannot be before the planned start date'
  if (!PRIORITY_VALUES.includes(input.priority)) errors.priority = 'Select a priority'
  if (typeof input.instructions !== 'string') errors.instructions = 'Enter instructions as text'
  else if (input.instructions.trim().length > MAX_INSTRUCTIONS_LENGTH) errors.instructions = `Keep instructions under ${MAX_INSTRUCTIONS_LENGTH} characters`
  return errors
}
