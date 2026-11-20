import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env'
import { NarrativeError, createNarrativeClient } from '../src/modules/insights/narrative-client'
import { factoryToday } from '../src/modules/orders/orders.service'
import { ORIGIN, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'

type Agent = Awaited<ReturnType<TestApp['login']>>

describe('narrative client (no network)', () => {
  const env = (over: Record<string, string> = {}) => loadEnv({ NODE_ENV: 'test', DATABASE_URL: 'x', JWT_SECRET: 'a'.repeat(32), ...over })
  const ok = (content: unknown) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

  it('is off without a key', () => {
    expect(createNarrativeClient(env())).toBeNull()
    expect(createNarrativeClient(env({ AI_API_KEY: '   ' }))).toBeNull()
  })
  it('defaults to Groq and sends the key, model and prompt', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const client = createNarrativeClient(env({ AI_API_KEY: 'k-secret' }), (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return ok('  Fine.  ')
    }) as unknown as typeof fetch)!
    expect(await client('SYS', 'USER')).toBe('Fine.')
    expect(seen?.url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((seen?.init.headers as Record<string, string>).Authorization).toBe('Bearer k-secret')
    const body = JSON.parse(String(seen?.init.body)) as { model: string; messages: { role: string; content: string }[] }
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.messages).toEqual([{ role: 'system', content: 'SYS' }, { role: 'user', content: 'USER' }])
  })
  it('classifies failures without leaking the key or the provider body', async () => {
    const make = (impl: () => Promise<Response>) => createNarrativeClient(env({ AI_API_KEY: 'k-secret' }), impl as unknown as typeof fetch)!
    const status = await make(async () => new Response('secret-detail k-secret', { status: 401 }))('s', 'u').catch((e: unknown) => e)
    expect(status).toBeInstanceOf(NarrativeError)
    expect((status as NarrativeError).reason).toBe('error')
    expect((status as NarrativeError).message).toContain('401')
    expect((status as NarrativeError).message).not.toContain('k-secret')
    const net = await make(async () => { throw new TypeError('fetch failed k-secret') })('s', 'u').catch((e: unknown) => e)
    expect((net as NarrativeError).reason).toBe('unreachable')
    expect((net as NarrativeError).message).not.toContain('k-secret')
    const slow = await make(async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }) })('s', 'u').catch((e: unknown) => e)
    expect((slow as NarrativeError).message).toContain('too long')
    for (const bad of [ok(''), ok(42), new Response('not json', { status: 200 })]) {
      const r = await make(async () => bad)('s', 'u').catch((e: unknown) => e)
      expect((r as NarrativeError).reason).toBe('error')
    }
  })
})

