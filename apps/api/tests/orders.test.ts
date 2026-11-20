import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { factoryToday } from '../src/modules/orders/orders.service'
import { ORIGIN, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'

type Agent = Awaited<ReturnType<TestApp['login']>>

describe.skipIf(!TEST_DATABASE_URL)('orders API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  let sup: Agent
  const year = Number(factoryToday().slice(0, 4))
  const input = { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 500, plannedStart: '2026-11-10', dueDate: '2026-11-20', priority: 'normal', instructions: 'Deburr edges' }

  beforeAll(async () => {
    t = await startTestApp()
    sup = await t.login('rosa@x.example')
  })
  afterAll(async () => {
    await t.close()
  })

  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body)
  const patch = (a: Agent, url: string, body: object) => a.patch(url).set('Origin', ORIGIN).send(body)
  const create = async (over: object = {}, status = 'draft') => {
    const res = await post(sup, '/api/orders', { ...input, status, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as { id: string; status: string }
  }

  describe('who may call what', () => {
    it('401 when anonymous', async () => {
      expect((await t.request().get('/api/orders')).status).toBe(401)
    })
    it('managers, supervisors and operators read; administrators do not', async () => {
      for (const [email, status] of [['mira@x.example', 200], ['rosa@x.example', 200], ['juan@x.example', 200], ['carlo@x.example', 403]] as const) {
        expect((await (await t.login(email)).get('/api/orders')).status, email).toBe(status)
      }
    })
    it('only supervisors write', async () => {
      const order = await create()
      for (const email of ['mira@x.example', 'juan@x.example', 'carlo@x.example']) {
        const a = await t.login(email)
        expect((await post(a, '/api/orders', { ...input, status: 'draft' })).status, email).toBe(403)
        expect((await patch(a, `/api/orders/${order.id}`, input)).status, email).toBe(403)
        expect((await post(a, `/api/orders/${order.id}/status`, { to: 'planned' })).status, email).toBe(403)
      }
    })
    it('rejects writes from an unlisted origin', async () => {
      const res = await sup.post('/api/orders').set('Origin', 'http://evil.example').send({ ...input, status: 'draft' })
      expect(res.status).toBe(403)
    })
  })

  describe('create', () => {
    it('numbers orders PO-<year>-NNN upward and writes a history entry', async () => {
      const a = await create()
      const b = await create({}, 'planned')
      expect(a.id).toMatch(new RegExp(`^PO-${year}-\\d{3}$`))
      expect(Number(b.id.slice(-3))).toBe(Number(a.id.slice(-3)) + 1)
      expect(b.status).toBe('planned')
      const detail = (await sup.get(`/api/orders/${a.id}`)).body
      expect(detail.timeline[0]).toMatchObject({ actor: 'Rosa Villanueva', description: 'created the order', detail: 'Order created as Draft' })
      expect(detail.order).toMatchObject({ plannedStart: '2026-11-10', dueDate: '2026-11-20', createdBy: 'Rosa Villanueva' })
    })
    it('never hands out the same number to simultaneous requests', async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => post(sup, '/api/orders', { ...input, status: 'draft' })))
      expect(results.every((r) => r.status === 201)).toBe(true)
      const ids = results.map((r) => r.body.id as string)
      expect(new Set(ids).size).toBe(6)
    })
    it('reports every invalid field with the form messages', async () => {
      const res = await post(sup, '/api/orders', { ...input, status: 'draft', plannedQuantity: 0, dueDate: '2026-11-01', plannedStart: '2026-02-30', instructions: 'x'.repeat(1001) })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION')
      expect(res.body.error.details).toMatchObject({ plannedQuantity: 'Must be at least 1', plannedStart: 'Enter a valid date', instructions: expect.stringContaining('under 1000') })
      const order = await post(sup, '/api/orders', { ...input, status: 'draft', dueDate: '2026-11-01' })
      expect(order.body.error.details.dueDate).toBe('Due date cannot be before the planned start date')
    })
    it('rejects non-integer, wrong-type and unknown-status input', async () => {
      expect((await post(sup, '/api/orders', { ...input, status: 'draft', plannedQuantity: 10.5 })).status).toBe(400)
      expect((await post(sup, '/api/orders', { ...input, status: 'draft', plannedQuantity: '10' })).status).toBe(400)
      expect((await post(sup, '/api/orders', { ...input, status: 'completed' })).status).toBe(400)
      expect((await post(sup, '/api/orders', { ...input, status: 'draft', priority: 'asap' })).status).toBe(400)
    })
    it('refuses unknown or inactive product and line', async () => {
      expect((await post(sup, '/api/orders', { ...input, status: 'draft', productId: 'nope' })).status).toBe(400)
      await t.db.product.update({ where: { id: 'prod-bracket' }, data: { isActive: false } })
      const res = await post(sup, '/api/orders', { ...input, status: 'draft' })
      expect(res.status).toBe(422)
      expect(res.body.error.message).toContain('inactive')
      await t.db.product.update({ where: { id: 'prod-bracket' }, data: { isActive: true } })
    })
  })

  describe('edit', () => {
    it('saves changes and describes them in the history', async () => {
      const o = await create()
      const res = await patch(sup, `/api/orders/${o.id}`, { ...input, plannedQuantity: 800, priority: 'high' })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ plannedQuantity: 800, priority: 'high' })
      const h = (await sup.get(`/api/orders/${o.id}`)).body.timeline[0]
      expect(h).toMatchObject({ description: 'updated the order', detail: 'Planned quantity: 500 → 800; Priority: normal → high' })
    })
    it('does nothing (and logs nothing) when nothing changed', async () => {
      const o = await create()
      await patch(sup, `/api/orders/${o.id}`, input)
      expect((await sup.get(`/api/orders/${o.id}`)).body.timeline).toHaveLength(1)
    })
    it('404 for a missing order', async () => {
      expect((await patch(sup, '/api/orders/PO-1999-001', input)).status).toBe(404)
    })
    it('locks product and line once in progress, and freezes completed orders', async () => {
      await t.db.productionLine.create({ data: { id: 'line-2', name: 'Press Line', code: 'PRS' } })
      const o = await create({}, 'planned')
      await post(sup, `/api/orders/${o.id}/status`, { to: 'in_progress' })
      const moved = await patch(sup, `/api/orders/${o.id}`, { ...input, lineId: 'line-2' })
      expect(moved.status).toBe(422)
      expect(moved.body.error.message).toContain('cannot be changed once production has started')
      expect((await patch(sup, `/api/orders/${o.id}`, { ...input, plannedQuantity: 600 })).status).toBe(200)
      await post(sup, `/api/orders/${o.id}/status`, { to: 'completed' })
      const frozen = await patch(sup, `/api/orders/${o.id}`, { ...input, plannedQuantity: 700 })
      expect(frozen.status).toBe(422)
      expect(frozen.body.error.message).toContain('Completed orders cannot be edited')
    })
    it('will not drop planned quantity below what is already reported', async () => {
      const o = await create({}, 'planned')
      await post(sup, `/api/orders/${o.id}/status`, { to: 'in_progress' })
      await t.db.productionReport.create({
        data: { id: 'RPT-T-1', orderId: o.id, lineId: 'line-cut-01', machineId: 'mc-lc-01', shiftId: 'morning', reportDate: new Date('2026-11-11T00:00:00Z'), operatorId: 'user-op', shiftTarget: 250, producedQuantity: 300, rejectedQuantity: 10, status: 'approved' },
      })
      const low = await patch(sup, `/api/orders/${o.id}`, { ...input, plannedQuantity: 200 })
      expect(low.status).toBe(400)
      expect(low.body.error.details.plannedQuantity).toBe('Cannot be less than the 300 units already reported')
      expect((await patch(sup, `/api/orders/${o.id}`, { ...input, plannedQuantity: 300 })).status).toBe(200)
    })
  })

  describe('status changes', () => {
    it('follows Draft → Planned → In Progress → Completed and logs each step', async () => {
      const o = await create()
      for (const to of ['planned', 'in_progress', 'completed']) {
        const res = await post(sup, `/api/orders/${o.id}/status`, { to })
        expect(res.status, to).toBe(200)
        expect(res.body.status).toBe(to)
      }
      const details = (await sup.get(`/api/orders/${o.id}`)).body.timeline.map((e: { detail: string }) => e.detail)
      expect(details).toContain('Status: In Progress → Completed')
    })
    it('refuses skipping steps and leaving final states', async () => {
      const o = await create()
      expect((await post(sup, `/api/orders/${o.id}/status`, { to: 'completed' })).status).toBe(422)
      await post(sup, `/api/orders/${o.id}/status`, { to: 'cancelled', reason: 'Customer withdrew' })
      expect((await post(sup, `/api/orders/${o.id}/status`, { to: 'planned' })).status).toBe(422)
    })
    it('requires a cancellation reason and stores it', async () => {
      const o = await create()
      const noReason = await post(sup, `/api/orders/${o.id}/status`, { to: 'cancelled', reason: ' x ' })
      expect(noReason.status).toBe(400)
      const ok = await post(sup, `/api/orders/${o.id}/status`, { to: 'cancelled', reason: 'Customer withdrew' })
      expect(ok.body).toMatchObject({ status: 'cancelled', cancelReason: 'Customer withdrew' })
    })
    it('two simultaneous status changes: exactly one wins', async () => {
      const o = await create({}, 'planned')
      const [a, b] = await Promise.all([post(sup, `/api/orders/${o.id}/status`, { to: 'in_progress' }), post(sup, `/api/orders/${o.id}/status`, { to: 'in_progress' })])
      expect([a.status, b.status].sort()).toEqual([200, 422])
    })
  })

  describe('read models', () => {
    it('lists orders with names, overdue flag and progress from approved reports only', async () => {
      const o = await create({ plannedStart: '2020-01-01', dueDate: '2020-01-31', plannedQuantity: 400 }, 'planned')
      await t.db.productionReport.create({
        data: { id: 'RPT-T-2', orderId: o.id, lineId: 'line-cut-01', machineId: 'mc-lc-01', shiftId: 'morning', reportDate: new Date('2026-11-12T00:00:00Z'), operatorId: 'user-op', shiftTarget: 250, producedQuantity: 100, rejectedQuantity: 20, status: 'approved' },
      })
      await t.db.productionReport.create({
        data: { id: 'RPT-T-3', orderId: o.id, lineId: 'line-cut-01', machineId: 'mc-lc-01', shiftId: 'morning', reportDate: new Date('2026-11-13T00:00:00Z'), operatorId: 'user-op', shiftTarget: 250, producedQuantity: 90, rejectedQuantity: 0, status: 'pending_review' },
      })
      const list = (await (await t.login('juan@x.example')).get('/api/orders')).body as { order: { id: string }; productName: string; lineName: string; overdue: boolean; progress: Record<string, number | null> }[]
      const row = list.find((r) => r.order.id === o.id)
      expect(row).toMatchObject({ productName: 'Steel mounting brackets', lineName: 'Cutting Line 01', overdue: true })
      expect(row?.progress).toMatchObject({ approvedGood: 80, pendingGood: 90, committedProduced: 190, percent: 20 })
      const detail = (await sup.get(`/api/orders/${o.id}`)).body
      expect(detail.reports).toHaveLength(2)
      expect(detail.reports[0]).toMatchObject({ machineName: 'Laser Cutter LC-01', operatorName: 'Juan Dela Cruz' })
    })
    it('404 for a missing order and no sensitive fields in responses', async () => {
      expect((await sup.get('/api/orders/PO-1999-001')).status).toBe(404)
      const o = await create()
      expect(JSON.stringify((await sup.get(`/api/orders/${o.id}`)).body)).not.toMatch(/passwordHash|tokenVersion|@x\.example/)
    })
  })
})
