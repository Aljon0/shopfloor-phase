import { describe, expect, it } from 'vitest'
import { buildInspectionFormSchema } from './quality-form-schema'

const schema = buildInspectionFormSchema({ today: '2026-11-07', orderStarts: { 'PO-1': '2026-11-04' } })
const valid = { orderId: 'PO-1', reportId: '', inspectionDate: '2026-11-07', inspectedQuantity: 120, failedQuantity: 4, defectId: 'defect-burr', notes: '' }
const message = (input: unknown, path: string) => schema.safeParse(input).error?.issues.find((i) => i.path.join('.') === path)?.message

describe('inspection form schema', () => {
  it('accepts a valid inspection, with or without failures', () => {
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, failedQuantity: 0, defectId: '' }).success).toBe(true)
  })
  it('requires an order and a positive inspected quantity', () => {
    expect(message({ ...valid, orderId: '' }, 'orderId')).toBe('Select a production order')
    expect(message({ ...valid, inspectedQuantity: 0 }, 'inspectedQuantity')).toBe('Must be at least 1')
    expect(message({ ...valid, inspectedQuantity: 1.5 }, 'inspectedQuantity')).toBe('Enter a whole number')
    expect(message({ ...valid, failedQuantity: -1 }, 'failedQuantity')).toBe('Cannot be negative')
    expect(message({ ...valid, failedQuantity: Number.NaN }, 'failedQuantity')).toMatch('whole number')
  })
  it('does not allow more failed than inspected', () => {
    expect(message({ ...valid, inspectedQuantity: 5, failedQuantity: 6 }, 'failedQuantity')).toBe('Cannot be more than the inspected quantity')
  })
  it('requires a defect classification only when something failed', () => {
    expect(message({ ...valid, defectId: '' }, 'defectId')).toBe('Select a defect classification')
    expect(message({ ...valid, failedQuantity: 0, defectId: '' }, 'defectId')).toBeUndefined()
  })
  it('rejects future dates, dates before the order start and bad dates', () => {
    expect(message({ ...valid, inspectionDate: '2026-11-08' }, 'inspectionDate')).toMatch('future')
    expect(message({ ...valid, inspectionDate: '2026-11-03' }, 'inspectionDate')).toMatch('planned start')
    expect(message({ ...valid, inspectionDate: 'x' }, 'inspectionDate')).toBe('Enter a valid date')
  })
  it('limits notes to 300 characters', () => {
    expect(message({ ...valid, notes: 'x'.repeat(301) }, 'notes')).toMatch('300')
  })
})