describe.skipIf(!TEST_DATABASE_URL)('insights API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  let sup: Agent
  let op: Agent
  let mgr: Agent
  let admin: Agent
  let reply: (system: string, user: string) => Promise<string> = async () => ''
  const today = factoryToday()
  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body)
  const range = { from: today, to: today }
  const q = `from=${today}&to=${today}`
  let userSeen = ''
  let systemSeen = ''

  beforeAll(async () => {
    t = await startTestApp({ narrative: async (s, u) => { systemSeen = s; userSeen = u; return reply(s, u) } })
    sup = await t.login('rosa@x.example')
    op = await t.login('juan@x.example')
    mgr = await t.login('mira@x.example')
    admin = await t.login('carlo@x.example')
    const o = await post(sup, '/api/orders', { productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 5000, plannedStart: '2026-01-01', dueDate: '2026-12-31', priority: 'normal', instructions: '', status: 'planned' })
    await post(sup, `/api/orders/${o.body.id}/status`, { to: 'in_progress' })
    const r = await post(op, '/api/reports', { orderId: o.body.id, machineId: 'mc-lc-01', shift: 'morning', reportDate: today, producedQuantity: 200, rejectedQuantity: 20, notes: '', mode: 'submit' })
    expect(r.status, JSON.stringify(r.body)).toBe(201)
    expect((await post(sup, `/api/approvals/${r.body.id}/approve`)).status).toBe(200)
  })
  afterAll(async () => {
    await t.close()
  })

  it('401 anonymous; manager and supervisor allowed; administrator and operator refused', async () => {
    expect((await t.request().get(`/api/insights?${q}`)).status).toBe(401)
    expect((await t.request().post('/api/insights/narrative').set('Origin', ORIGIN).send(range)).status).toBe(401)
    for (const [a, s] of [[mgr, 200], [sup, 200], [admin, 403], [op, 403]] as const) {
      expect((await a.get(`/api/insights?${q}`)).status).toBe(s)
      expect((await post(a, '/api/insights/narrative', range)).status).toBe(s)
    }
  })

  it('returns explainable trends and a flag with evidence from the database', async () => {
    const res = await mgr.get(`/api/insights?${q}`)
    expect(res.body.aiConfigured).toBe(true)
    expect(res.body.hasEnoughData).toBe(false) // one approved report is below the minimum of 3
    expect(res.body.trends).toHaveLength(4)
    expect(res.body.trends[0].direction).toBe('unknown')
    const flag = res.body.flags.find((f: { rule: string }) => f.rule === 'high_rejection')
    expect(flag).toMatchObject({ severity: 'critical', subject: 'Cutting Line 01' })
    expect(flag.evidence).toContainEqual({ label: 'Rejection rate', value: '10.0%' })
    expect(flag.why).toContain('5.0%')
    expect(res.body.previousRange.to < today).toBe(true)
  })

  it('rejects bad ranges', async () => {
    expect((await mgr.get('/api/insights?from=2026-13-01&to=2026-13-02')).status).toBe(400)
    expect((await mgr.get('/api/insights')).status).toBe(400)
    expect((await post(mgr, '/api/insights/narrative', { from: 'nope', to: 'nope' })).status).toBe(400)
  })

  it('narrative: ok when the text only uses verified figures; prompt carries facts, no personal names', async () => {
    reply = async (_s, u) => {
      const facts = JSON.parse(u) as { figures: Record<string, string> }
      return `The rejection rate was ${facts.figures['Rejection rate']} and good output was ${facts.figures['Good output']}.`
    }
    const res = await mgr.post('/api/insights/narrative').set('Origin', ORIGIN).send(range)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', text: 'The rejection rate was 10.0% and good output was 180.', model: 'llama-3.3-70b-versatile' })
    expect(res.body.notice).toContain('official numbers')
    expect(systemSeen).toContain('ONLY')
    expect(userSeen).not.toMatch(/Juan|Rosa|Mira/)
    expect(userSeen).toContain('Cutting Line 01')
  })

  it('narrative: withheld when the AI invents a figure', async () => {
    reply = async () => 'Rejections reached 42.5% this week.'
    const res = await post(mgr, '/api/insights/narrative', range)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('unverified')
    expect(res.body.text).toBeUndefined()
  })

  it('narrative: an unreachable or failing AI service degrades to "unavailable" with HTTP 200', async () => {
    reply = async () => { throw new NarrativeError('unreachable', 'The AI service could not be reached.') }
    const a = await post(mgr, '/api/insights/narrative', range)
    expect(a.status).toBe(200)
    expect(a.body).toMatchObject({ status: 'unavailable', reason: 'unreachable' })
    reply = async () => { throw new Error('boom internal detail') }
    const b = await post(mgr, '/api/insights/narrative', range)
    expect(b.body).toMatchObject({ status: 'unavailable', reason: 'error' })
    expect(JSON.stringify(b.body)).not.toContain('boom')
    // the rest of the app is unaffected
    expect((await mgr.get(`/api/insights?${q}`)).status).toBe(200)
    expect((await mgr.get(`/api/dashboard?${q}`)).status).toBe(200)
  })
})

describe.skipIf(!TEST_DATABASE_URL)('insights API without an AI key (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await startTestApp({ narrative: null })
  })
  afterAll(async () => {
    await t.close()
  })
  it('reports not configured and still serves trends and flags', async () => {
    const mgr = await t.login('mira@x.example')
    const today = factoryToday()
    expect((await mgr.get(`/api/insights?from=${today}&to=${today}`)).body.aiConfigured).toBe(false)
    const res = await mgr.post('/api/insights/narrative').set('Origin', ORIGIN).send({ from: today, to: today })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'unavailable', reason: 'not_configured' })
  })
})
