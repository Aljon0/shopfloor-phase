import { describe, expect, it } from 'vitest'
import { buildReportFormSchema } from './report-form-schema'

const schema = buildReportFormSchema({ today: '2026-11-07', orderStarts: { 'PO-1': '2026-11-04' } })
const valid = {
  orderId: 'PO-1', machineId: 'm1', shift: 'morning' as const, reportDate: '2026-11-07',
  producedQuantity: 210, rejectedQuantity: 8, notes: '',
}
const firstMessage = (input: unknown, path: string): string | undefined =>
  schema.safeParse(input).error?.issues.find((i) => i.path.join('.') === path)?.message

describe('report form schema', () => {
  it('accepts a valid report, including zero produced', () => {
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, producedQuantity: 0, rejectedQuantity: 0 }).success).toBe(true)
  })
  it('requires order, machine and shift', () => {
    expect(firstMessage({ ...valid, orderId: '' }, 'orderId')).toBe('Select a production order')
    expect(firstMessage({ ...valid, machineId: '' }, 'machineId')).toBe('Select a machine')
    expect(firstMessage({ ...valid, shift: '' }, 'shift')).toBe('Select a shift')
  })
  it('rejects negative, fractional and missing quantities', () => {
    expect(firstMessage({ ...valid, producedQuantity: -1 }, 'producedQuantity')).toBe('Cannot be negative')
    expect(firstMessage({ ...valid, producedQuantity: 1.5 }, 'producedQuantity')).toBe('Enter a whole number')
    expect(firstMessage({ ...valid, producedQuantity: Number.NaN }, 'producedQuantity')).toMatch('whole number')
  })
  it('rejects rejected quantity above produced', () => {
    expect(firstMessage({ ...valid, producedQuantity: 5, rejectedQuantity: 6 }, 'rejectedQuantity')).toBe(
      'Cannot be more than the produced quantity',
    )
  })
  it('rejects future dates and dates before the order start', () => {
    expect(firstMessage({ ...valid, reportDate: '2026-11-08' }, 'reportDate')).toMatch('future')
    expect(firstMessage({ ...valid, reportDate: '2026-11-03' }, 'reportDate')).toMatch('planned start')
    expect(firstMessage({ ...valid, reportDate: 'nope' }, 'reportDate')).toBe('Enter a valid date')
  })
  it('limits notes to 500 characters', () => {
    expect(firstMessage({ ...valid, notes: 'x'.repeat(501) }, 'notes')).toMatch('500')
    expect(schema.safeParse({ ...valid, notes: 'x'.repeat(500) }).success).toBe(true)
  })
})
