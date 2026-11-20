import {
  ROLES,
  cleanName,
  isDuplicateEmail,
  isDuplicateName,
  lineDeactivationBlocker,
  makeId,
  productDeactivationBlocker,
  userChangeBlocker,
  validateEmail,
  validateLineCode,
  validateName,
  validateShiftTarget,
  validateShiftTimes,
  type Role,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest, notFound, ruleViolation } from '../../lib/errors'
import { newId } from '../../lib/ids'
import { hashPassword, passwordProblem } from '../../lib/password'
import type { AuthUser } from '../../middleware/context'
import { toAudit, toDefect, toLine, toMachine, toProduct, toShift, toUser } from './settings.mappers'

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]
type AuditEntity = 'user' | 'product' | 'line' | 'machine' | 'shift' | 'defect_type'
type AuditActionName = 'created' | 'updated' | 'activated' | 'deactivated' | 'password_reset'

const OPEN_STATUSES = ['draft', 'planned', 'in_progress'] as const

async function audit(tx: Tx, actor: AuthUser, entity: AuditEntity, entityId: string, action: AuditActionName, detail: string): Promise<void> {
  await tx.auditLog.create({ data: { id: newId('aud'), actorId: actor.id, entity, entityId, action, detail } })
}

/** Turns a rule's "why not" message into a 422, or passes when the rule is satisfied. */
function enforce(problem: string | null): void {
  if (problem) throw ruleViolation(problem)
}

function checkName(name: string, existing: readonly { id: string; name: string }[], label: string, exceptId?: string): string {
  const error = validateName(name)
  if (error) throw badRequest('Some fields are not valid.', { name: error })
  if (isDuplicateName(existing, name, exceptId)) throw ruleViolation(`${label} "${cleanName(name)}" already exists.`)
  return cleanName(name)
}

// ------------------------------------------------------------------ overview
export async function getOverview(db: Db) {
  const [users, products, lines, machines, defectTypes, shifts, audits, openOrders] = await Promise.all([
    db.user.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
    db.product.findMany({ orderBy: { name: 'asc' } }),
    db.productionLine.findMany({ orderBy: { name: 'asc' } }),
    db.machine.findMany({ orderBy: { name: 'asc' } }),
    db.defectType.findMany({ orderBy: { name: 'asc' } }),
    db.shift.findMany({ orderBy: { startTime: 'asc' } }),
    db.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200, include: { actor: { select: { name: true } } } }),
    db.productionOrder.findMany({ where: { status: { in: [...OPEN_STATUSES] } }, select: { productId: true, lineId: true } }),
  ])
  const byProduct: Record<string, number> = {}
  const byLine: Record<string, number> = {}
  for (const o of openOrders) {
    byProduct[o.productId] = (byProduct[o.productId] ?? 0) + 1
    byLine[o.lineId] = (byLine[o.lineId] ?? 0) + 1
  }
  return {
    users: users.map(toUser),
    products: products.map(toProduct),
    lines: lines.map(toLine),
    machines: machines.map(toMachine),
    defectTypes: defectTypes.map(toDefect),
    shifts: shifts.map(toShift),
    audit: audits.map(toAudit),
    openOrders: { byProduct, byLine },
  }
}

// --------------------------------------------------------------------- users
export interface UserInput { name: string; email: string; role: Role }

