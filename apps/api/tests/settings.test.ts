import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORIGIN, PASSWORD, startTestApp, type TestApp } from './helpers'
import { TEST_DATABASE_URL } from './test-db'

describe.skipIf(!TEST_DATABASE_URL)('settings and reference API (needs TEST_DATABASE_URL)', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await startTestApp()
  })
  afterAll(async () => {
    await t.close()
  })

  const post = (agent: Awaited<ReturnType<TestApp['login']>>, url: string, body: object = {}) => agent.post(url).set('Origin', ORIGIN).send(body)
  const patch = (agent: Awaited<ReturnType<TestApp['login']>>, url: string, body: object) => agent.patch(url).set('Origin', ORIGIN).send(body)

  describe('who may call what', () => {
    it('rejects anonymous callers with 401', async () => {
      expect((await t.request().get('/api/settings')).status).toBe(401)
      expect((await t.request().get('/api/reference')).status).toBe(401)
    })

    it('lets every signed-in role read reference data but only administrators read or change settings', async () => {
      for (const email of ['mira@x.example', 'rosa@x.example', 'juan@x.example', 'carlo@x.example']) {
        const agent = await t.login(email)
        const ref = await agent.get('/api/reference')
        expect(ref.status, email).toBe(200)
        expect(ref.body.lines).toHaveLength(1)
        expect(ref.body.machines[0]).toMatchObject({ shiftTarget: 250, isActive: true })
        expect(JSON.stringify(ref.body)).not.toMatch(/passwordHash|@x\.example/)
      }
      for (const email of ['mira@x.example', 'rosa@x.example', 'juan@x.example']) {
        const agent = await t.login(email)
        expect((await agent.get('/api/settings')).status, `${email} GET`).toBe(403)
        expect((await post(agent, '/api/settings/products', { name: 'Hacked product' })).status, `${email} POST`).toBe(403)
        expect((await post(agent, '/api/settings/users/user-op/deactivate')).status, `${email} deactivate`).toBe(403)
        expect((await patch(agent, '/api/settings/machines/mc-lc-01', { name: 'x', shiftTarget: 1 })).status, `${email} PATCH`).toBe(403)
      }
      expect(await t.db.product.count()).toBe(1)
    })

    it('returns the overview to an administrator without secrets', async () => {
      const admin = await t.login('carlo@x.example')
      const res = await admin.get('/api/settings')
      expect(res.status).toBe(200)
      expect(res.body.users).toHaveLength(4)
      expect(res.body.users[0]).toEqual(expect.objectContaining({ id: expect.any(String), email: expect.any(String), role: expect.any(String), isActive: true }))
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt|tokenVersion/)
      expect(res.body.openOrders).toEqual({ byProduct: {}, byLine: {} })
    })
  })

  describe('users', () => {
    it('creates a user with a hashed password who can then sign in, and logs it', async () => {
      const admin = await t.login('carlo@x.example')
      const res = await post(admin, '/api/settings/users', { name: ' Liza  Cruz ', email: 'Liza@x.example', role: 'operator', password: 'Liza-initial-pass-1' })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Liza Cruz', email: 'liza@x.example', role: 'operator', isActive: true })
      const row = await t.db.user.findUniqueOrThrow({ where: { email: 'liza@x.example' } })
      expect(row.passwordHash).not.toContain('Liza-initial-pass-1')
      expect((await t.request().post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'liza@x.example', password: 'Liza-initial-pass-1' })).status).toBe(200)
      const audit = await t.db.auditLog.findFirst({ where: { entityId: row.id, action: 'created' }, include: { actor: true } })
      expect(audit?.actor?.name).toBe('Carlo Reyes')
    })

    it('validates input and refuses duplicates', async () => {
      const admin = await t.login('carlo@x.example')
      const bad = await post(admin, '/api/settings/users', { name: 'A', email: 'nope', role: 'boss', password: 'short' })
      expect(bad.status).toBe(400)
      const dup = await post(admin, '/api/settings/users', { name: 'Other Name', email: 'JUAN@x.example', role: 'operator', password: 'Another-pass-123' })
      expect(dup.status).toBe(422)
      expect(dup.body.error.message).toMatch(/email/i)
      const dupName = await post(admin, '/api/settings/users', { name: 'juan dela cruz', email: 'new@x.example', role: 'operator', password: 'Another-pass-123' })
      expect(dupName.status).toBe(422)
    })

    it('deactivating a user ends their session immediately', async () => {
      const admin = await t.login('carlo@x.example')
      const victim = await t.login('juan@x.example')
      expect((await victim.get('/api/auth/me')).status).toBe(200)
      expect((await post(admin, '/api/settings/users/user-op/deactivate')).status).toBe(200)
      expect((await victim.get('/api/auth/me')).status).toBe(401)
      expect((await t.request().post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'juan@x.example', password: PASSWORD })).status).toBe(401)
      expect((await post(admin, '/api/settings/users/user-op/activate')).status).toBe(200)
      expect((await t.login('juan@x.example')).get).toBeTruthy()
    })

    it('a role change takes effect at once', async () => {
      const admin = await t.login('carlo@x.example')
      const sup = await t.login('rosa@x.example')
      expect((await sup.get('/api/settings')).status).toBe(403)
      const res = await patch(admin, '/api/settings/users/user-sup', { name: 'Rosa Villanueva', email: 'rosa@x.example', role: 'administrator' })
      expect(res.status).toBe(200)
      expect((await sup.get('/api/settings')).status).toBe(401) // old token no longer valid
      const again = await t.login('rosa@x.example')
      expect((await again.get('/api/settings')).status).toBe(200)
      expect((await patch(admin, '/api/settings/users/user-sup', { name: 'Rosa Villanueva', email: 'rosa@x.example', role: 'supervisor' })).status).toBe(200)
    })

    it('protects your own account and the last active administrator', async () => {
      const admin = await t.login('carlo@x.example')
      const self = await post(admin, '/api/settings/users/user-admin/deactivate')
      expect(self.status).toBe(422)
      expect(self.body.error.message).toMatch(/own account/)
      const selfRole = await patch(admin, '/api/settings/users/user-admin', { name: 'Carlo Reyes', email: 'carlo@x.example', role: 'manager' })
      expect(selfRole.status).toBe(422)
      // A second administrator makes the first removable by them, but never the last one.
      await post(admin, '/api/settings/users', { name: 'Second Admin', email: 'second@x.example', role: 'administrator', password: 'Second-admin-pass-1' })
      const second = await t.login('second@x.example', 'Second-admin-pass-1')
      expect((await post(second, '/api/settings/users/user-admin/deactivate')).status).toBe(200)
      const last = await post(second, '/api/settings/users/user-second-admin/deactivate')
      expect(last.status).toBe(422)
      const demote = await patch(second, '/api/settings/users/user-second-admin', { name: 'Second Admin', email: 'second@x.example', role: 'manager' })
      expect(demote.status).toBe(422)
      await t.db.user.update({ where: { id: 'user-admin' }, data: { isActive: true, tokenVersion: { increment: 1 } } })
    })

    it('two simultaneous requests cannot remove both administrators', async () => {
      await t.db.user.update({ where: { id: 'user-second-admin' }, data: { isActive: false, tokenVersion: { increment: 1 } } })
      await t.db.user.create({ data: { id: 'admin-b', name: 'Admin Bee', email: 'bee@x.example', role: 'administrator', passwordHash: (await t.db.user.findUniqueOrThrow({ where: { id: 'user-op' } })).passwordHash } })
      const a = await t.login('carlo@x.example')
      const b = await t.login('bee@x.example')
      const [r1, r2] = await Promise.all([post(a, '/api/settings/users/admin-b/deactivate'), post(b, '/api/settings/users/user-admin/deactivate')])
      expect([r1.status, r2.status].sort()).toEqual([200, 422])
      expect(await t.db.user.count({ where: { role: 'administrator', isActive: true } })).toBe(1)
      await t.db.user.updateMany({ where: { role: 'administrator' }, data: { isActive: true, tokenVersion: { increment: 1 } } })
    })

    it('an administrator can reset a password, which signs the user out', async () => {
      const admin = await t.login('carlo@x.example')
      const mira = await t.login('mira@x.example')
      expect((await post(admin, '/api/settings/users/user-mgr/reset-password', { password: 'short' })).status).toBe(400)
      expect((await post(admin, '/api/settings/users/user-mgr/reset-password', { password: 'Reset-by-admin-77' })).status).toBe(204)
      expect((await mira.get('/api/auth/me')).status).toBe(401)
      expect((await t.request().post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'mira@x.example', password: 'Reset-by-admin-77' })).status).toBe(200)
      expect(await t.db.auditLog.count({ where: { action: 'password_reset' } })).toBe(1)
      await t.db.user.update({ where: { id: 'user-mgr' }, data: { passwordHash: (await t.db.user.findUniqueOrThrow({ where: { id: 'user-op' } })).passwordHash } })
    })
  })

  describe('reference data', () => {
    it('products: create, duplicate, rename, deactivate, and the change log', async () => {
      const admin = await t.login('carlo@x.example')
      const created = await post(admin, '/api/settings/products', { name: ' Steel   plates ' })
      expect(created.status).toBe(201)
      expect(created.body).toMatchObject({ id: 'prod-steel-plates', name: 'Steel plates', isActive: true })
      expect((await post(admin, '/api/settings/products', { name: 'steel plates' })).status).toBe(422)
      expect((await post(admin, '/api/settings/products', { name: 'x' })).status).toBe(400)
      expect((await patch(admin, '/api/settings/products/prod-steel-plates', { name: 'Steel plate' })).body.name).toBe('Steel plate')
      expect((await post(admin, '/api/settings/products/prod-steel-plates/deactivate')).body.isActive).toBe(false)
      expect((await post(admin, '/api/settings/products/missing/deactivate')).status).toBe(404)
      const log = (await admin.get('/api/settings')).body.audit as { actor: string; entity: string; detail: string }[]
      expect(log[0]).toMatchObject({ actor: 'Carlo Reyes', entity: 'product' })
      expect(log.map((l) => l.detail)).toContain('Renamed Steel plates → Steel plate')
    })

    it('a product or line with an open order cannot be deactivated', async () => {
      const admin = await t.login('carlo@x.example')
      await t.db.productionOrder.create({ data: { id: 'PO-T-1', orderNumber: 'PO-T-1', productId: 'prod-bracket', lineId: 'line-cut-01', plannedQuantity: 10, plannedStart: new Date('2026-11-09'), dueDate: new Date('2026-11-20'), status: 'in_progress', createdById: 'user-mgr' } })
      const product = await post(admin, '/api/settings/products/prod-bracket/deactivate')
      expect(product.status).toBe(422)
      expect(product.body.error.message).toMatch(/open order/)
      const line = await post(admin, '/api/settings/lines/line-cut-01/deactivate')
      expect(line.status).toBe(422)
      const overview = await admin.get('/api/settings')
      expect(overview.body.openOrders).toEqual({ byProduct: { 'prod-bracket': 1 }, byLine: { 'line-cut-01': 1 } })
      await t.db.productionOrder.update({ where: { id: 'PO-T-1' }, data: { status: 'completed' } })
      expect((await post(admin, '/api/settings/products/prod-bracket/deactivate')).status).toBe(200)
      await post(admin, '/api/settings/products/prod-bracket/activate')
    })

    it('lines: codes are validated and unique; a line with active machines cannot be deactivated', async () => {
      const admin = await t.login('carlo@x.example')
      expect((await post(admin, '/api/settings/lines', { name: 'Paint Line', code: 'cut' })).status).toBe(400)
      expect((await post(admin, '/api/settings/lines', { name: 'Paint Line', code: 'CUT' })).status).toBe(422)
      const line = await post(admin, '/api/settings/lines', { name: 'Paint Line 01', code: 'PNT' })
      expect(line.status).toBe(201)
      const machine = await post(admin, '/api/settings/machines', { name: 'Paint Booth PB-1', lineId: line.body.id, shiftTarget: 90 })
      expect(machine.status).toBe(201)
      expect((await post(admin, `/api/settings/lines/${line.body.id}/deactivate`)).body.error.message).toMatch(/active machine/)
      await post(admin, `/api/settings/machines/${machine.body.id}/deactivate`)
      expect((await post(admin, `/api/settings/lines/${line.body.id}/deactivate`)).status).toBe(200)
      expect((await post(admin, `/api/settings/machines/${machine.body.id}/activate`)).status).toBe(422)
      expect((await post(admin, '/api/settings/machines', { name: 'Booth 2', lineId: line.body.id, shiftTarget: 90 })).status).toBe(422)
    })

    it('machines: target must be a whole number of at least 1; changes are logged as new-reports-only', async () => {
      const admin = await t.login('carlo@x.example')
      for (const shiftTarget of [0, -5, 2.5, 1_000_000]) expect((await patch(admin, '/api/settings/machines/mc-lc-01', { name: 'Laser Cutter LC-01', shiftTarget })).status, String(shiftTarget)).toBe(400)
      expect((await patch(admin, '/api/settings/machines/mc-lc-01', { name: 'Laser Cutter LC-01', shiftTarget: '300' })).status).toBe(400)
      const ok = await patch(admin, '/api/settings/machines/mc-lc-01', { name: 'Laser Cutter LC-01', shiftTarget: 300 })
      expect(ok.body.shiftTarget).toBe(300)
      expect((await admin.get('/api/settings')).body.audit[0].detail).toContain('new reports only')
    })

    it('defect types: at least one stays active', async () => {
      const admin = await t.login('carlo@x.example')
      expect((await post(admin, '/api/settings/defect-types/defect-a/deactivate')).status).toBe(200)
      const last = await post(admin, '/api/settings/defect-types/defect-b/deactivate')
      expect(last.status).toBe(422)
      expect(last.body.error.message).toMatch(/at least one active defect type/)
    })

    it('shifts: validates times and saves them', async () => {
      const admin = await t.login('carlo@x.example')
      expect((await patch(admin, '/api/settings/shifts/morning', { startTime: '07:00', endTime: '07:00' })).status).toBe(400)
      expect((await patch(admin, '/api/settings/shifts/morning', { startTime: '7am', endTime: '19:00' })).status).toBe(400)
      const ok = await patch(admin, '/api/settings/shifts/morning', { startTime: '07:00', endTime: '19:00' })
      expect(ok.body).toMatchObject({ startTime: '07:00', endTime: '19:00' })
      expect((await patch(admin, '/api/settings/shifts/unknown', { startTime: '07:00', endTime: '19:00' })).status).toBe(404)
    })
  })

  it('refuses writes from a disallowed origin even with a valid session', async () => {
    const admin = await t.login('carlo@x.example')
    const res = await admin.post('/api/settings/products').set('Origin', 'http://evil.example').send({ name: 'CSRF product' })
    expect(res.status).toBe(403)
    expect(await t.db.product.count({ where: { name: 'CSRF product' } })).toBe(0)
  })

  it('never leaks internals on unexpected errors', async () => {
    const admin = await t.login('carlo@x.example')
    const res = await patch(admin, '/api/settings/users/user-op', { name: 123, email: {}, role: [] })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).not.toMatch(/stack|prisma|at \w+ \(/i)
  })
})
