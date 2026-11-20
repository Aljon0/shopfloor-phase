import { beforeAll, describe, expect, it } from 'vitest'
import { setMockLatency, mockRepository } from '@/mocks/repository'
import { createOrder, updateOrder } from '@/features/production-orders/services/orders-service'
import { createReport, ReportRuleError } from '@/features/production-reports/services/reports-service'
import { createDowntimeEvent } from '@/features/downtime/services/downtime-service'
import {
  SettingsRuleError,
  createDefectType,
  createLine,
  createMachine,
  createProduct,
  createUser,
  getSettingsData,
  setDefectTypeActive,
  setLineActive,
  setMachineActive,
  setProductActive,
  setUserActive,
  updateMachine,
  updateShift,
  updateUser,
} from './settings-mock-service'

const admin = 'Carlo Reyes'

beforeAll(() => setMockLatency(0))

const orderInput = (productId: string, lineId: string) => ({
  productId,
  lineId,
  plannedQuantity: 100,
  plannedStart: '2026-11-09',
  dueDate: '2026-11-20',
  priority: 'normal' as const,
  instructions: '',
})

describe('settings service (mock backend)', () => {
  it('lists configuration and open-order counts', async () => {
    const data = await getSettingsData()
    expect(data.users.length).toBeGreaterThan(5)
    expect(data.machines).toHaveLength(6)
    expect(data.shifts.map((s) => s.id)).toEqual(['morning', 'night'])
    expect(Object.values(data.openOrders.byLine).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })

  it('creates a product with a unique id, logs it, and rejects duplicates', async () => {
    const p = await createProduct({ name: ' Steel   plates ' }, admin)
    expect(p).toMatchObject({ name: 'Steel plates', isActive: true })
    await expect(createProduct({ name: 'steel plates' }, admin)).rejects.toBeInstanceOf(SettingsRuleError)
    await expect(createProduct({ name: 'x' }, admin)).rejects.toBeInstanceOf(SettingsRuleError)
    const audit = (await getSettingsData()).audit
    expect(audit[0]).toMatchObject({ entity: 'product', action: 'created', actor: admin })
  })

  it('an inactive product cannot be used on a new order but remains on existing ones', async () => {
    const p = await createProduct({ name: 'Retired fixtures' }, admin)
    await setProductActive(p.id, false, admin)
    await expect(createOrder(orderInput(p.id, 'line-cut-01'), 'planned', 'Rosa Villanueva')).rejects.toThrow(/inactive/)
    await setProductActive(p.id, true, admin)
    const order = await createOrder(orderInput(p.id, 'line-cut-01'), 'draft', 'Rosa Villanueva')
    await setProductActive(p.id, false, admin).then(
      () => expect.unreachable('a product with an open order must not deactivate'),
      (e: unknown) => expect(e).toBeInstanceOf(SettingsRuleError),
    )
    // Editing the existing order keeps working while the product is active; switching to an inactive one is refused.
    const other = await createProduct({ name: 'Temporary product' }, admin)
    await setProductActive(other.id, false, admin)
    await expect(updateOrder(order.id, orderInput(other.id, 'line-cut-01'), 'Rosa Villanueva')).rejects.toThrow(/inactive/)
  })

  it('creates lines with unique names and codes; deactivating needs no open orders or active machines', async () => {
    await expect(createLine({ name: 'Cutting Line 01', code: 'XYZ' }, admin)).rejects.toThrow(/already exists/)
    await expect(createLine({ name: 'Paint Line', code: 'CUT' }, admin)).rejects.toThrow(/already used/)
    await expect(createLine({ name: 'Paint Line', code: 'pt' }, admin)).rejects.toBeInstanceOf(SettingsRuleError)
    const line = await createLine({ name: 'Paint Line 01', code: 'PNT' }, admin)
    const machine = await createMachine({ name: 'Paint Booth PB-1', lineId: line.id, shiftTarget: 90 }, admin)
    await expect(setLineActive(line.id, false, admin)).rejects.toThrow(/active machine/)
    await setMachineActive(machine.id, false, admin)
    await setLineActive(line.id, false, admin)
    await expect(setMachineActive(machine.id, true, admin)).rejects.toThrow(/Activate the line first/)
    await expect(createMachine({ name: 'Booth 2', lineId: line.id, shiftTarget: 90 }, admin)).rejects.toThrow(/inactive/)
    await expect(setLineActive('line-cut-01', false, admin)).rejects.toBeInstanceOf(SettingsRuleError)
  })

  it('machine target changes apply to new reports only and are logged', async () => {
    const before = (await mockRepository.listReports()).filter((r) => r.machineId === 'mc-wc-02')
    const m = await updateMachine('mc-wc-02', { name: 'Welding Cell WC-02', shiftTarget: 200 }, admin)
    expect(m.shiftTarget).toBe(200)
    const after = (await mockRepository.listReports()).filter((r) => r.machineId === 'mc-wc-02')
    expect(after.map((r) => r.shiftTarget)).toEqual(before.map((r) => r.shiftTarget))
    expect((await getSettingsData()).audit[0]?.detail).toContain('new reports only')
    await expect(updateMachine('mc-wc-02', { name: 'Welding Cell WC-02', shiftTarget: 0 }, admin)).rejects.toBeInstanceOf(SettingsRuleError)
  })

  it('an inactive machine is refused for new reports and downtime', async () => {
    await setMachineActive('mc-pb-02', false, admin)
    await expect(
      createReport({ orderId: 'PO-2026-005', machineId: 'mc-pb-02', shift: 'morning', reportDate: '2026-11-07', producedQuantity: 10, rejectedQuantity: 0, notes: '' }, 'draft', 'Juan Dela Cruz'),
    ).rejects.toBeInstanceOf(ReportRuleError)
    await expect(
      createDowntimeEvent({ machineId: 'mc-pb-02', category: 'changeover', startTime: '2026-11-07T10:00', endTime: '2026-11-07T10:30', notes: 'Changeover for new tooling', orderId: '', reportId: '' }, 'Juan Dela Cruz'),
    ).rejects.toThrow(/inactive/)
    await setMachineActive('mc-pb-02', true, admin)
  })

  it('protects administrators and your own account', async () => {
    const data = await getSettingsData()
    const admins = data.users.filter((u) => u.role === 'administrator' && u.isActive)
    expect(admins).toHaveLength(1)
    const me = admins[0]!
    await expect(setUserActive(me.id, false, 'Somebody Else')).rejects.toThrow(/at least one active administrator/)
    await expect(updateUser(me.id, { name: me.name, email: me.email, role: 'manager' }, 'Somebody Else')).rejects.toThrow(/at least one active administrator/)
    const rosa = data.users.find((u) => u.name === 'Rosa Villanueva')!
    await expect(setUserActive(rosa.id, false, 'rosa villanueva')).rejects.toThrow(/own account/)
  })

  it('creates and updates users with unique emails and valid roles', async () => {
    const u = await createUser({ name: 'Liza Cruz', email: 'Liza.Cruz@northstar.example', role: 'operator' }, admin)
    expect(u.email).toBe('liza.cruz@northstar.example')
    await expect(createUser({ name: 'Other Liza', email: 'liza.cruz@northstar.example', role: 'operator' }, admin)).rejects.toThrow(/email/)
    const updated = await updateUser(u.id, { name: 'Liza Cruz', email: u.email, role: 'supervisor' }, admin)
    expect(updated.role).toBe('supervisor')
    expect((await getSettingsData()).audit[0]?.detail).toContain('role operator → supervisor')
    const off = await setUserActive(u.id, false, admin)
    expect(off.isActive).toBe(false)
  })

  it('keeps at least one active defect type and hides inactive ones from new inspections', async () => {
    const d = await createDefectType({ name: 'Paint run' }, admin)
    expect(d.isActive).toBe(true)
    const all = await mockRepository.listDefectTypes()
    for (const x of all.filter((x) => x.id !== d.id && x.id !== 'defect-other')) await setDefectTypeActive(x.id, false, admin)
    await setDefectTypeActive(d.id, false, admin)
    await expect(setDefectTypeActive('defect-other', false, admin)).rejects.toThrow(/at least one active defect type/)
  })

  it('validates and saves shift hours', async () => {
    await expect(updateShift('morning', { startTime: '07:00', endTime: '07:00' }, admin)).rejects.toBeInstanceOf(SettingsRuleError)
    const s = await updateShift('morning', { startTime: '07:00', endTime: '19:00' }, admin)
    expect(s).toMatchObject({ startTime: '07:00', endTime: '19:00' })
    expect((await getSettingsData()).audit[0]).toMatchObject({ entity: 'shift', action: 'updated' })
  })
})