/** Locks the active administrators for the rest of the transaction, so two requests cannot both remove "the other" admin. */
async function lockAdmins(tx: Tx): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE role = 'administrator' AND "isActive" = true FOR UPDATE`
}

async function checkUserInput(tx: Tx, input: UserInput, exceptId?: string): Promise<UserInput> {
  const users = await tx.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true } })
  const name = checkName(input.name, users, 'A user named', exceptId)
  const emailError = validateEmail(input.email)
  if (emailError) throw badRequest('Some fields are not valid.', { email: emailError })
  if (isDuplicateEmail(users, input.email, exceptId)) throw ruleViolation('Another user already has this email address.')
  if (!ROLES.includes(input.role)) throw badRequest('Some fields are not valid.', { role: 'Select a valid role.' })
  return { name, email: input.email.trim().toLowerCase(), role: input.role }
}

export async function createUser(db: Db, actor: AuthUser, input: UserInput & { password: string }) {
  const problem = passwordProblem(input.password, input.email)
  if (problem) throw badRequest('Some fields are not valid.', { password: problem })
  const passwordHash = await hashPassword(input.password)
  return db.$transaction(async (tx) => {
    const clean = await checkUserInput(tx, input)
    const users = await tx.user.findMany({ select: { id: true } })
    const id = makeId('user', clean.name, users.map((u) => u.id))
    const user = await tx.user.create({ data: { id, ...clean, passwordHash } })
    await audit(tx, actor, 'user', id, 'created', `Added ${user.name} as ${user.role}`)
    return toUser(user)
  })
}

export async function updateUser(db: Db, actor: AuthUser, id: string, input: UserInput) {
  return db.$transaction(async (tx) => {
    await lockAdmins(tx)
    const current = await tx.user.findUnique({ where: { id } })
    if (!current) throw notFound('That user was not found.')
    const clean = await checkUserInput(tx, input, id)
    const all = await tx.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true } })
    enforce(userChangeBlocker(all, current, { role: clean.role, isActive: current.isActive }, actor.name))
    const changes: string[] = []
    if (clean.name !== current.name) changes.push(`name ${current.name} → ${clean.name}`)
    if (clean.email !== current.email) changes.push(`email ${current.email} → ${clean.email}`)
    if (clean.role !== current.role) changes.push(`role ${current.role} → ${clean.role}`)
    if (changes.length === 0) return toUser(current)
    // A role change ends the user's existing sessions so the new permissions apply at once.
    const user = await tx.user.update({ where: { id }, data: { ...clean, ...(clean.role !== current.role ? { tokenVersion: { increment: 1 } } : {}) } })
    await audit(tx, actor, 'user', id, 'updated', `${current.name}: ${changes.join(', ')}`)
    return toUser(user)
  })
}

export async function setUserActive(db: Db, actor: AuthUser, id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    await lockAdmins(tx)
    const current = await tx.user.findUnique({ where: { id } })
    if (!current) throw notFound('That user was not found.')
    if (current.isActive === isActive) return toUser(current)
    const all = await tx.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true } })
    enforce(userChangeBlocker(all, current, { role: current.role, isActive }, actor.name))
    const user = await tx.user.update({ where: { id }, data: { isActive, tokenVersion: { increment: 1 } } })
    await audit(tx, actor, 'user', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`)
    return toUser(user)
  })
}

export async function resetUserPassword(db: Db, actor: AuthUser, id: string, password: string): Promise<void> {
  const current = await db.user.findUnique({ where: { id } })
  if (!current) throw notFound('That user was not found.')
  const problem = passwordProblem(password, current.email)
  if (problem) throw badRequest('Some fields are not valid.', { password: problem })
  const passwordHash = await hashPassword(password)
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash, tokenVersion: { increment: 1 } } })
    await audit(tx, actor, 'user', id, 'password_reset', `Password reset for ${current.name}`)
  })
}

// ------------------------------------------------------------------ products
export async function createProduct(db: Db, actor: AuthUser, input: { name: string }) {
  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, products, 'A product named')
    const id = makeId('prod', name, products.map((p) => p.id))
    const product = await tx.product.create({ data: { id, name } })
    await audit(tx, actor, 'product', id, 'created', `Added product ${name}`)
    return toProduct(product)
  })
}

export async function updateProduct(db: Db, actor: AuthUser, id: string, input: { name: string }) {
  return db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id } })
    if (!current) throw notFound('That product was not found.')
    const products = await tx.product.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, products, 'A product named', id)
    if (name === current.name) return toProduct(current)
    const product = await tx.product.update({ where: { id }, data: { name } })
    await audit(tx, actor, 'product', id, 'updated', `Renamed ${current.name} → ${name}`)
    return toProduct(product)
  })
}

