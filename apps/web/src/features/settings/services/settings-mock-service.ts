import { mockRepository } from '@/mocks/repository'
import type { AppUser, DefectType, Machine, Product, ProductionLine, SettingsAuditEntry, SettingsEntity, ShiftConfig, ShiftId } from '@/types/domain'
import type { Role } from '@/types/roles'
import { ROLES } from '@/types/roles'
import {
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
} from '../lib/settings-rules'

export class SettingsRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettingsRuleError'
  }
}

export interface SettingsData {
  users: AppUser[]
  products: Product[]
  lines: ProductionLine[]
  machines: Machine[]
  defectTypes: DefectType[]
  shifts: ShiftConfig[]
  audit: SettingsAuditEntry[]
  /** Open orders per product and per line, so the screens can say why something cannot be deactivated. */
  openOrders: { byProduct: Record<string, number>; byLine: Record<string, number> }
}

const OPEN = ['draft', 'planned', 'in_progress']

export async function getSettingsData(): Promise<SettingsData> {
  const [users, products, lines, machines, defectTypes, shifts, audit, orders] = await Promise.all([
    mockRepository.listUsers(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listMachines(),
    mockRepository.listDefectTypes(),
    mockRepository.listShiftConfigs(),
    mockRepository.listSettingsAudit(),
    mockRepository.listOrders(),
  ])
  const byProduct: Record<string, number> = {}
  const byLine: Record<string, number> = {}
  for (const o of orders) {
    if (!OPEN.includes(o.status)) continue
    byProduct[o.productId] = (byProduct[o.productId] ?? 0) + 1
    byLine[o.lineId] = (byLine[o.lineId] ?? 0) + 1
  }
  return { users, products, lines, machines, defectTypes, shifts, audit, openOrders: { byProduct, byLine } }
}

function audit(actor: string, entity: SettingsEntity, entityId: string, action: SettingsAuditEntry['action'], detail: string): SettingsAuditEntry {
  return { id: `CFG-${crypto.randomUUID()}`, timestamp: new Date().toISOString(), actor, entity, entityId, action, detail }
}

function requireName(name: string, existing: readonly { id: string; name: string }[], label: string, exceptId?: string): string {
  const error = validateName(name)
  if (error) throw new SettingsRuleError(error)
  if (isDuplicateName(existing, name, exceptId)) throw new SettingsRuleError(`${label} "${cleanName(name)}" already exists.`)
  return cleanName(name)
}

// ---------------------------------------------------------------- users
export interface UserInput {
  name: string
  email: string
  role: Role
  /** Initial password. Used by the real API only; the browser-only demo has no passwords. */
  password?: string
}

function checkUserInput(input: UserInput, users: readonly AppUser[], exceptId?: string): UserInput {
  const name = requireName(input.name, users, 'A user named', exceptId)
  const emailError = validateEmail(input.email)
  if (emailError) throw new SettingsRuleError(emailError)
  if (isDuplicateEmail(users, input.email, exceptId)) throw new SettingsRuleError('Another user already has this email address.')
  if (!ROLES.includes(input.role)) throw new SettingsRuleError('Select a valid role.')
  return { name, email: input.email.trim().toLowerCase(), role: input.role }  // password intentionally dropped in mock mode
}

export async function createUser(input: UserInput, actor: string): Promise<AppUser> {
  const users = await mockRepository.listUsers()
  const clean = checkUserInput(input, users)
  const user: AppUser = { id: makeId('user', clean.name, users.map((u) => u.id)), ...clean, isActive: true, createdAt: new Date().toISOString() }
  return mockRepository.insertUser(user, audit(actor, 'user', user.id, 'created', `Added ${user.name} as ${user.role}`))
}

export async function updateUser(id: string, input: UserInput, actor: string): Promise<AppUser> {
  const users = await mockRepository.listUsers()
  const current = users.find((u) => u.id === id)
  if (!current) throw new SettingsRuleError('That user was not found.')
  const clean = checkUserInput(input, users, id)
  const blocker = userChangeBlocker(users, current, { role: clean.role, isActive: current.isActive }, actor)
  if (blocker) throw new SettingsRuleError(blocker)
  const changes: string[] = []
  if (clean.name !== current.name) changes.push(`name ${current.name} → ${clean.name}`)
  if (clean.email !== current.email) changes.push(`email ${current.email} → ${clean.email}`)
  if (clean.role !== current.role) changes.push(`role ${current.role} → ${clean.role}`)
  if (changes.length === 0) return current
  return mockRepository.replaceUser({ ...current, ...clean }, audit(actor, 'user', id, 'updated', `${current.name}: ${changes.join(', ')}`))
}

export async function setUserActive(id: string, isActive: boolean, actor: string): Promise<AppUser> {
  const users = await mockRepository.listUsers()
  const current = users.find((u) => u.id === id)
  if (!current) throw new SettingsRuleError('That user was not found.')
  if (current.isActive === isActive) return current
  const blocker = userChangeBlocker(users, current, { role: current.role, isActive }, actor)
  if (blocker) throw new SettingsRuleError(blocker)
  return mockRepository.replaceUser({ ...current, isActive }, audit(actor, 'user', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`))
}

// ------------------------------------------------------------- products
export async function createProduct(input: { name: string }, actor: string): Promise<Product> {
  const products = await mockRepository.listProducts()
  const name = requireName(input.name, products, 'A product named')
  const product: Product = { id: makeId('prod', name, products.map((p) => p.id)), name, isActive: true }
  return mockRepository.insertProduct(product, audit(actor, 'product', product.id, 'created', `Added product ${name}`))
}

export async function updateProduct(id: string, input: { name: string }, actor: string): Promise<Product> {
  const products = await mockRepository.listProducts()
  const current = products.find((p) => p.id === id)
  if (!current) throw new SettingsRuleError('That product was not found.')
  const name = requireName(input.name, products, 'A product named', id)
  if (name === current.name) return current
  return mockRepository.replaceProduct({ ...current, name }, audit(actor, 'product', id, 'updated', `Renamed ${current.name} → ${name}`))
}

export async function setProductActive(id: string, isActive: boolean, actor: string): Promise<Product> {
  const [products, orders] = await Promise.all([mockRepository.listProducts(), mockRepository.listOrders()])
  const current = products.find((p) => p.id === id)
  if (!current) throw new SettingsRuleError('That product was not found.')
  if (current.isActive === isActive) return current
  if (!isActive) {
    const blocker = productDeactivationBlocker(orders, id)
    if (blocker) throw new SettingsRuleError(blocker)
  }
  return mockRepository.replaceProduct({ ...current, isActive }, audit(actor, 'product', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`))
}

// ---------------------------------------------------------------- lines
export interface LineInput {
  name: string
  code: string
}

export async function createLine(input: LineInput, actor: string): Promise<ProductionLine> {
  const lines = await mockRepository.listLines()
  const name = requireName(input.name, lines, 'A line named')
  const codeError = validateLineCode(input.code)
  if (codeError) throw new SettingsRuleError(codeError)
  const code = input.code.trim()
  if (lines.some((l) => l.code === code)) throw new SettingsRuleError(`The code ${code} is already used by another line.`)
  const line: ProductionLine = { id: makeId('line', name, lines.map((l) => l.id)), name, code, isActive: true }
  return mockRepository.insertLine(line, audit(actor, 'line', line.id, 'created', `Added line ${name} (${code})`))
}

/** Only the name can change; the code is part of report numbers. */
export async function updateLine(id: string, input: { name: string }, actor: string): Promise<ProductionLine> {
  const lines = await mockRepository.listLines()
  const current = lines.find((l) => l.id === id)
  if (!current) throw new SettingsRuleError('That line was not found.')
  const name = requireName(input.name, lines, 'A line named', id)
  if (name === current.name) return current
  return mockRepository.replaceLine({ ...current, name }, audit(actor, 'line', id, 'updated', `Renamed ${current.name} → ${name}`))
}

export async function setLineActive(id: string, isActive: boolean, actor: string): Promise<ProductionLine> {
  const [lines, orders, machines] = await Promise.all([mockRepository.listLines(), mockRepository.listOrders(), mockRepository.listMachines()])
  const current = lines.find((l) => l.id === id)
  if (!current) throw new SettingsRuleError('That line was not found.')
  if (current.isActive === isActive) return current
  if (!isActive) {
    const blocker = lineDeactivationBlocker(orders, machines, id)
    if (blocker) throw new SettingsRuleError(blocker)
  }
  return mockRepository.replaceLine({ ...current, isActive }, audit(actor, 'line', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`))
}

// ------------------------------------------------------------- machines
export interface MachineInput {
  name: string
  lineId: string
  shiftTarget: number
}

export async function createMachine(input: MachineInput, actor: string): Promise<Machine> {
  const [machines, lines] = await Promise.all([mockRepository.listMachines(), mockRepository.listLines()])
  const name = requireName(input.name, machines, 'A machine named')
  const line = lines.find((l) => l.id === input.lineId)
  if (!line) throw new SettingsRuleError('Select a production line.')
  if (!line.isActive) throw new SettingsRuleError(`${line.name} is inactive. Choose an active line.`)
  const targetError = validateShiftTarget(input.shiftTarget)
  if (targetError) throw new SettingsRuleError(targetError)
  const machine: Machine = { id: makeId('mc', name, machines.map((m) => m.id)), name, lineId: line.id, shiftTarget: input.shiftTarget, isActive: true }
  return mockRepository.insertMachine(machine, audit(actor, 'machine', machine.id, 'created', `Added machine ${name} on ${line.name}, target ${input.shiftTarget} per shift`))
}

/** The line is fixed after creation. A new shift target applies to reports filed from now on. */
export async function updateMachine(id: string, input: { name: string; shiftTarget: number }, actor: string): Promise<Machine> {
  const machines = await mockRepository.listMachines()
  const current = machines.find((m) => m.id === id)
  if (!current) throw new SettingsRuleError('That machine was not found.')
  const name = requireName(input.name, machines, 'A machine named', id)
  const targetError = validateShiftTarget(input.shiftTarget)
  if (targetError) throw new SettingsRuleError(targetError)
  const changes: string[] = []
  if (name !== current.name) changes.push(`name ${current.name} → ${name}`)
  if (input.shiftTarget !== current.shiftTarget) changes.push(`shift target ${current.shiftTarget} → ${input.shiftTarget} (new reports only)`)
  if (changes.length === 0) return current
  return mockRepository.replaceMachine({ ...current, name, shiftTarget: input.shiftTarget }, audit(actor, 'machine', id, 'updated', `${current.name}: ${changes.join(', ')}`))
}

export async function setMachineActive(id: string, isActive: boolean, actor: string): Promise<Machine> {
  const [machines, lines] = await Promise.all([mockRepository.listMachines(), mockRepository.listLines()])
  const current = machines.find((m) => m.id === id)
  if (!current) throw new SettingsRuleError('That machine was not found.')
  if (current.isActive === isActive) return current
  const line = lines.find((l) => l.id === current.lineId)
  if (isActive && line && !line.isActive) throw new SettingsRuleError(`${line.name} is inactive. Activate the line first.`)
  return mockRepository.replaceMachine({ ...current, isActive }, audit(actor, 'machine', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`))
}

// --------------------------------------------------------- defect types
export async function createDefectType(input: { name: string }, actor: string): Promise<DefectType> {
  const defects = await mockRepository.listDefectTypes()
  const name = requireName(input.name, defects, 'A defect type named')
  const defect: DefectType = { id: makeId('defect', name, defects.map((d) => d.id)), name, isActive: true }
  return mockRepository.insertDefectType(defect, audit(actor, 'defect_type', defect.id, 'created', `Added defect type ${name}`))
}

export async function updateDefectType(id: string, input: { name: string }, actor: string): Promise<DefectType> {
  const defects = await mockRepository.listDefectTypes()
  const current = defects.find((d) => d.id === id)
  if (!current) throw new SettingsRuleError('That defect type was not found.')
  const name = requireName(input.name, defects, 'A defect type named', id)
  if (name === current.name) return current
  return mockRepository.replaceDefectType({ ...current, name }, audit(actor, 'defect_type', id, 'updated', `Renamed ${current.name} → ${name}`))
}

export async function setDefectTypeActive(id: string, isActive: boolean, actor: string): Promise<DefectType> {
  const defects = await mockRepository.listDefectTypes()
  const current = defects.find((d) => d.id === id)
  if (!current) throw new SettingsRuleError('That defect type was not found.')
  if (current.isActive === isActive) return current
  if (!isActive && defects.filter((d) => d.isActive && d.id !== id).length === 0) {
    throw new SettingsRuleError('Keep at least one active defect type so inspections can classify failures.')
  }
  return mockRepository.replaceDefectType({ ...current, isActive }, audit(actor, 'defect_type', id, isActive ? 'activated' : 'deactivated', `${isActive ? 'Reactivated' : 'Deactivated'} ${current.name}`))
}

// --------------------------------------------------------------- shifts
/** Shift hours are saved for reference; the dashboard and reports do not use them yet. */
export async function updateShift(id: ShiftId, input: { startTime: string; endTime: string }, actor: string): Promise<ShiftConfig> {
  const shifts = await mockRepository.listShiftConfigs()
  const current = shifts.find((s) => s.id === id)
  if (!current) throw new SettingsRuleError('That shift was not found.')
  const error = validateShiftTimes(input.startTime, input.endTime)
  if (error) throw new SettingsRuleError(error)
  if (input.startTime === current.startTime && input.endTime === current.endTime) return current
  return mockRepository.replaceShiftConfig(
    { ...current, ...input },
    audit(actor, 'shift', id, 'updated', `${current.name} shift ${current.startTime}–${current.endTime} → ${input.startTime}–${input.endTime}`),
  )
}
