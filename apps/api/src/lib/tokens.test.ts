import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from './tokens'

const SECRET = 'a-secret-that-is-at-least-32-characters-long'

describe('session tokens', () => {
  it('round-trips the user id and token version', () => {
    const token = signSession({ userId: 'user-1', tokenVersion: 3 }, SECRET, 1)
    expect(verifySession(token, SECRET)).toEqual({ userId: 'user-1', tokenVersion: 3 })
  })
  it('rejects a wrong secret, tampering and garbage', () => {
    const token = signSession({ userId: 'user-1', tokenVersion: 0 }, SECRET, 1)
    expect(verifySession(token, 'another-secret-that-is-also-32-chars-long!')).toBeNull()
    expect(verifySession(`${token}x`, SECRET)).toBeNull()
    expect(verifySession('not-a-token', SECRET)).toBeNull()
  })
  it('rejects expired tokens and tokens signed with another algorithm', () => {
    const expired = jwt.sign({ tv: 0 }, SECRET, { algorithm: 'HS256', subject: 'u', expiresIn: -10 })
    expect(verifySession(expired, SECRET)).toBeNull()
    const hs512 = jwt.sign({ tv: 0 }, SECRET, { algorithm: 'HS512', subject: 'u' })
    expect(verifySession(hs512, SECRET)).toBeNull()
    const none = jwt.sign({ tv: 0, sub: 'u' }, '', { algorithm: 'none' })
    expect(verifySession(none, SECRET)).toBeNull()
  })
  it('rejects tokens without the expected claims', () => {
    expect(verifySession(jwt.sign({ foo: 1 }, SECRET, { algorithm: 'HS256' }), SECRET)).toBeNull()
  })
})