export async function setProductActive(db: Db, actor: AuthUser, id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id } })
    if (!current) throw notFound('That product was not found.')
    if (current.isActive === isActive) return toProduct(current)
    if (!isActive) {
      const orders = await tx.productionOrder.findMany({ where: { productId: id, status: { in: [...OPEN_STATUSES] } }, select: { productId: true, lineId: true, status: true } })
      enforce(productDeactivationBlocker(orders, id))
    }
    const product = await tx.product.update({ where: { id }, data: { isActive } })
    await audit(tx, actor, 'product', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`)
    return toProduct(product)
  })
}

// --------------------------------------------------------------------- lines
export async function createLine(db: Db, actor: AuthUser, input: { name: string; code: string }) {
  return db.$transaction(async (tx) => {
    const lines = await tx.productionLine.findMany({ select: { id: true, name: true, code: true } })
    const name = checkName(input.name, lines, 'A line named')
    const code = input.code.trim()
    const codeError = validateLineCode(code)
    if (codeError) throw badRequest('Some fields are not valid.', { code: codeError })
    if (lines.some((l) => l.code === code)) throw ruleViolation(`The code ${code} is already used by another line.`)
    const id = makeId('line', name, lines.map((l) => l.id))
    const line = await tx.productionLine.create({ data: { id, name, code } })
    await audit(tx, actor, 'line', id, 'created', `Added line ${name} (${code})`)
    return toLine(line)
  })
}

export async function updateLine(db: Db, actor: AuthUser, id: string, input: { name: string }) {
  return db.$transaction(async (tx) => {
    const current = await tx.productionLine.findUnique({ where: { id } })
    if (!current) throw notFound('That line was not found.')
    const lines = await tx.productionLine.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, lines, 'A line named', id)
    if (name === current.name) return toLine(current)
    const line = await tx.productionLine.update({ where: { id }, data: { name } })
    await audit(tx, actor, 'line', id, 'updated', `Renamed ${current.name} → ${name}`)
    return toLine(line)
  })
}

export async function setLineActive(db: Db, actor: AuthUser, id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    const current = await tx.productionLine.findUnique({ where: { id } })
    if (!current) throw notFound('That line was not found.')
    if (current.isActive === isActive) return toLine(current)
    if (!isActive) {
      const [orders, machines] = await Promise.all([
        tx.productionOrder.findMany({ where: { lineId: id, status: { in: [...OPEN_STATUSES] } }, select: { productId: true, lineId: true, status: true } }),
        tx.machine.findMany({ where: { lineId: id }, select: { lineId: true, isActive: true } }),
      ])
      enforce(lineDeactivationBlocker(orders, machines, id))
    }
    const line = await tx.productionLine.update({ where: { id }, data: { isActive } })
    await audit(tx, actor, 'line', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`)
    return toLine(line)
  })
}

// ------------------------------------------------------------------ machines
export async function createMachine(db: Db, actor: AuthUser, input: { name: string; lineId: string; shiftTarget: number }) {
  return db.$transaction(async (tx) => {
    const machines = await tx.machine.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, machines, 'A machine named')
    const line = await tx.productionLine.findUnique({ where: { id: input.lineId } })
    if (!line) throw badRequest('Some fields are not valid.', { lineId: 'Select a production line.' })
    if (!line.isActive) throw ruleViolation(`${line.name} is inactive. Choose an active line.`)
    const targetError = validateShiftTarget(input.shiftTarget)
    if (targetError) throw badRequest('Some fields are not valid.', { shiftTarget: targetError })
    const id = makeId('mc', name, machines.map((m) => m.id))
    const machine = await tx.machine.create({ data: { id, name, lineId: line.id, shiftTarget: input.shiftTarget } })
    await audit(tx, actor, 'machine', id, 'created', `Added machine ${name} on ${line.name}, target ${input.shiftTarget} per shift`)
    return toMachine(machine)
  })
}

