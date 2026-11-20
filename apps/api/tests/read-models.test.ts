import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addDays } from '@shopfloor/shared'
import { factoryToday } from '../src/modules/orders/orders.service'
import { ORIGIN, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'

type Agent = Awaited<ReturnType<TestApp['login']>>

describe.skipIf(!TEST_DATABASE_URL)('dashboard, analytics and summary API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  let sup: Agent
  let op: Agent
  let mgr: Agent
  let admin: Agent
  let orderId: string
  const today = factoryToday()
  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body)
  const q = `from=${today}&to=${today}`

  let slot = 0
  const report = async (produced: number, rejected: number, submit: boolean) => {
    slot += 1
    const machineId = `mc-rm-${slot}`
    await t.db.machine.create({ data: { id: machineId, name: `RM Machine ${slot}`, lineId: 'line-cut-01', shiftTarget: 250 } })
    const res = await post(op, '/api/reports', { orderId, machineId, shift: 'morning', reportDate: today, producedQuantity: produced, rejectedQuantity: rejected, notes: '', mode: submit ? 'submit' : 'draft' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return { id: res.body.id as string, machineId }
  }

  beforeAll(async () => {
    t = await startTestApp()
    sup = await t.login('rosa@x.example')
    op = await t.login('juan@x.example')
    mgr = await t.login('mira@x.example')
    admin = await t.login('carlo@x.example')
    const o = await post(sup, '/api/orders', { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 5000, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '', status: 'planned' })
    orderId = o.body.id
    await post(sup, `/api/orders/${orderId}/status`, { to: 'in_progress' })

    const approved = await report(200, 10, true)
    await report(100, 5, true) // stays pending review
    await report(80, 0, false) // draft, never counted
    expect((await post(sup, `/api/approvals/${approved.id}/approve`)).status).toBe(200)
    expect((await post(op, '/api/downtime', { machineId: approved.machineId, orderId: '', reportId: '', startTime: `${today}T08:00`, endTime: `${today}T09:00`, category: 'changeover', notes: 'Die change' })).status).toBe(201)
  })
  afterAll(async () => {
    await t.close()
  })

  it('401 when anonymous', async () => {
    for (const url of [`/api/dashboard?${q}`, `/api/analytics?${q}`, `/api/report-summary?kind=daily&date=${today}`]) expect((await t.request().get(url)).status, url).toBe(401)
  })

  it('role access: dashboard admin/manager/supervisor, analytics manager, summary manager/supervisor', async () => {
    const dash = [[admin, 200], [mgr, 200], [sup, 200], [op, 403]] as const
    for (const [a, s] of dash) expect((await a.get(`/api/dashboard?${q}`)).status).toBe(s)
    for (const [a, s] of [[mgr, 200], [sup, 403], [admin, 403], [op, 403]] as const) expect((await a.get(`/api/analytics?${q}`)).status).toBe(s)
    for (const [a, s] of [[mgr, 200], [sup, 200], [admin, 403], [op, 403]] as const) expect((await a.get(`/api/report-summary?kind=daily&date=${today}`)).status).toBe(s)
  })

  it('dashboard counts approved reports only and shows the whole review queue', async () => {
    const res = await mgr.get(`/api/dashboard?${q}`)
    expect(res.body.approvedReportCount).toBe(1)
    expect(res.body.kpis.producedQuantity).toBe(200)
    expect(res.body.kpis.goodQuantity).toBe(190)
    expect(res.body.kpis.rejectedQuantity).toBe(10)
    expect(res.body.kpis.plannedQuantity).toBe(250)
    expect(res.body.kpis.downtimeMinutes).toBe(60)
    expect(res.body.kpis.pendingApprovals).toBe(1)
    expect(res.body.pendingApprovals).toHaveLength(1)
    expect(res.body.pendingApprovals[0].operatorName).toBe('Juan Dela Cruz')
  })

  it('pending queue includes reports dated outside the range', async () => {
    const yesterday = addDays(today, -1)
    const res = await mgr.get(`/api/dashboard?from=${yesterday}&to=${yesterday}`)
    expect(res.body.approvedReportCount).toBe(0)
    expect(res.body.kpis.pendingApprovals).toBe(1)
  })

  it('activity feed is derived from report history and downtime', async () => {
    const res = await mgr.get(`/api/dashboard?${q}`)
    const kinds = (res.body.recentActivity as { kind: string }[]).map((a) => a.kind)
    expect(kinds).toEqual(expect.arrayContaining(['report_submitted', 'report_approved', 'downtime_recorded']))
    expect(res.body.recentActivity.length).toBeLessThanOrEqual(8)
  })

  it('analytics uses the same definitions and breaks down by machine', async () => {
    const res = await mgr.get(`/api/analytics?${q}`)
    const dash = (await mgr.get(`/api/dashboard?${q}`)).body
    expect(res.body.totals.producedQuantity).toBe(dash.kpis.producedQuantity)
    expect(res.body.totals.downtimeMinutes).toBe(dash.kpis.downtimeMinutes)
    expect(res.body.breakdowns.machine.length).toBeGreaterThan(0)
    expect(res.body.breakdowns.shift[0].downtimeMinutes).toBeNull()
  })

  it('summary: daily and weekly, excluded counts, generated by the signed-in user', async () => {
    const d = await mgr.get(`/api/report-summary?kind=daily&date=${today}`)
    expect(d.body.kind).toBe('daily')
    expect(d.body.inProgress).toBe(true)
    expect(d.body.excluded).toEqual({ awaitingReview: 1, returned: 0, draft: 1 })
    expect(d.body.meta.generatedBy).toBe('Mira Santos')
    expect(d.body.meta.today).toBe(today)
    const w = await sup.get(`/api/report-summary?kind=weekly&date=${today}`)
    expect(w.body.range.to > w.body.range.from).toBe(true)
    expect(w.body.kpis.producedQuantity).toBe(200)
  })

  it('rejects bad ranges and dates with 400', async () => {
    for (const url of [
      '/api/dashboard?from=2026-13-01&to=2026-13-02',
      `/api/dashboard?from=${today}&to=${addDays(today, -1)}`,
      `/api/analytics?from=${addDays(today, -400)}&to=${today}`,
      '/api/dashboard',
      '/api/report-summary?kind=monthly&date=2026-01-01',
      '/api/report-summary?kind=daily&date=nope',
    ]) expect((await mgr.get(url)).status, url).toBe(400)
  })
})
