import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORIGIN, PASSWORD, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'

describe.skipIf(!TEST_DATABASE_URL)('auth API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await startTestApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('reports health with a database check', async () => {
    const res = await t.request().get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('signs in, sets an httpOnly SameSite cookie, and never returns the password hash', async () => {
    const res = await t.request().post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'RosA@x.example ', password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({ id: 'user-sup', name: 'Rosa Villanueva', email: 'rosa@x.example', role: 'supervisor' })
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash/)
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/shopfloor_session=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('gives the same answer for a wrong password, an unknown email and an inactive user', async () => {
    await t.db.user.create({ data: { id: 'user-off', name: 'Off User', email: 'off@x.example', role: 'operator', isActive: false, passwordHash: (await t.db.user.findUniqueOrThrow({ where: { id: 'user-op' } })).passwordHash } })
    const bodies = []
    for (const body of [{ email: 'juan@x.example', password: 'wrong-password-1' }, { email: 'nobody@x.example', password: PASSWORD }, { email: 'off@x.example', password: PASSWORD }]) {
      const res = await t.request().post('/api/auth/login').set('Origin', ORIGIN).send(body)
      expect(res.status).toBe(401)
      bodies.push(res.body)
    }
    expect(bodies[0]).toEqual(bodies[1])
    expect(bodies[1]).toEqual(bodies[2])
    expect(bodies[0].error.message).toBe('Incorrect email or password.')
  })

  it('validates the login body', async () => {
    const res = await t.request().post('/api/auth/login').set('Origin', ORIGIN).send({ email: '', password: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.details).toMatchObject({ email: expect.any(String), password: expect.any(String) })
    const bad = await t.request().post('/api/auth/login').set('Origin', ORIGIN).set('Content-Type', 'application/json').send('{not json')
    expect(bad.status).toBe(400)
  })

  it('/me needs a session; logout ends it', async () => {
    expect((await t.request().get('/api/auth/me')).status).toBe(401)
    const agent = await t.login('juan@x.example')
    const me = await agent.get('/api/auth/me')
    expect(me.body.user).toMatchObject({ role: 'operator', name: 'Juan Dela Cruz' })
    expect((await agent.post('/api/auth/logout').set('Origin', ORIGIN)).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('refuses a forged or tampered cookie', async () => {
    const res = await t.request().get('/api/auth/me').set('Cookie', 'shopfloor_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLWFkbWluIiwidHYiOjB9.')
    expect(res.status).toBe(401)
  })

  it('changing your password needs the current one, enforces the policy, and ends other sessions', async () => {
    const a = await t.login('mira@x.example')
    const b = await t.login('mira@x.example')
    const wrong = await a.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: 'nope-nope-nope', newPassword: 'A brand new password 1' })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.details.currentPassword).toBeTruthy()
    const weak = await a.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: PASSWORD, newPassword: 'short' })
    expect(weak.body.error.details.newPassword).toMatch(/at least 10/)
    const ok = await a.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: PASSWORD, newPassword: 'A brand new password 1' })
    expect(ok.status).toBe(204)
    expect((await a.get('/api/auth/me')).status).toBe(200) // this session got a fresh token
    expect((await b.get('/api/auth/me')).status).toBe(401) // the other one ended
    expect((await t.request().post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'mira@x.example', password: PASSWORD })).status).toBe(401)
    const audit = await t.db.auditLog.findFirst({ where: { action: 'password_changed' } })
    expect(audit?.detail).toContain('Mira Santos')
    await t.db.user.update({ where: { id: 'user-mgr' }, data: { passwordHash: (await t.db.user.findUniqueOrThrow({ where: { id: 'user-op' } })).passwordHash, tokenVersion: 0 } })
  })

  it('blocks state-changing requests from an origin that is not allowed', async () => {
    const res = await t.request().post('/api/auth/login').set('Origin', 'http://evil.example').send({ email: 'juan@x.example', password: PASSWORD })
    expect(res.status).toBe(403)
  })

  it('answers unknown endpoints with a JSON 404', async () => {
    const res = await t.request().get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