/** The line is fixed after creation. A new shift target applies to reports filed from now on. */
export async function updateMachine(db: Db, actor: AuthUser, id: string, input: { name: string; shiftTarget: number }) {
  return db.$transaction(async (tx) => {
    const current = await tx.machine.findUnique({ where: { id } })
    if (!current) throw notFound('That machine was not found.')
    const machines = await tx.machine.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, machines, 'A machine named', id)
    const targetError = validateShiftTarget(input.shiftTarget)
    if (targetError) throw badRequest('Some fields are not valid.', { shiftTarget: targetError })
    const changes: string[] = []
    if (name !== current.name) changes.push(`name ${current.name} → ${name}`)
    if (input.shiftTarget !== current.shiftTarget) changes.push(`shift target ${current.shiftTarget} → ${input.shiftTarget} (new reports only)`)
    if (changes.length === 0) return toMachine(current)
    const machine = await tx.machine.update({ where: { id }, data: { name, shiftTarget: input.shiftTarget } })
    await audit(tx, actor, 'machine', id, 'updated', `${current.name}: ${changes.join(', ')}`)
    return toMachine(machine)
  })
}

export async function setMachineActive(db: Db, actor: AuthUser, id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    const current = await tx.machine.findUnique({ where: { id }, include: { line: true } })
    if (!current) throw notFound('That machine was not found.')
    if (current.isActive === isActive) return toMachine(current)
    if (isActive && !current.line.isActive) throw ruleViolation(`${current.line.name} is inactive. Activate the line first.`)
    const machine = await tx.machine.update({ where: { id }, data: { isActive } })
    await audit(tx, actor, 'machine', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`)
    return toMachine(machine)
  })
}

// -------------------------------------------------------------- defect types
export async function createDefectType(db: Db, actor: AuthUser, input: { name: string }) {
  return db.$transaction(async (tx) => {
    const defects = await tx.defectType.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, defects, 'A defect type named')
    const id = makeId('defect', name, defects.map((d) => d.id))
    const defect = await tx.defectType.create({ data: { id, name } })
    await audit(tx, actor, 'defect_type', id, 'created', `Added defect type ${name}`)
    return toDefect(defect)
  })
}

export async function updateDefectType(db: Db, actor: AuthUser, id: string, input: { name: string }) {
  return db.$transaction(async (tx) => {
    const current = await tx.defectType.findUnique({ where: { id } })
    if (!current) throw notFound('That defect type was not found.')
    const defects = await tx.defectType.findMany({ select: { id: true, name: true } })
    const name = checkName(input.name, defects, 'A defect type named', id)
    if (name === current.name) return toDefect(current)
    const defect = await tx.defectType.update({ where: { id }, data: { name } })
    await audit(tx, actor, 'defect_type', id, 'updated', `Renamed ${current.name} → ${name}`)
    return toDefect(defect)
  })
}

export async function setDefectTypeActive(db: Db, actor: AuthUser, id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    const current = await tx.defectType.findUnique({ where: { id } })
    if (!current) throw notFound('That defect type was not found.')
    if (current.isActive === isActive) return toDefect(current)
    if (!isActive && (await tx.defectType.count({ where: { isActive: true, id: { not: id } } })) === 0) {
      throw ruleViolation('Keep at least one active defect type so inspections can classify failures.')
    }
    const defect = await tx.defectType.update({ where: { id }, data: { isActive } })
    await audit(tx, actor, 'defect_type', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`)
    return toDefect(defect)
  })
}

// -------------------------------------------------------------------- shifts
export async function updateShift(db: Db, actor: AuthUser, id: string, input: { startTime: string; endTime: string }) {
  return db.$transaction(async (tx) => {
    const current = await tx.shift.findUnique({ where: { id } })
    if (!current) throw notFound('That shift was not found.')
    const error = validateShiftTimes(input.startTime, input.endTime)
    if (error) throw badRequest('Some fields are not valid.', { endTime: error })
    if (input.startTime === current.startTime && input.endTime === current.endTime) return toShift(current)
    const shift = await tx.shift.update({ where: { id }, data: input })
    await audit(tx, actor, 'shift', id, 'updated', `${current.name} shift ${current.startTime}–${current.endTime} → ${input.startTime}–${input.endTime}`)
    return toShift(shift)
  })
}
