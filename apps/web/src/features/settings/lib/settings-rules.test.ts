import { describe, expect, it } from 'vitest'
import type { AppUser, Machine, ProductionOrder } from '@/types/domain'
import {
  isDuplicateEmail,
  isDuplicateName,
  lineDeactivationBlocker,
  makeId,
  productDeactivationBlocker,
  shiftLengthMinutes,
  userChangeBlocker,
  validateEmail,
  validateLineCode,
  validateName,
  validateShiftTarget,
  validateShiftTimes,
} from './settings-rules'

const user = (id: string, name: string, role: AppUser['role'], isActive = true): AppUser => ({ id, name, email: `${id}@x.example`, role, isActive, createdAt: '2026-10-01T00:00:00Z' })
const order = (productId: string, lineId: string, status: ProductionOrder['status']): ProductionOrder => ({ productId, lineId, status }) as ProductionOrder
const machine = (lineId: string, isActive: boolean): Machine => ({ id: `m-${lineId}-${isActive}`, name: 'M', lineId, shiftTarget: 10, isActive })

describe('field validation', () => {
  it('names: length and duplicates ignoring case and spacing', () => {
    expect(validateName('A')).not.toBeNull()
    expect(validateName('  Metal  panels ')).toBeNull()
    expect(validateName('x'.repeat(81))).not.toBeNull()
    expect(isDuplicateName([{ id: 'a', name: 'Metal panels' }], '  metal   PANELS')).toBe(true)
    expect(isDuplicateName([{ id: 'a', name: 'Metal panels' }], 'metal panels', 'a')).toBe(false)
  })
  it('line codes are 2 to 4 capital letters', () => {
    for (const ok of ['CUT', 'AB', 'ABCD']) expect(validateLineCode(ok)).toBeNull()
    for (const bad of ['A', 'ABCDE', 'cut', 'C1T', '']) expect(validateLineCode(bad)).not.toBeNull()
  })
  it('shift targets are whole numbers from 1 to 100,000', () => {
    expect(validateShiftTarget(250)).toBeNull()
    for (const bad of [0, -5, 2.5, 100_001, Number.NaN]) expect(validateShiftTarget(bad)).not.toBeNull()
  })
  it('emails: format and duplicates', () => {
    expect(validateEmail('a@b.co')).toBeNull()
    expect(validateEmail('nope')).not.toBeNull()
    expect(isDuplicateEmail([user('u1', 'A', 'manager')], 'U1@X.EXAMPLE')).toBe(true)
    expect(isDuplicateEmail([user('u1', 'A', 'manager')], 'u1@x.example', 'u1')).toBe(false)
  })
  it('shift times: valid, different, overnight length', () => {
    expect(validateShiftTimes('06:00', '18:00')).toBeNull()
    expect(validateShiftTimes('06:00', '06:00')).not.toBeNull()
    expect(validateShiftTimes('6:00', '18:00')).not.toBeNull()
    expect(validateShiftTimes('24:00', '18:00')).not.toBeNull()
    expect(shiftLengthMinutes('06:00', '18:00')).toBe(720)
    expect(shiftLengthMinutes('18:00', '06:00')).toBe(720)
  })
})

describe('user safeguards', () => {
  const admin = user('a1', 'Carlo Reyes', 'administrator')
  const users = [admin, user('s1', 'Rosa', 'supervisor')]
  it('protects the last active administrator', () => {
    expect(userChangeBlocker(users, admin, { role: 'administrator', isActive: false }, 'Someone Else')).toMatch(/at least one/)
    expect(userChangeBlocker(users, admin, { role: 'manager', isActive: true }, 'Someone Else')).toMatch(/at least one/)
    const two = [...users, user('a2', 'Second Admin', 'administrator')]
    expect(userChangeBlocker(two, admin, { role: 'administrator', isActive: false }, 'Someone Else')).toBeNull()
  })
  it('blocks changing your own role or status, ignoring case and spacing', () => {
    expect(userChangeBlocker(users, users[1]!, { role: 'manager', isActive: true }, ' rosa ')).toMatch(/own account/)
    expect(userChangeBlocker(users, users[1]!, { role: 'supervisor', isActive: true }, 'Rosa')).toBeNull()
  })
})

describe('deactivation blockers', () => {
  it('products and lines with open orders cannot be deactivated; finished ones can', () => {
    const orders = [order('p1', 'l1', 'in_progress'), order('p2', 'l2', 'completed'), order('p3', 'l3', 'cancelled')]
    expect(productDeactivationBlocker(orders, 'p1')).toMatch(/1 open order uses/)
    expect(productDeactivationBlocker(orders, 'p2')).toBeNull()
    expect(productDeactivationBlocker(orders, 'p3')).toBeNull()
    expect(lineDeactivationBlocker(orders, [], 'l1')).toMatch(/open order is/)
    expect(lineDeactivationBlocker(orders, [], 'l2')).toBeNull()
  })
  it('a line with active machines cannot be deactivated', () => {
    expect(lineDeactivationBlocker([], [machine('l1', true)], 'l1')).toMatch(/active machine is/)
    expect(lineDeactivationBlocker([], [machine('l1', false)], 'l1')).toBeNull()
  })
})

describe('makeId', () => {
  it('slugs names and avoids collisions', () => {
    expect(makeId('prod', 'Steel Plate #2!', [])).toBe('prod-steel-plate-2')
    expect(makeId('prod', 'Steel plate', ['prod-steel-plate'])).toBe('prod-steel-plate-2')
    expect(makeId('prod', '***', [])).toBe('prod-item')
  })
})
