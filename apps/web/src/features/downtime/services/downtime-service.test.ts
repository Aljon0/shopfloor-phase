import { beforeAll, describe, expect, it } from 'vitest'
import { mockRepository, setMockLatency } from '@/mocks/repository'
import { getReportDetail } from '@/features/production-reports/services/reports-service'
import { DowntimeRuleError, createDowntimeEvent, getDowntimeReference, listDowntimeItems, updateDowntimeEvent } from './downtime-mock-service'
import type { DowntimeInput } from '../types'

// Sundays have no production in the seed, so 2026-11-01 is free on every machine.
const input: DowntimeInput = {
  machineId: 'mc-lc-01', orderId: '', reportId: '', startTime: '2026-11-01T10:00', endTime: '2026-11-01T10:40',
  category: 'changeover', notes: 'Tooling swap',
}

beforeAll(() => setMockLatency(0))

describe('downtime service (mock backend)', () => {
  it('lists the blueprint sample: 35 minutes of machine maintenance on its report', async () => {
    const sample = (await listDowntimeItems()).find((i) => i.event.reportId === 'RPT-20261103-CUT-AM')
    expect(sample?.minutes).toBe(35)
    expect(sample?.event.category).toBe('machine_maintenance')
    expect(sample?.reportStatus).toBe('approved')
  })

  it('creates an event: derived line, next number, recorder, activity entry', async () => {
    const before = (await listDowntimeItems()).length
    const event = await createDowntimeEvent(input, 'Juan Dela Cruz')
    expect(event.id).toMatch(/^DT-\d{4}$/)
    expect(event.lineId).toBe('line-cut-01')
    expect(event.recordedBy).toBe('Juan Dela Cruz')
    expect(event.startTime).toBe('2026-11-01T10:00:00+08:00')
    expect(event.orderId).toBeUndefined()
    expect((await listDowntimeItems()).length).toBe(before + 1)
    const newest = (await mockRepository.listActivity())[0]
    expect(newest?.kind).toBe('downtime_recorded')
    expect(newest?.subject).toContain(event.id)
  })

  it('refuses an overlap on the same machine but allows another machine', async () => {
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-01T10:20', endTime: '2026-11-01T11:00' }, 'x')).rejects.toThrow('overlaps')
    await expect(createDowntimeEvent({ ...input, machineId: 'mc-sh-02' }, 'x')).resolves.toBeDefined()
  })

  it('enforces machine, order and report rules', async () => {
    await expect(createDowntimeEvent({ ...input, machineId: 'mc-nope' }, 'x')).rejects.toThrow('valid machine')
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-01T12:00', endTime: '2026-11-01T12:30', orderId: 'PO-NOPE' }, 'x')).rejects.toThrow('valid production order')
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-01T12:00', endTime: '2026-11-01T12:30', orderId: 'PO-2026-007' }, 'x')).rejects.toThrow('production line')
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-01T12:00', endTime: '2026-11-01T12:30', reportId: 'RPT-20261103-CUT-AM' }, 'x')).rejects.toThrow('approved report')
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-01T12:00', endTime: '2026-11-01T12:30', reportId: 'RPT-20261107-WLD-AM' }, 'x')).rejects.toThrow('different machine')
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-08T12:00', endTime: '2026-11-08T12:30' }, 'x')).rejects.toThrow('future')
    await expect(createDowntimeEvent({ ...input, startTime: '2026-11-01T13:00', endTime: '2026-11-01T12:30' }, 'x')).rejects.toThrow('after the start')
  })

  it('links an event to an open report and shows it on that report', async () => {
    const event = await createDowntimeEvent(
      { ...input, machineId: 'mc-wc-01', startTime: '2026-11-01T09:00', endTime: '2026-11-01T09:25', orderId: 'PO-2026-007', reportId: 'RPT-20261107-WLD-AM', category: 'material_shortage' },
      'Jose Ramos',
    )
    expect(event.orderId).toBe('PO-2026-007')
    const detail = await getReportDetail('RPT-20261107-WLD-AM')
    expect(detail?.downtime.map((d) => d.id)).toContain(event.id)
    expect(detail?.totalDowntimeMinutes).toBeGreaterThanOrEqual(25)
  })

  it('edits an event, keeps its recorder, and re-checks overlap against others only', async () => {
    const created = await createDowntimeEvent({ ...input, machineId: 'mc-pb-01', startTime: '2026-11-01T08:00', endTime: '2026-11-01T08:30' }, 'Carlo Mendoza')
    const updated = await updateDowntimeEvent(created.id, { ...input, machineId: 'mc-pb-01', startTime: '2026-11-01T08:10', endTime: '2026-11-01T08:50', notes: 'Longer than first thought' })
    expect(updated.recordedBy).toBe('Carlo Mendoza')
    expect(updated.endTime).toBe('2026-11-01T08:50:00+08:00')
    expect(updated.lineId).toBe('line-bend-01')
    await expect(updateDowntimeEvent('DT-9999', input)).rejects.toThrow('not found')
  })

  it('locks events that belong to an approved report', async () => {
    const sample = (await listDowntimeItems()).find((i) => i.event.reportId === 'RPT-20261103-CUT-AM')
    await expect(updateDowntimeEvent(sample!.event.id, { ...input, machineId: sample!.event.machineId })).rejects.toThrow(DowntimeRuleError)
    await expect(updateDowntimeEvent(sample!.event.id, { ...input, machineId: sample!.event.machineId })).rejects.toThrow('approved report')
  })

  it('offers form reference data', async () => {
    const ref = await getDowntimeReference()
    expect(ref.today).toBe('2026-11-07')
    expect(ref.machines.length).toBe(6)
    expect(ref.reports.length).toBeGreaterThan(60)
  })
})
