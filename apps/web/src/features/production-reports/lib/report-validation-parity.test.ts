import { validateReportInput, type ReportInput } from '@shopfloor/shared'
import { describe, expect, it } from 'vitest'
import { buildReportFormSchema } from './report-form-schema'

/** The form (zod) and the API (shared validator) must agree on what is valid and on the messages. */
const today = '2026-11-14'
const orderStart = '2026-11-05'
const base: ReportInput = { orderId: 'PO-1', machineId: 'm', shift: 'morning', reportDate: '2026-11-10', producedQuantity: 100, rejectedQuantity: 5, notes: '' }
const cases: [string, Partial<ReportInput>][] = [
  ['valid', {}],
  ['no order', { orderId: '' }],
  ['no machine', { machineId: '' }],
  ['bad shift', { shift: 'evening' as never }],
  ['bad date', { reportDate: '2026-02-30' }],
  ['future date', { reportDate: '2026-11-15' }],
  ['today', { reportDate: today }],
  ['before order start', { reportDate: '2026-11-01' }],
  ['on order start', { reportDate: orderStart }],
  ['negative produced', { producedQuantity: -1 }],
  ['fraction produced', { producedQuantity: 1.5 }],
  ['negative fraction', { producedQuantity: -1.5 }],
  ['too many produced', { producedQuantity: 1_000_001 }],
  ['NaN rejected', { rejectedQuantity: Number.NaN }],
  ['rejected over produced', { rejectedQuantity: 101 }],
  ['rejected equals produced', { rejectedQuantity: 100 }],
  ['zero both', { producedQuantity: 0, rejectedQuantity: 0 }],
  ['bad shift and rejected over', { shift: 'evening' as never, rejectedQuantity: 500 }],
  ['negative rejected', { rejectedQuantity: -3 }],
  ['long notes', { notes: 'x'.repeat(501) }],
  ['boundary notes', { notes: 'x'.repeat(500) }],
  ['bad date and rejected over', { reportDate: 'nope', rejectedQuantity: 500 }],
  ['future date and rejected over', { reportDate: '2026-12-01', rejectedQuantity: 500 }],
]

describe('report validation: form schema and shared validator agree', () => {
  it.each(cases)('%s', (_name, change) => {
    const input = { ...base, ...change }
    const zod = buildReportFormSchema({ today, orderStarts: { 'PO-1': orderStart } }).safeParse(input)
    const zodErrors: Record<string, string> = {}
    if (!zod.success) for (const i of zod.error.issues) zodErrors[String(i.path[0])] ??= i.message
    expect(validateReportInput(input, { today, orderStart })).toEqual(zodErrors)
  })
})
