import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const valid = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_SECRET: 'x'.repeat(32) }

describe('environment', () => {
  it('applies safe defaults', () => {
    const env = loadEnv(valid)
    expect(env).toMatchObject({ PORT: 4000, NODE_ENV: 'development', SESSION_HOURS: 10, COOKIE_SECURE: false })
    expect(env.ALLOWED_ORIGINS).toEqual(['http://localhost:5173'])
  })
  it('parses origins and booleans', () => {
    const env = loadEnv({ ...valid, ALLOWED_ORIGINS: 'http://a.lan, http://b.lan ', COOKIE_SECURE: 'true', PORT: '8080' })
    expect(env.ALLOWED_ORIGINS).toEqual(['http://a.lan', 'http://b.lan'])
    expect(env.COOKIE_SECURE).toBe(true)
    expect(env.PORT).toBe(8080)
  })
  it('fails fast and names every problem, including a short secret', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL.*\n.*JWT_SECRET/s)
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(/at least 32/)
    expect(() => loadEnv({ ...valid, PORT: '99999' })).toThrow(/PORT/)
  })
})
