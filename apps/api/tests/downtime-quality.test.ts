import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../src/lib/password'
import { factoryToday } from '../src/modules/orders/orders.service'
import { ORIGIN, PASSWORD, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'

type Agent = Awaited<ReturnType<TestApp['login']>>
type Body = Record<string, unknown>

describe.skipIf(!TEST_DATABASE_URL)('downtime and quality API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  let sup: Agent
  let op: Agent
  let op2: Agent
  let mgr: Agent
  let admin: Agent
  let orderId: string
  const today = factoryToday()
  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body)
  const patch = (a: Agent, url: string, body: object) => a.patch(url).set('Origin', ORIGIN).send(body)

  let machineSeq = 0
  const freshMachine = async () => {
    machineSeq += 1
    const id = `mc-dq-${machineSeq}`
    await t.db.machine.create({ data: { id, name: `DQ Machine ${machineSeq}`, lineId: 'line-cut-01', shiftTarget: 250 } })
    return id
  }
  const dt = (machineId: string, over: Body = {}) => ({ machineId, orderId: '', reportId: '', startTime: `${today}T08:00`, endTime: `${today}T09:00`, category: 'changeover', notes: 'Die change', ...over })
  const createDt = async (machineId: string, over: Body = {}, agent: Agent = op) => {
    const res = await post(agent, '/api/downtime', dt(machineId, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as { id: string; recordedBy: string }
  }
  const qi = (over: Body = {}) => ({ orderId, reportId: '', inspectionDate: today, inspectedQuantity: 50, failedQuantity: 2, defectId: 'defect-a', notes: '', ...over })
  const createQi = async (over: Body = {}) => {
    const res = await post(sup, '/api/quality', qi(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as { id: string; passedQuantity: number }
  }

  beforeAll(async () => {
    t = await startTestApp()
    await t.db.user.create({ data: { id: 'user-op2', name: 'Mark Bautista', email: 'mark@x.example', role: 'operator', passwordHash: await hashPassword(PASSWORD) } })
    await t.db.defectType.create({ data: { id: 'def-old', name: 'Old defect', isActive: false } })
    sup = await t.login('rosa@x.example')
    op = await t.login('juan@x.example')
    op2 = await t.login('mark@x.example')
    mgr = await t.login('mira@x.example')
    admin = await t.login('carlo@x.example')
    const o = await post(sup, '/api/orders', { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 5000, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '', status: 'planned' })
    orderId = o.body.id
    await post(sup, `/api/orders/${orderId}/status`, { to: 'in_progress' })
  })
  afterAll(async () => {
    await t.close()
  })

  describe('downtime: who may call what', () => {
    it('401 when anonymous', async () => {
      for (const url of ['/api/downtime', '/api/downtime/reference', '/api/quality']) expect((await t.request().get(url)).status, url).toBe(401)
    })
    it('managers, supervisors and operators read; administrators do not', async () => {
      for (const [a, status] of [[mgr, 200], [sup, 200], [op, 200], [admin, 403]] as const) expect((await a.get('/api/downtime')).status).toBe(status)
    })
    it('operators and supervisors write; managers and administrators do not', async () => {
      const m = await freshMachine()
      for (const a of [mgr, admin]) expect((await post(a, '/api/downtime', dt(m))).status).toBe(403)
      expect((await post(op, '/api/downtime', dt(m, { startTime: `${today}T01:00`, endTime: `${today}T02:00` }))).status).toBe(201)
      expect((await post(sup, '/api/downtime', dt(m, { startTime: `${today}T03:00`, endTime: `${today}T04:00` }))).status).toBe(201)
    })
    it('rejects writes from an unlisted origin', async () => {
      expect((await op.post('/api/downtime').set('Origin', 'http://evil.example').send(dt('x'))).status).toBe(403)
    })
  })

  describe('downtime: create and edit', () => {
    it('numbers events DT-NNNN, stores the recorder from the session, converts factory time', async () => {
      const m = await freshMachine()
      const a = await createDt(m)
      const b = await createDt(m, { startTime: `${today}T10:00`, endTime: `${today}T10:30` })
      expect(a.id).toMatch(/^DT-\d{4}$/)
      expect(Number(b.id.slice(3))).toBe(Number(a.id.slice(3)) + 1)
      expect(a.recordedBy).toBe('Juan Dela Cruz')
      const item = (await op.get(`/api/downtime/${a.id}`)).body
      expect(item).toMatchObject({ minutes: 60, machineName: expect.stringContaining('DQ Machine'), lineName: 'Cutting Line 01' })
      expect(item.event.startTime).toBe(new Date(`${today}T08:00:00+08:00`).toISOString())
    })
    it('never hands out the same number to simultaneous events', async () => {
      const machines = await Promise.all(Array.from({ length: 5 }, freshMachine))
      const results = await Promise.all(machines.map((m) => post(op, '/api/downtime', dt(m))))
      expect(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.body))).toBe(true)
      expect(new Set(results.map((r) => r.body.id as string)).size).toBe(5)
    })
    it('reports every invalid field with the form messages', async () => {
      const m = await freshMachine()
      const res = await post(op, '/api/downtime', dt(m, { notes: 'ab', startTime: 'nope', category: 'coffee' }))
      expect(res.status).toBe(400)
      expect(res.body.error.details).toMatchObject({ notes: 'Describe the reason (at least 3 characters)', startTime: 'Enter a valid start date and time', category: 'Select a category' })
      expect((await post(op, '/api/downtime', dt(m, { endTime: `${today}T08:00` }))).body.error.details.endTime).toBe('End must be after the start')
      expect((await post(op, '/api/downtime', dt(m, { startTime: '2999-01-01T08:00', endTime: '2999-01-01T09:00' }))).body.error.details.startTime).toBe('Start cannot be in the future')
      expect((await post(op, '/api/downtime', { ...dt(m), notes: 5 })).status).toBe(400)
    })
    it('refuses unknown or inactive machine, wrong-line order, wrong-machine report', async () => {
      expect((await post(op, '/api/downtime', dt('nope'))).status).toBe(400)
      const inactive = await freshMachine()
      await t.db.machine.update({ where: { id: inactive }, data: { isActive: false } })
      const res = await post(op, '/api/downtime', dt(inactive))
      expect(res.status).toBe(422)
      expect(res.body.error.message).toContain('inactive')
      await t.db.productionLine.create({ data: { id: 'line-2', name: 'Press Line', code: 'PRS' } })
      await t.db.machine.create({ data: { id: 'mc-press', name: 'Press 1', lineId: 'line-2', shiftTarget: 100 } })
      const wrong = await post(op, '/api/downtime', dt('mc-press', { orderId }))
      expect(wrong.status).toBe(422)
      expect(wrong.body.error.message).toContain("not on this machine's production line")
      expect((await post(op, '/api/downtime', dt(await freshMachine(), { orderId: 'PO-1999-001' }))).status).toBe(400)
      const m = await freshMachine()
      const r = await post(op, '/api/reports', { orderId, machineId: m, shift: 'morning', reportDate: today, producedQuantity: 10, rejectedQuantity: 0, notes: '', mode: 'draft' })
      const other = await freshMachine()
      const mismatch = await post(op, '/api/downtime', dt(other, { reportId: r.body.id }))
      expect(mismatch.status).toBe(422)
      expect(mismatch.body.error.message).toContain('different machine')
      expect((await post(op, '/api/downtime', dt(m, { reportId: r.body.id, orderId }))).status).toBe(201)
    })
    it('blocks overlapping events on one machine, allows touching ones and other machines', async () => {
      const m = await freshMachine()
      const first = await createDt(m)
      const overlap = await post(op, '/api/downtime', dt(m, { startTime: `${today}T08:30`, endTime: `${today}T09:30` }))
      expect(overlap.status).toBe(422)
      expect(overlap.body.error.message).toContain(`overlaps ${first.id}`)
      expect((await post(op, '/api/downtime', dt(m, { startTime: `${today}T09:00`, endTime: `${today}T09:30` }))).status).toBe(201)
      expect((await post(op, '/api/downtime', dt(await freshMachine(), { startTime: `${today}T08:30`, endTime: `${today}T09:30` }))).status).toBe(201)
    })
    it('two simultaneous overlapping events: exactly one is saved', async () => {
      const m = await freshMachine()
      const [a, b] = await Promise.all([post(op, '/api/downtime', dt(m)), post(sup, '/api/downtime', dt(m, { startTime: `${today}T08:30`, endTime: `${today}T09:30` }))])
      expect([a.status, b.status].sort()).toEqual([201, 422])
      expect(await t.db.downtimeEvent.count({ where: { machineId: m } })).toBe(1)
    })
    it('edit: own event by the operator, any event by a supervisor, not another operator’s', async () => {
      const m = await freshMachine()
      const e = await createDt(m)
      const change = dt(m, { notes: 'Longer reason', endTime: `${today}T09:30` })
      expect((await patch(op2, `/api/downtime/${e.id}`, change)).status).toBe(403)
      expect((await patch(mgr, `/api/downtime/${e.id}`, change)).status).toBe(403)
      const own = await patch(op, `/api/downtime/${e.id}`, change)
      expect(own.status, JSON.stringify(own.body)).toBe(200)
      expect(own.body.notes).toBe('Longer reason')
      const bySup = await patch(sup, `/api/downtime/${e.id}`, dt(m, { notes: 'Supervisor fix', endTime: `${today}T09:30` }))
      expect(bySup.status).toBe(200)
      expect(bySup.body.recordedBy).toBe('Juan Dela Cruz')
      expect((await patch(op, '/api/downtime/DT-9999', change)).status).toBe(404)
    })
    it('editing an event does not collide with itself', async () => {
      const m = await freshMachine()
      const e = await createDt(m)
      expect((await patch(op, `/api/downtime/${e.id}`, dt(m))).status).toBe(200)
    })
    it('an event linked to an approved report is locked, and cannot be linked to one', async () => {
      const m = await freshMachine()
      const r = await post(op, '/api/reports', { orderId, machineId: m, shift: 'morning', reportDate: today, producedQuantity: 10, rejectedQuantity: 0, notes: '', mode: 'submit' })
      const e = await createDt(m, { reportId: r.body.id, orderId })
      expect((await post(sup, `/api/approvals/${r.body.id}/approve`)).status).toBe(200)
      const locked = await patch(op, `/api/downtime/${e.id}`, dt(m, { reportId: r.body.id, orderId, notes: 'Too late' }))
      expect(locked.status).toBe(422)
      expect(locked.body.error.message).toContain('approved report')
      const link = await post(op, '/api/downtime', dt(m, { reportId: r.body.id, orderId, startTime: `${today}T11:00`, endTime: `${today}T11:30` }))
      expect(link.status).toBe(422)
      expect(link.body.error.message).toContain('approved report')
      expect((await sup.get(`/api/downtime/${e.id}`)).body.reportStatus).toBe('approved')
    })
    it('downtime shows on the report detail and approval queue', async () => {
      const m = await freshMachine()
      const r = await post(op, '/api/reports', { orderId, machineId: m, shift: 'morning', reportDate: today, producedQuantity: 10, rejectedQuantity: 0, notes: '', mode: 'submit' })
      await createDt(m, { reportId: r.body.id })
      expect((await sup.get(`/api/reports/${r.body.id}`)).body).toMatchObject({ totalDowntimeMinutes: 60 })
      expect((await sup.get('/api/approvals')).body.find((i: { report: { id: string } }) => i.report.id === r.body.id).downtimeMinutes).toBe(60)
    })
    it('reference lists lines, machines, orders, reports and today', async () => {
      const ref = (await op.get('/api/downtime/reference')).body
      expect(ref.today).toBe(today)
      expect(ref.orders.find((o: { id: string }) => o.id === orderId)).toMatchObject({ status: 'in_progress', lineId: 'line-cut-01' })
      expect(ref.machines.length).toBeGreaterThan(1)
    })
  })

  describe('quality', () => {
    it('only managers and supervisors read; only supervisors write', async () => {
      for (const [a, status] of [[mgr, 200], [sup, 200], [op, 403], [admin, 403]] as const) {
        expect((await a.get('/api/quality')).status).toBe(status)
        expect((await a.get('/api/quality/reference')).status).toBe(status)
      }
      for (const a of [mgr, op, admin]) expect((await post(a, '/api/quality', qi())).status).toBe(403)
      const q = await createQi()
      for (const a of [mgr, op, admin]) expect((await patch(a, `/api/quality/${q.id}`, qi())).status).toBe(403)
      expect((await sup.post('/api/quality').set('Origin', 'http://evil.example').send(qi())).status).toBe(403)
    })
    it('numbers QI-<year>-NNNN, calculates passed, takes the product from the order', async () => {
      const a = await createQi({ inspectedQuantity: 40, failedQuantity: 3 })
      const b = await createQi()
      expect(a.id).toMatch(/^QI-\d{4}-\d{4}$/)
      expect(Number(b.id.slice(-4))).toBe(Number(a.id.slice(-4)) + 1)
      expect(a.passedQuantity).toBe(37)
      const item = (await sup.get(`/api/quality/${a.id}`)).body
      expect(item).toMatchObject({ productName: 'Steel mounting brackets', lineName: 'Cutting Line 01', defectName: 'Burr', passRate: 92.5 })
      expect(item.inspection).toMatchObject({ inspector: 'Rosa Villanueva', productId: 'prod-bracket' })
    })
    it('never hands out the same number to simultaneous inspections', async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => post(sup, '/api/quality', qi())))
      expect(results.every((r) => r.status === 201)).toBe(true)
      expect(new Set(results.map((r) => r.body.id as string)).size).toBe(5)
    })
    it('reports every invalid field with the form messages', async () => {
      const res = await post(sup, '/api/quality', qi({ inspectedQuantity: 0, failedQuantity: -1, inspectionDate: '2026-02-30' }))
      expect(res.status).toBe(400)
      expect(res.body.error.details).toMatchObject({ inspectedQuantity: 'Must be at least 1', failedQuantity: 'Cannot be negative', inspectionDate: 'Enter a valid date' })
      expect((await post(sup, '/api/quality', qi({ failedQuantity: 99 }))).body.error.details.failedQuantity).toBe('Cannot be more than the inspected quantity')
      expect((await post(sup, '/api/quality', qi({ defectId: '' }))).body.error.details.defectId).toBe('Select a defect classification')
      expect((await post(sup, '/api/quality', qi({ inspectionDate: '2999-01-01' }))).body.error.details.inspectionDate).toBe('Inspection date cannot be in the future')
      expect((await post(sup, '/api/quality', qi({ inspectionDate: '2025-12-31' }))).body.error.details.inspectionDate).toContain("before the order's planned start")
      expect((await post(sup, '/api/quality', qi({ inspectedQuantity: '5' }))).status).toBe(400)
    })
    it('drops the defect when nothing failed', async () => {
      const q = await createQi({ failedQuantity: 0, defectId: 'defect-a' })
      expect((await sup.get(`/api/quality/${q.id}`)).body).toMatchObject({ defectName: null, passRate: 100 })
    })
    it('refuses unknown or inactive defect, and orders that are not In Progress or Completed', async () => {
      expect((await post(sup, '/api/quality', qi({ defectId: 'nope' }))).status).toBe(400)
      const inactive = await post(sup, '/api/quality', qi({ defectId: 'def-old' }))
      expect(inactive.status).toBe(422)
      expect(inactive.body.error.message).toContain('inactive')
      expect((await post(sup, '/api/quality', qi({ orderId: 'PO-1999-001' }))).status).toBe(400)
      const planned = (await post(sup, '/api/orders', { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 10, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '', status: 'planned' })).body.id
      const res = await post(sup, '/api/quality', qi({ orderId: planned }))
      expect(res.status).toBe(422)
      expect(res.body.error.message).toContain('In Progress or Completed')
    })
    it('a linked report must be on the same order and cover the inspected quantity', async () => {
      const m = await freshMachine()
      const r = await post(op, '/api/reports', { orderId, machineId: m, shift: 'morning', reportDate: today, producedQuantity: 30, rejectedQuantity: 0, notes: '', mode: 'draft' })
      const tooMany = await post(sup, '/api/quality', qi({ reportId: r.body.id, inspectedQuantity: 31 }))
      expect(tooMany.status).toBe(422)
      expect(tooMany.body.error.message).toContain('30 produced')
      expect((await post(sup, '/api/quality', qi({ reportId: r.body.id, inspectedQuantity: 30 }))).status).toBe(201)
      expect((await post(sup, '/api/quality', qi({ reportId: 'RPT-NOPE' }))).status).toBe(400)
      const other = (await post(sup, '/api/orders', { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 10, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '', status: 'planned' })).body.id
      await post(sup, `/api/orders/${other}/status`, { to: 'in_progress' })
      const wrongOrder = await post(sup, '/api/quality', qi({ orderId: other, reportId: r.body.id }))
      expect(wrongOrder.status).toBe(422)
      expect(wrongOrder.body.error.message).toContain('different production order')
    })
    it('edit: updates values, keeps the order fixed, allows keeping a now-inactive defect', async () => {
      const q = await createQi()
      const res = await patch(sup, `/api/quality/${q.id}`, qi({ inspectedQuantity: 60, failedQuantity: 5, notes: ' recount ' }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body).toMatchObject({ inspectedQuantity: 60, failedQuantity: 5, passedQuantity: 55, notes: 'recount' })
      await t.db.defectType.update({ where: { id: 'defect-a' }, data: { isActive: false } })
      expect((await patch(sup, `/api/quality/${q.id}`, qi({ inspectedQuantity: 61, failedQuantity: 5 }))).status).toBe(200)
      await t.db.defectType.update({ where: { id: 'defect-a' }, data: { isActive: true } })
      const other = (await post(sup, '/api/orders', { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 10, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '', status: 'planned' })).body.id
      const moved = await patch(sup, `/api/quality/${q.id}`, qi({ orderId: other }))
      expect(moved.status).toBe(422)
      expect(moved.body.error.message).toContain('cannot be changed')
      expect((await patch(sup, '/api/quality/QI-1999-0001', qi())).status).toBe(404)
    })
    it('reference lists orders, reports and defects; no secrets leak', async () => {
      const ref = (await sup.get('/api/quality/reference')).body
      expect(ref.today).toBe(today)
      expect(ref.defects.map((d: { id: string }) => d.id)).toEqual(expect.arrayContaining(['defect-a', 'def-old']))
      expect(ref.orders.find((o: { id: string }) => o.id === orderId)).toMatchObject({ plannedStart: '2026-01-01', status: 'in_progress' })
      expect(JSON.stringify((await sup.get('/api/quality')).body)).not.toMatch(/passwordHash|tokenVersion|@x\.example/)
    })
  })
})
