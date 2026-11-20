import { validateInspectionInput, type InspectionInput } from '@shopfloor/shared'
import { describe, expect, it } from 'vitest'
import { buildInspectionFormSchema } from './quality-form-schema'

/** The form (zod) and the API (shared validator) must agree on what is valid and on the messages. */
const today = '2026-11-14'
const orderStart = '2026-11-05'
const base: InspectionInput = { orderId: 'PO-1', reportId: '', inspectionDate: '2026-11-10', inspectedQuantity: 50, failedQuantity: 2, defectId: 'd1', notes: '' }
const cases: [string, Partial<InspectionInput>][] = [
  ['valid', {}],
  ['no order', { orderId: '' }],
  ['bad date', { inspectionDate: '2026-02-30' }],
  ['future date', { inspectionDate: '2026-11-15' }],
  ['before order start', { inspectionDate: '2026-11-01' }],
  ['on order start', { inspectionDate: orderStart }],
  ['zero inspected', { inspectedQuantity: 0, failedQuantity: 0, defectId: '' }],
  ['fraction inspected', { inspectedQuantity: 1.5 }],
  ['too many inspected', { inspectedQuantity: 1_000_001 }],
  ['negative failed', { failedQuantity: -1 }],
  ['fraction failed', { failedQuantity: 0.5 }],
  ['NaN failed', { failedQuantity: Number.NaN }],
  ['failed over inspected', { failedQuantity: 51 }],
  ['failed equals inspected', { failedQuantity: 50 }],
  ['failed without defect', { defectId: '' }],
  ['nothing failed, no defect', { failedQuantity: 0, defectId: '' }],
  ['long notes', { notes: 'x'.repeat(301) }],
  ['boundary notes', { notes: 'x'.repeat(300) }],
  ['bad date and failed over', { inspectionDate: 'nope', failedQuantity: 99 }],
  ['future date and failed without defect', { inspectionDate: '2026-12-01', defectId: '' }],
  ['negative failed and no defect', { failedQuantity: -2, defectId: '' }],
]

describe('quality validation: form schema and shared validator agree', () => {
  it.each(cases)('%s', (_name, change) => {
    const input = { ...base, ...change }
    const zod = buildInspectionFormSchema({ today, orderStarts: { 'PO-1': orderStart } }).safeParse(input)
    const zodErrors: Record<string, string> = {}
    if (!zod.success) for (const i of zod.error.issues) zodErrors[String(i.path[0])] ??= i.message
    expect(validateInspectionInput(input, { today, orderStart })).toEqual(zodErrors)
  })
})
