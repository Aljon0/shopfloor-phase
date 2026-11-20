import { validateDowntimeInput, type DowntimeInput } from '@shopfloor/shared'
import { describe, expect, it } from 'vitest'
import { buildDowntimeFormSchema } from './downtime-form-schema'

/** The form (zod) and the API (shared validator) must agree on what is valid and on the messages. */
const today = '2026-11-14'
const base: DowntimeInput = { machineId: 'm', orderId: '', reportId: '', startTime: '2026-11-10T08:00', endTime: '2026-11-10T09:00', category: 'changeover', notes: 'Die change' }
const cases: [string, Partial<DowntimeInput>][] = [
  ['valid', {}],
  ['no machine', { machineId: '' }],
  ['bad start', { startTime: '2026-11-10 08:00' }],
  ['bad end', { endTime: 'tomorrow' }],
  ['bad hour', { startTime: '2026-11-10T25:00' }],
  ['impossible date', { startTime: '2026-02-30T08:00' }],
  ['bad category', { category: 'coffee' as never }],
  ['short notes', { notes: 'ab' }],
  ['padded short notes', { notes: ' a ' }],
  ['long notes', { notes: 'x'.repeat(301) }],
  ['boundary notes', { notes: 'x'.repeat(300) }],
  ['end equals start', { endTime: '2026-11-10T08:00' }],
  ['end before start', { endTime: '2026-11-10T07:00' }],
  ['exactly 24h', { endTime: '2026-11-11T08:00' }],
  ['over 24h', { endTime: '2026-11-11T08:01' }],
  ['future start', { startTime: '2026-11-15T08:00', endTime: '2026-11-15T09:00' }],
  ['future end', { endTime: '2026-11-15T01:00' }],
  ['today', { startTime: '2026-11-14T08:00', endTime: '2026-11-14T09:00' }],
  ['bad start and bad end', { startTime: 'x', endTime: 'y' }],
  ['bad start with valid end', { startTime: 'x' }],
  ['future start and end before', { startTime: '2026-11-15T08:00', endTime: '2026-11-15T07:00' }],
  ['bad category and short notes', { category: 'coffee' as never, notes: '' }],
]

describe('downtime validation: form schema and shared validator agree', () => {
  it.each(cases)('%s', (_name, change) => {
    const input = { ...base, ...change }
    const zod = buildDowntimeFormSchema({ today }).safeParse(input)
    const zodErrors: Record<string, string> = {}
    if (!zod.success) for (const i of zod.error.issues) zodErrors[String(i.path[0])] ??= i.message
    expect(validateDowntimeInput(input, { today })).toEqual(zodErrors)
  })
})
