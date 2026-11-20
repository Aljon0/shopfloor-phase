import { describe, expect, it } from 'vitest'
import { buildDowntimeFormSchema } from './downtime-form-schema'

const schema = buildDowntimeFormSchema({ today: '2026-11-07' })
const valid = {
  machineId: 'mc-lc-01', orderId: '', reportId: '', startTime: '2026-11-07T09:00', endTime: '2026-11-07T09:35',
  category: 'machine_maintenance' as const, notes: 'Blade change',
}
const message = (input: unknown, path: string) => schema.safeParse(input).error?.issues.find((i) => i.path.join('.') === path)?.message

describe('downtime form schema', () => {
  it('accepts a valid event', () => expect(schema.safeParse(valid).success).toBe(true))
  it('requires machine, category and a reason', () => {
    expect(message({ ...valid, machineId: '' }, 'machineId')).toBe('Select a machine')
    expect(message({ ...valid, category: '' }, 'category')).toBe('Select a category')
    expect(message({ ...valid, notes: ' a ' }, 'notes')).toMatch('at least 3')
    expect(message({ ...valid, notes: 'x'.repeat(301) }, 'notes')).toMatch('300')
  })
  it('requires end after start and at most 24 hours', () => {
    expect(message({ ...valid, endTime: '2026-11-07T09:00' }, 'endTime')).toBe('End must be after the start')
    expect(message({ ...valid, endTime: '2026-11-07T08:00' }, 'endTime')).toBe('End must be after the start')
    expect(message({ ...valid, startTime: '2026-11-06T08:00', endTime: '2026-11-07T08:01' }, 'endTime')).toMatch('24 hours')
    expect(schema.safeParse({ ...valid, startTime: '2026-11-06T08:00', endTime: '2026-11-07T08:00' }).success).toBe(true)
  })
  it('rejects future and invalid times', () => {
    expect(message({ ...valid, startTime: '2026-11-08T01:00', endTime: '2026-11-08T02:00' }, 'startTime')).toMatch('future')
    expect(message({ ...valid, startTime: '' }, 'startTime')).toMatch('valid start')
  })
})
