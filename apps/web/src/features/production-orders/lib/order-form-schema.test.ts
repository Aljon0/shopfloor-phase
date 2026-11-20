import { describe, expect, it } from 'vitest'
import { buildOrderFormSchema } from './order-form-schema'

const valid = {
  productId: 'prod-bracket',
  lineId: 'line-cut-01',
  plannedQuantity: 500,
  plannedStart: '2026-11-09',
  dueDate: '2026-11-12',
  priority: 'normal',
  instructions: 'Deburr edges.',
  status: 'draft',
}

function messages(input: unknown, minPlanned = 0): string[] {
  const result = buildOrderFormSchema(minPlanned).safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('order form schema', () => {
  it('accepts a valid order', () => {
    expect(messages(valid)).toEqual([])
  })

  it('rejects missing product and line', () => {
    expect(messages({ ...valid, productId: '', lineId: '' })).toEqual(['Select a product', 'Select a production line'])
  })

  it('rejects zero, negative, fractional and missing quantities', () => {
    expect(messages({ ...valid, plannedQuantity: 0 })).toContain('Must be at least 1')
    expect(messages({ ...valid, plannedQuantity: -5 })).toContain('Must be at least 1')
    expect(messages({ ...valid, plannedQuantity: 10.5 })).toContain('Enter a whole number')
    expect(messages({ ...valid, plannedQuantity: Number.NaN })).toContain('Enter a whole number')
  })

  it('stops planned quantity dropping below what has already been reported', () => {
    expect(messages({ ...valid, plannedQuantity: 300 }, 400)).toEqual(['Cannot be less than the 400 units already reported'])
    expect(messages({ ...valid, plannedQuantity: 400 }, 400)).toEqual([])
  })

  it('rejects a due date before the planned start, but accepts the same day', () => {
    expect(messages({ ...valid, dueDate: '2026-11-08' })).toEqual(['Due date cannot be before the planned start date'])
    expect(messages({ ...valid, dueDate: '2026-11-09' })).toEqual([])
  })

  it('rejects invalid dates and unknown priorities', () => {
    expect(messages({ ...valid, plannedStart: '2026-02-30' })).toContain('Enter a valid date')
    expect(messages({ ...valid, priority: 'whenever' })).not.toEqual([])
  })

  it('limits instruction length', () => {
    expect(messages({ ...valid, instructions: 'x'.repeat(1001) })).toEqual(['Keep instructions under 1000 characters'])
  })
})
