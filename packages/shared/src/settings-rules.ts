/**
 * Configuration rules. Pure functions, no UI imports.
 *
 * Assumptions to confirm:
 * - Records are deactivated, never deleted, so past orders, reports and inspections keep their names.
 * - A production line code is fixed after creation (report numbers use it). A machine's line is fixed
 *   after creation (reports and downtime are tied to it).
 * - A product or line cannot be deactivated while it has open orders (Draft, Planned, In Progress); a
 *   line also cannot be deactivated while it has active machines; a machine can only be activated
 *   while its line is active.
 * - The last active administrator cannot be deactivated or changed to another role, and nobody can
 *   deactivate or change the role of their own account.
 * - Downtime categories are a fixed list (reports, the dashboard and exports depend on them), so they
 *   are shown but not editable here.
 */
import type { Role } from './roles'

/** Minimal shapes the rules need. The web and API domain types satisfy them structurally. */
export interface RuleUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
}
export interface RuleMachine {
  lineId: string
  isActive: boolean
}
export interface RuleOrder {
  productId: string
  lineId: string
  status: 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled'
}

export const MIN_NAME_LENGTH = 2
export const MAX_NAME_LENGTH = 80
export const MAX_SHIFT_TARGET = 100_000

const OPEN_ORDER_STATUSES: readonly RuleOrder["status"][] = ['draft', 'planned', 'in_progress']
const normalize = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function validateName(name: string): string | null {
  const n = cleanName(name)
  if (n.length < MIN_NAME_LENGTH) return `Enter a name of at least ${MIN_NAME_LENGTH} characters.`
  if (n.length > MAX_NAME_LENGTH) return `Keep the name under ${MAX_NAME_LENGTH} characters.`
  return null
}

/** True when another record already uses this name (ignoring case and extra spaces). */
export function isDuplicateName(existing: readonly { id: string; name: string }[], name: string, exceptId?: string): boolean {
  const target = normalize(name)
  return existing.some((e) => e.id !== exceptId && normalize(e.name) === target)
}

export function validateLineCode(code: string): string | null {
  return /^[A-Z]{2,4}$/.test(code.trim()) ? null : 'Use 2 to 4 capital letters, for example CUT.'
}

export function validateShiftTarget(value: number): string | null {
  if (!Number.isInteger(value) || value < 1) return 'Enter a whole number of at least 1.'
  if (value > MAX_SHIFT_TARGET) return `Keep the target at ${MAX_SHIFT_TARGET.toLocaleString('en-PH')} or less.`
  return null
}

export function validateEmail(email: string): string | null {
  const e = email.trim()
  if (e.length > 120) return 'Keep the email under 120 characters.'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? null : 'Enter a valid email address.'
}

export function isDuplicateEmail(users: readonly RuleUser[], email: string, exceptId?: string): boolean {
  const target = email.trim().toLowerCase()
  return users.some((u) => u.id !== exceptId && u.email.toLowerCase() === target)
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateShiftTimes(start: string, end: string): string | null {
  if (!TIME.test(start) || !TIME.test(end)) return 'Enter start and end times as hours and minutes.'
  if (start === end) return 'The start and end times must be different.'
  return null
}

/** Length of a shift in minutes; a shift that ends before it starts runs overnight. */
export function shiftLengthMinutes(start: string, end: string): number | null {
  if (!TIME.test(start) || !TIME.test(end)) return null
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  const diff = toMinutes(end) - toMinutes(start)
  return diff > 0 ? diff : diff + 24 * 60
}

const sameName = (a: string, b: string): boolean => normalize(a) === normalize(b)

/** Why a user cannot be deactivated or have their role changed, or null when it is allowed. */
export function userChangeBlocker(
  users: readonly RuleUser[],
  target: RuleUser,
  next: { role: Role; isActive: boolean },
  actorName: string,
): string | null {
  const losesAdmin = target.role === 'administrator' && target.isActive && (next.role !== 'administrator' || !next.isActive)
  if (sameName(target.name, actorName) && (next.role !== target.role || next.isActive !== target.isActive)) {
    return 'You cannot change the role or status of your own account.'
  }
  if (losesAdmin && !users.some((u) => u.id !== target.id && u.role === 'administrator' && u.isActive)) {
    return 'There must be at least one active administrator.'
  }
  return null
}

export function openOrderCount(orders: readonly RuleOrder[], pick: (o: RuleOrder) => boolean): number {
  return orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status) && pick(o)).length
}

export function productDeactivationBlocker(orders: readonly RuleOrder[], productId: string): string | null {
  const open = openOrderCount(orders, (o) => o.productId === productId)
  return open > 0 ? `${open} open ${open === 1 ? 'order uses' : 'orders use'} this product. Complete or cancel them first.` : null
}

export function lineDeactivationBlocker(orders: readonly RuleOrder[], machines: readonly RuleMachine[], lineId: string): string | null {
  const open = openOrderCount(orders, (o) => o.lineId === lineId)
  if (open > 0) return `${open} open ${open === 1 ? 'order is' : 'orders are'} on this line. Complete or cancel them first.`
  const active = machines.filter((m) => m.lineId === lineId && m.isActive).length
  if (active > 0) return `${active} active ${active === 1 ? 'machine is' : 'machines are'} on this line. Deactivate them first.`
  return null
}

/** Next unused id such as 'prod-steel-plate' or 'prod-steel-plate-2'. */
export function makeId(prefix: string, name: string, existingIds: readonly string[]): string {
  const slug = cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'item'
  let id = `${prefix}-${slug}`
  for (let n = 2; existingIds.includes(id); n += 1) id = `${prefix}-${slug}-${n}`
  return id
}
