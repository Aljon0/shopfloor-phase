import type { Role } from '@shopfloor/shared'

interface UserRow { id: string; name: string; email: string; role: Role; isActive: boolean; createdAt: Date }
interface LineRow { id: string; name: string; code: string; isActive: boolean }
interface NamedRow { id: string; name: string; isActive: boolean }
interface MachineRow { id: string; name: string; lineId: string; shiftTarget: number; isActive: boolean }
interface ShiftRow { id: string; name: string; startTime: string; endTime: string }
interface AuditRow { id: string; timestamp: Date; entity: string; entityId: string; action: string; detail: string; actor: { name: string } | null }

// The JSON shapes match the web app's domain types, so the web needs no translation layer.
export const toUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt.toISOString() })
export const toLine = (l: LineRow) => ({ id: l.id, name: l.name, code: l.code, isActive: l.isActive })
export const toProduct = (p: NamedRow) => ({ id: p.id, name: p.name, isActive: p.isActive })
export const toDefect = (d: NamedRow) => ({ id: d.id, name: d.name, isActive: d.isActive })
export const toMachine = (m: MachineRow) => ({ id: m.id, name: m.name, lineId: m.lineId, shiftTarget: m.shiftTarget, isActive: m.isActive })
export const toShift = (s: ShiftRow) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime })
export const toAudit = (a: AuditRow) => ({ id: a.id, timestamp: a.timestamp.toISOString(), actor: a.actor?.name ?? 'System', entity: a.entity, entityId: a.entityId, action: a.action, detail: a.detail })
