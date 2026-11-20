import supertest from 'supertest'
import { createApp } from '../src/app'
import type { AppDeps } from '../src/middleware/context'
import { loadEnv } from '../src/config/env'
import { createDb, type Db } from '../src/db/client'
import { hashPassword } from '../src/lib/password'
import { resetTestDatabase, TEST_DATABASE_URL } from './test-db'

export const PASSWORD = 'Test-password-2026'
export const ORIGIN = 'http://localhost:5173'

export interface TestApp {
  db: Db
  request: () => ReturnType<typeof supertest>
  /** An agent that keeps the session cookie after signing in. */
  login: (email: string, password?: string) => Promise<ReturnType<typeof supertest.agent>>
  close: () => Promise<void>
}

const USERS = [
  { id: 'user-admin', name: 'Carlo Reyes', email: 'carlo@x.example', role: 'administrator' },
  { id: 'user-mgr', name: 'Mira Santos', email: 'mira@x.example', role: 'manager' },
  { id: 'user-sup', name: 'Rosa Villanueva', email: 'rosa@x.example', role: 'supervisor' },
  { id: 'user-op', name: 'Juan Dela Cruz', email: 'juan@x.example', role: 'operator' },
] as const

export async function startTestApp(extra: Partial<Pick<AppDeps, 'narrative'>> = {}): Promise<TestApp> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set')
  await resetTestDatabase(TEST_DATABASE_URL)
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL, JWT_SECRET: 'integration-test-secret-0123456789abcdef', ALLOWED_ORIGINS: ORIGIN })
  const db = createDb(TEST_DATABASE_URL)
  const passwordHash = await hashPassword(PASSWORD)
  for (const u of USERS) await db.user.create({ data: { ...u, passwordHash } })
  await db.productionLine.create({ data: { id: 'line-cut-01', name: 'Cutting Line 01', code: 'CUT' } })
  await db.machine.create({ data: { id: 'mc-lc-01', name: 'Laser Cutter LC-01', lineId: 'line-cut-01', shiftTarget: 250 } })
  await db.product.create({ data: { id: 'prod-bracket', name: 'Steel mounting brackets' } })
  await db.defectType.createMany({ data: [{ id: 'defect-a', name: 'Burr' }, { id: 'defect-b', name: 'Other' }] })
  await db.shift.create({ data: { id: 'morning', name: 'Morning', startTime: '06:00', endTime: '18:00' } })
  const app = createApp({ db, env, ...extra })
  return {
    db,
    request: () => supertest(app),
    login: async (email, password = PASSWORD) => {
      const agent = supertest.agent(app)
      const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email, password })
      if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`)
      return agent
    },
    close: () => db.$disconnect(),
  }
}
