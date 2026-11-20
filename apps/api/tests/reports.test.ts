import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { factoryToday } from '../src/modules/orders/orders.service'
import { ORIGIN, PASSWORD, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'
import { hashPassword } from '../src/lib/password'

type Agent = Awaited<ReturnType<TestApp['login']>>
type Body = Record<string, unknown>

describe.skipIf(!TEST_DATABASE_URL)('reports and approvals API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  let sup: Agent
  let op: Agent
  let op2: Agent
  let mgr: Agent
  let admin: Agent
  let orderId: string
  const today = factoryToday()
  const yyyymmdd = today.replace(/-/g, '')
  const orderInput = { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 5000, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '' }

  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body)
  const patch = (a: Agent, url: string, body: object) => a.patch(url).set('Origin', ORIGIN).send(body)
  const del = (a: Agent, url: string) => a.delete(url).set('Origin', ORIGIN)

  const input = (over: Body = {}) => ({ orderId, machineId: 'mc-lc-01', shift: 'morning', reportDate: today, producedQuantity: 200, rejectedQuantity: 10, notes: '', mode: 'draft', ...over })
  let slot = 0
  /** A fresh machine per report so tests never collide on the one-report-per-machine-shift-day rule. */
  const freshMachine = async () => {
    slot += 1
    const id = `mc-t-${slot}`
    await t.db.machine.create({ data: { id, name: `Test Machine ${slot}`, lineId: 'line-cut-01', shiftTarget: 250 } })
    return id
  }
  const create = async (over: Body = {}, agent: Agent = op) => {
    const res = await post(agent, '/api/reports', input({ machineId: await freshMachine(), ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as { id: string; status: string; operatorName: string }
  }

  beforeAll(async () => {
    t = await startTestApp()
    await t.db.user.create({ data: { id: 'user-op2', name: 'Mark Bautista', email: 'mark@x.example', role: 'operator', passwordHash: await hashPassword(PASSWORD) } })
    await t.db.shift.create({ data: { id: 'night', name: 'Night', startTime: '18:00', endTime: '06:00' } })
    sup = await t.login('rosa@x.example')
    op = await t.login('juan@x.example')
    op2 = await t.login('mark@x.example')
    mgr = await t.login('mira@x.example')
    admin = await t.login('carlo@x.example')
    const o = await post(sup, '/api/orders', { ...orderInput, status: 'planned' })
    orderId = o.body.id
    await post(sup, `/api/orders/${orderId}/status`, { to: 'in_progress' })
  })
  afterAll(async () => {
    await t.close()
  })

  describe('who may call what', () => {
    it('401 when anonymous', async () => {
      for (const url of ['/api/reports', '/api/reports/reference', '/api/approvals']) expect((await t.request().get(url)).status, url).toBe(401)
    })
    it('managers, supervisors and operators read reports; administrators do not', async () => {
      for (const [a, status] of [[mgr, 200], [sup, 200], [op, 200], [admin, 403]] as const) {
        expect((await a.get('/api/reports')).status).toBe(status)
        expect((await a.get('/api/reports/reference')).status).toBe(status)
      }
    })
    it('only operators write reports', async () => {
      const r = await create()
      for (const a of [mgr, sup, admin]) {
        expect((await post(a, '/api/reports', input())).status).toBe(403)
        expect((await patch(a, `/api/reports/${r.id}`, input())).status).toBe(403)
        expect((await post(a, `/api/reports/${r.id}/submit`)).status).toBe(403)
        expect((await del(a, `/api/reports/${r.id}`)).status).toBe(403)
      }
    })
    it('only supervisors reach approvals', async () => {
      expect((await sup.get('/api/approvals')).status).toBe(200)
      for (const a of [mgr, op, admin]) {
        expect((await a.get('/api/approvals')).status).toBe(403)
        expect((await post(a, '/api/approvals/x/approve')).status).toBe(403)
        expect((await post(a, '/api/approvals/x/return', { reason: 'long enough' })).status).toBe(403)
      }
    })
    it('rejects writes from an unlisted origin', async () => {
      expect((await op.post('/api/reports').set('Origin', 'http://evil.example').send(input())).status).toBe(403)
    })
  })

  describe('create', () => {
    it('numbers reports RPT-<date>-<line code>-<AM|PM> and appends a sequence when taken', async () => {
      const a = await create({ shift: 'night' })
      const b = await create({ shift: 'night' })
      expect(a.id).toBe(`RPT-${yyyymmdd}-CUT-PM`)
      expect(b.id).toBe(`RPT-${yyyymmdd}-CUT-PM-2`)
      expect(a).toMatchObject({ status: 'draft', operatorName: 'Juan Dela Cruz' })
    })
    it('never hands out the same number to simultaneous requests', async () => {
      const machines = await Promise.all(Array.from({ length: 5 }, freshMachine))
      const results = await Promise.all(machines.map((machineId) => post(op, '/api/reports', input({ machineId, shift: 'morning', reportDate: '2026-11-02' }))))
      expect(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.body))).toBe(true)
      expect(new Set(results.map((r) => r.body.id as string)).size).toBe(5)
    })
    it('submitting on create goes straight to Pending Review with both history entries', async () => {
      const r = await create({ mode: 'submit' })
      expect(r.status).toBe('pending_review')
      const detail = (await op.get(`/api/reports/${r.id}`)).body
      expect(detail.timeline.map((e: { description: string }) => e.description)).toEqual(['submitted the report for review', 'created the report'])
    })
    it('takes the shift target from the machine', async () => {
      const r = await post(op, '/api/reports', input({ machineId: await freshMachine() }))
      expect(r.body.shiftTarget).toBe(250)
    })
    it('reports every invalid field with the form messages', async () => {
      const res = await post(op, '/api/reports', input({ producedQuantity: -1, rejectedQuantity: 1.5, reportDate: '2026-02-30', notes: 'x'.repeat(501) }))
      expect(res.status).toBe(400)
      expect(res.body.error.details).toMatchObject({ producedQuantity: 'Cannot be negative', rejectedQuantity: 'Enter a whole number', reportDate: 'Enter a valid date', notes: expect.stringContaining('under 500') })
      const over = await post(op, '/api/reports', input({ rejectedQuantity: 500 }))
      expect(over.body.error.details.rejectedQuantity).toBe('Cannot be more than the produced quantity')
      expect((await post(op, '/api/reports', input({ reportDate: '2999-01-01' }))).body.error.details.reportDate).toBe('Report date cannot be in the future')
      expect((await post(op, '/api/reports', input({ reportDate: '2025-12-31' }))).body.error.details.reportDate).toContain("before the order's planned start")
      expect((await post(op, '/api/reports', input({ producedQuantity: '5' }))).status).toBe(400)
      expect((await post(op, '/api/reports', input({ shift: 'evening' }))).status).toBe(400)
      expect((await post(op, '/api/reports', input({ mode: 'later' }))).status).toBe(400)
    })
    it('refuses unknown order, machine from another line, inactive machine, and orders not In Progress', async () => {
      expect((await post(op, '/api/reports', input({ orderId: 'PO-1999-001' }))).status).toBe(400)
      expect((await post(op, '/api/reports', input({ machineId: 'nope' }))).status).toBe(400)
      await t.db.productionLine.create({ data: { id: 'line-2', name: 'Press Line', code: 'PRS' } })
      await t.db.machine.create({ data: { id: 'mc-press', name: 'Press 1', lineId: 'line-2', shiftTarget: 100 } })
      const other = await post(op, '/api/reports', input({ machineId: 'mc-press' }))
      expect(other.status).toBe(422)
      expect(other.body.error.message).toContain("order's production line")
      const inactive = await freshMachine()
      await t.db.machine.update({ where: { id: inactive }, data: { isActive: false } })
      const res = await post(op, '/api/reports', input({ machineId: inactive }))
      expect(res.status).toBe(422)
      expect(res.body.error.message).toContain('inactive')
      const planned = (await post(sup, '/api/orders', { ...orderInput, status: 'planned' })).body.id
      const notStarted = await post(op, '/api/reports', input({ orderId: planned, machineId: await freshMachine() }))
      expect(notStarted.status).toBe(422)
      expect(notStarted.body.error.message).toContain('In Progress')
    })
    it('allows one report per machine, shift and day', async () => {
      const machineId = await freshMachine()
      expect((await post(op, '/api/reports', input({ machineId }))).status).toBe(201)
      const dup = await post(op2, '/api/reports', input({ machineId }))
      expect(dup.status).toBe(422)
      expect(dup.body.error.message).toContain('already has a report')
      expect((await post(op2, '/api/reports', input({ machineId, shift: 'night' }))).status).toBe(201)
    })
  })

  describe('edit, submit and delete', () => {
    it('saves changes to a draft and writes them to the history', async () => {
      const r = await create()
      const res = await patch(op, `/api/reports/${r.id}`, input({ machineId: (await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })).machineId, producedQuantity: 300, rejectedQuantity: 20, notes: 'Burr on 20' }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body).toMatchObject({ producedQuantity: 300, rejectedQuantity: 20, notes: 'Burr on 20' })
      const h = (await op.get(`/api/reports/${r.id}`)).body.timeline[0]
      expect(h).toMatchObject({ description: 'updated the report', detail: 'Produced: 200 → 300; Rejected: 10 → 20; Notes changed' })
    })
    it('does nothing when nothing changed', async () => {
      const r = await create()
      const row = await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })
      await patch(op, `/api/reports/${r.id}`, input({ machineId: row.machineId }))
      expect((await op.get(`/api/reports/${r.id}`)).body.timeline).toHaveLength(1)
    })
    it('only the operator who filed a report may change, submit or delete it', async () => {
      const r = await create()
      const row = await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })
      expect((await patch(op2, `/api/reports/${r.id}`, input({ machineId: row.machineId, producedQuantity: 1 }))).status).toBe(403)
      expect((await post(op2, `/api/reports/${r.id}/submit`)).status).toBe(403)
      expect((await del(op2, `/api/reports/${r.id}`)).status).toBe(403)
      expect((await op.get(`/api/reports/${r.id}`)).body.report.producedQuantity).toBe(200)
    })
    it('cannot change the order of a report', async () => {
      const r = await create()
      const other = (await post(sup, '/api/orders', { ...orderInput, status: 'planned' })).body.id
      const row = await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })
      const res = await patch(op, `/api/reports/${r.id}`, input({ orderId: other, machineId: row.machineId }))
      expect(res.status).toBe(422)
      expect(res.body.error.message).toContain('cannot be changed')
    })
    it('submit sends a draft to Pending Review and locks it', async () => {
      const r = await create()
      const res = await post(op, `/api/reports/${r.id}/submit`)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('pending_review')
      expect(res.body.submittedAt).toBeTruthy()
      const row = await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })
      expect((await patch(op, `/api/reports/${r.id}`, input({ machineId: row.machineId, producedQuantity: 1 }))).status).toBe(422)
      expect((await post(op, `/api/reports/${r.id}/submit`)).status).toBe(422)
      expect((await del(op, `/api/reports/${r.id}`)).status).toBe(422)
    })
    it('deletes drafts, with their history', async () => {
      const r = await create()
      expect((await del(op, `/api/reports/${r.id}`)).status).toBe(204)
      expect((await op.get(`/api/reports/${r.id}`)).status).toBe(404)
      expect(await t.db.reportHistory.count({ where: { reportId: r.id } })).toBe(0)
    })
    it('404 for a missing report', async () => {
      expect((await op.get('/api/reports/RPT-NOPE')).status).toBe(404)
      expect((await patch(op, '/api/reports/RPT-NOPE', input())).status).toBe(404)
      expect((await del(op, '/api/reports/RPT-NOPE')).status).toBe(404)
    })
  })

  describe('review', () => {
    const submitted = async (over: Body = {}, agent: Agent = op) => create({ mode: 'submit', ...over }, agent)

    it('lists submitted reports only, with downtime minutes', async () => {
      const draft = await create()
      const r = await submitted()
      await t.db.downtimeEvent.create({ data: { id: 'dt-1', lineId: 'line-cut-01', machineId: 'mc-lc-01', orderId, reportId: r.id, startTime: new Date('2026-11-12T01:00:00Z'), endTime: new Date('2026-11-12T01:45:00Z'), category: 'changeover', recordedById: 'user-op' } })
      const list = (await sup.get('/api/approvals')).body as { report: { id: string }; downtimeMinutes: number }[]
      expect(list.find((i) => i.report.id === draft.id)).toBeUndefined()
      expect(list.find((i) => i.report.id === r.id)?.downtimeMinutes).toBe(45)
    })
    it('approve: counts toward order progress, stores the decision and history', async () => {
      const r = await submitted({ producedQuantity: 100, rejectedQuantity: 10 })
      const before = (await sup.get('/api/orders')).body.find((o: { order: { id: string } }) => o.order.id === orderId).progress.approvedGood
      const res = await post(sup, `/api/approvals/${r.id}/approve`)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ status: 'approved', reviewedBy: 'Rosa Villanueva' })
      expect(res.body.reviewedAt).toBeTruthy()
      expect(res.body.returnReason).toBeUndefined()
      const after = (await sup.get('/api/orders')).body.find((o: { order: { id: string } }) => o.order.id === orderId).progress.approvedGood
      expect(after - before).toBe(90)
      expect(await t.db.approval.findMany({ where: { reportId: r.id } })).toMatchObject([{ decision: 'approved', reviewerId: 'user-sup', reason: null }])
      expect((await sup.get(`/api/reports/${r.id}`)).body.timeline[0]).toMatchObject({ actor: 'Rosa Villanueva', description: 'approved the report', detail: 'Approved' })
    })
    it('refuses to approve a draft, or an already approved report', async () => {
      const draft = await create()
      expect((await post(sup, `/api/approvals/${draft.id}/approve`)).status).toBe(422)
      const r = await submitted()
      await post(sup, `/api/approvals/${r.id}/approve`)
      expect((await post(sup, `/api/approvals/${r.id}/approve`)).status).toBe(422)
      expect((await post(sup, `/api/approvals/${r.id}/return`, { reason: 'too late now' })).status).toBe(422)
      expect((await post(sup, '/api/approvals/RPT-NOPE/approve')).status).toBe(404)
    })
    it('never approves inconsistent quantities', async () => {
      const r = await submitted()
      await t.db.$executeRaw`ALTER TABLE production_reports DROP CONSTRAINT IF EXISTS production_reports_quantities_check`
      const constraints = await t.db.$queryRaw<{ conname: string }[]>`SELECT conname FROM pg_constraint WHERE conrelid = 'production_reports'::regclass AND contype = 'c'`
      for (const c of constraints) await t.db.$executeRawUnsafe(`ALTER TABLE production_reports DROP CONSTRAINT "${c.conname}"`)
      await t.db.productionReport.update({ where: { id: r.id }, data: { rejectedQuantity: 999 } })
      const res = await post(sup, `/api/approvals/${r.id}/approve`)
      expect(res.status).toBe(422)
      expect(res.body.error.message).toContain('inconsistent')
    })
    it('return needs a reason, keeps it, and lets the operator correct and resubmit as Revised', async () => {
      const r = await submitted()
      expect((await post(sup, `/api/approvals/${r.id}/return`, { reason: 'no' })).status).toBe(400)
      expect((await post(sup, `/api/approvals/${r.id}/return`, {})).status).toBe(400)
      const ret = await post(sup, `/api/approvals/${r.id}/return`, { reason: '  Count looks wrong  ' })
      expect(ret.body).toMatchObject({ status: 'returned', returnReason: 'Count looks wrong' })
      const row = await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })
      const fixed = await patch(op, `/api/reports/${r.id}`, input({ machineId: row.machineId, producedQuantity: 180, mode: 'submit' }))
      expect(fixed.status, JSON.stringify(fixed.body)).toBe(200)
      expect(fixed.body.status).toBe('revised')
      const hist = (await sup.get(`/api/reports/${r.id}`)).body.timeline.map((e: { description: string }) => e.description)
      expect(hist).toEqual(['resubmitted the corrected report', 'updated the report', 'returned the report for correction', 'submitted the report for review', 'created the report'])
      expect((await post(sup, `/api/approvals/${r.id}/approve`)).body.status).toBe('approved')
    })
    it('reopen: only approved reports, with a reason, back to Returned and out of official progress', async () => {
      const r = await submitted({ producedQuantity: 100, rejectedQuantity: 0 })
      expect((await post(sup, `/api/approvals/${r.id}/reopen`, { reason: 'valid reason' })).status).toBe(422)
      await post(sup, `/api/approvals/${r.id}/approve`)
      const progress = async () => (await sup.get('/api/orders')).body.find((o: { order: { id: string } }) => o.order.id === orderId).progress.approvedGood as number
      const with_ = await progress()
      expect((await post(sup, `/api/approvals/${r.id}/reopen`, { reason: 'x' })).status).toBe(400)
      const res = await post(sup, `/api/approvals/${r.id}/reopen`, { reason: 'Wrong machine counted' })
      expect(res.body).toMatchObject({ status: 'returned', returnReason: 'Wrong machine counted' })
      expect(with_ - (await progress())).toBe(100)
      expect((await t.db.approval.findMany({ where: { reportId: r.id }, orderBy: { decidedAt: 'asc' } })).map((a) => a.decision)).toEqual(['approved', 'reopened'])
    })
    it('a reviewer cannot review a report they filed themselves', async () => {
      const r = await submitted({}, op2)
      await t.db.user.update({ where: { id: 'user-op2' }, data: { role: 'supervisor', tokenVersion: { increment: 1 } } })
      const asSupervisor = await t.login('mark@x.example')
      for (const [path, body] of [['approve', {}], ['return', { reason: 'valid reason' }]] as const) {
        const res = await post(asSupervisor, `/api/approvals/${r.id}/${path}`, body)
        expect(res.status, path).toBe(422)
        expect(res.body.error.message).toContain('another supervisor')
      }
      await t.db.user.update({ where: { id: 'user-op2' }, data: { role: 'operator', tokenVersion: { increment: 1 } } })
      op2 = await t.login('mark@x.example')
    })
    it('two simultaneous decisions: exactly one wins and one decision is stored', async () => {
      const r = await submitted()
      const [a, b] = await Promise.all([post(sup, `/api/approvals/${r.id}/approve`), post(sup, `/api/approvals/${r.id}/return`, { reason: 'valid reason' })])
      expect([a.status, b.status].sort()).toEqual([200, 422])
      expect(await t.db.approval.count({ where: { reportId: r.id } })).toBe(1)
    })
    it('a decision racing an operator edit cannot slip a change past the reviewer', async () => {
      const r = await submitted()
      const row = await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })
      const [edit, approve] = await Promise.all([patch(op, `/api/reports/${r.id}`, input({ machineId: row.machineId, producedQuantity: 1 })), post(sup, `/api/approvals/${r.id}/approve`)])
      // The report was already submitted, so the edit is always refused; the approval stands on the submitted figures.
      expect(edit.status).toBe(422)
      expect(approve.status).toBe(200)
      expect((await t.db.productionReport.findUniqueOrThrow({ where: { id: r.id } })).producedQuantity).toBe(200)
    })
  })

  describe('read models', () => {
    it('reference lists orders (with status and start), lines and machines, and today at the factory', async () => {
      const ref = (await op.get('/api/reports/reference')).body
      expect(ref.today).toBe(today)
      expect(ref.orders.find((o: { id: string }) => o.id === orderId)).toMatchObject({ status: 'in_progress', plannedStart: '2026-01-01', lineName: 'Cutting Line 01', productName: 'Steel mounting brackets' })
      expect(ref.machines[0]).toHaveProperty('shiftTarget')
    })
    it('list and detail carry names, metrics and no secrets', async () => {
      const r = await create({ producedQuantity: 200, rejectedQuantity: 10 })
      const item = (await op.get('/api/reports')).body.find((i: { report: { id: string } }) => i.report.id === r.id)
      expect(item).toMatchObject({ productName: 'Steel mounting brackets', lineName: 'Cutting Line 01', metrics: { goodQuantity: 190, rejectionRate: 5, targetAchievement: 76 } })
      const detail = (await mgr.get(`/api/reports/${r.id}`)).body
      expect(detail).toMatchObject({ orderStatus: 'in_progress', totalDowntimeMinutes: 0 })
      expect(JSON.stringify(detail)).not.toMatch(/passwordHash|tokenVersion|@x\.example/)
    })
  })
})
