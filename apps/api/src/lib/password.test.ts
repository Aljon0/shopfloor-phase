import { describe, expect, it } from 'vitest'
import { hashPassword, passwordProblem, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct horse battery', hash)).toBe(true)
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false)
  })

  it('salts every hash, so the same password never produces the same value', async () => {
    expect(await hashPassword('same password 123')).not.toBe(await hashPassword('same password 123'))
  })

  it('rejects malformed stored hashes instead of throwing', async () => {
    for (const bad of ['', 'plain', 'scrypt$1$2', 'bcrypt$1$2$3$4$5']) expect(await verifyPassword('x', bad)).toBe(false)
  })
})

describe('password policy', () => {
  it('enforces length, not-the-email and not-one-repeated-character', () => {
    expect(passwordProblem('short')).toMatch(/at least 10/)
    expect(passwordProblem('x'.repeat(129))).toMatch(/at most 128/)
    expect(passwordProblem('rosa@northstar.example', 'ROSA@northstar.example')).toMatch(/same as the email/)
    expect(passwordProblem('aaaaaaaaaaaa')).toMatch(/repeated/)
    expect(passwordProblem('a decent passphrase')).toBeNull()
  })
})
