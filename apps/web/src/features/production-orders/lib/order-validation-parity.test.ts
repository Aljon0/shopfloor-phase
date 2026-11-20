import { validateOrderInput, type OrderInput } from '@shopfloor/shared'
import { describe, expect, it } from 'vitest'
import { buildOrderFormSchema } from './order-form-schema'

/**
 * The form validates with zod; the API validates with the shared function. These must say the same thing,
 * otherwise the form would accept something the server refuses (or the reverse).
 */
const base: OrderInput = { productId: 'p', lineId: 'l', plannedQuantity: 100, plannedStart: '2026-11-10', dueDate: '2026-11-20', priority: 'normal', instructions: '' }
const cases: [string, Partial<OrderInput>, number][] = [
  ['valid', {}, 0],
  ['no product', { productId: '' }, 0],
  ['no line', { lineId: '' }, 0],
  ['zero quantity', { plannedQuantity: 0 }, 0],
  ['fraction', { plannedQuantity: 1.5 }, 0],
  ['too large', { plannedQuantity: 1_000_001 }, 0],
  ['max quantity', { plannedQuantity: 1_000_000 }, 0],
  ['below reported', { plannedQuantity: 50 }, 80],
  ['equal to reported', { plannedQuantity: 80 }, 80],
  ['below reported of 1', { plannedQuantity: 0 }, 1],
  ['bad start', { plannedStart: '2026-02-30' }, 0],
  ['bad due', { dueDate: 'soon' }, 0],
  ['due before start', { dueDate: '2026-11-01' }, 0],
  ['same day', { dueDate: '2026-11-10' }, 0],
  ['long instructions', { instructions: 'x'.repeat(1001) }, 0],
  ['boundary instructions', { instructions: 'x'.repeat(1000) }, 0],
  ['padded instructions', { instructions: `  ${'x'.repeat(1000)}  ` }, 0],
]

describe('order validation: form schema and shared validator agree', () => {
  it.each(cases)('%s', (_name, change, minPlanned) => {
    const input = { ...base, ...change }
    const zod = buildOrderFormSchema(minPlanned).safeParse({ ...input, status: 'draft' })
    const zodErrors: Record<string, string> = {}
    if (!zod.success) for (const i of zod.error.issues) zodErrors[String(i.path[0])] ??= i.message
    expect(validateOrderInput(input, minPlanned)).toEqual(zodErrors)
  })
})
