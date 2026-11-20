import {
  downtimeMinutes,
  findOverlap,
  isEventLocked,
  nextEventId,
  toFactoryIso,
  validateDowntimeInput,
  type DowntimeInput,
  type ReportStatus,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest, forbidden, notFound, ruleViolation } from '../../lib/errors'
import type { AuthUser } from '../../middleware/context'
import { factoryToday } from '../orders/orders.service'


type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]
const fromDate = (d: Date): string => d.toISOString().slice(0, 10)

interface EventRow {
  id: string
  lineId: string
  machineId: string
  orderId: string | null
  reportId: string | null
  startTime: Date
  endTime: Date
  category: DowntimeInput['category']
  notes: string
  recordedById: string
  recordedBy: { name: string }
}

const include = { recordedBy: { select: { name: true } } } as const

/** JSON shape equals the web's DowntimeEvent (plus recordedById, which the UI uses for ownership). */
function toEvent(e: EventRow) {
  return {
    id: e.id,
    lineId: e.lineId,
    machineId: e.machineId,
    ...(e.orderId ? { orderId: e.orderId } : {}),
    ...(e.reportId ? { reportId: e.reportId } : {}),
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    category: e.category,
    notes: e.notes,
    recordedBy: e.recordedBy.name,
    recordedById: e.recordedById,
  }
}

// ------------------------------------------------------------------- reads
export async function getReference(db: Db) {
  const [lines, machines, orders, reports] = await Promise.all([
    db.productionLine.findMany({ orderBy: { name: 'asc' } }),
    db.machine.findMany({ orderBy: { name: 'asc' } }),
    db.productionOrder.findMany({ include: { product: { select: { name: true } } }, orderBy: { orderNumber: 'desc' } }),
    db.productionReport.findMany({ select: { id: true, machineId: true, orderId: true, reportDate: true, status: true }, orderBy: { id: 'desc' } }),
  ])
  return {
    lines: lines.map((l) => ({ id: l.id, name: l.name, code: l.code, isActive: l.isActive })),
    machines: machines.map((m) => ({ id: m.id, name: m.name, lineId: m.lineId, isActive: m.isActive })),
    orders: orders.map((o) => ({ id: o.orderNumber, orderNumber: o.orderNumber, lineId: o.lineId, status: o.status, productName: o.product.name })),
    reports: reports.map((r) => ({ id: r.id, machineId: r.machineId, orderId: r.orderId, reportDate: fromDate(r.reportDate), status: r.status })),
    today: factoryToday(),
  }
}

const itemInclude = { ...include, line: { select: { name: true } }, machine: { select: { name: true } }, report: { select: { status: true } } } as const

function toItem(e: EventRow & { line: { name: string }; machine: { name: string }; report: { status: ReportStatus } | null }) {
  return {
    event: toEvent(e),
    minutes: downtimeMinutes(e.startTime.toISOString(), e.endTime.toISOString()) ?? 0,
    lineName: e.line.name,
    machineName: e.machine.name,
    reportStatus: e.report?.status ?? null,
  }
}

export async function listDowntimeItems(db: Db) {
  const rows = await db.downtimeEvent.findMany({ include: itemInclude, orderBy: [{ startTime: 'desc' }, { id: 'desc' }] })
  return rows.map(toItem)
}

export async function getDowntimeItem(db: Db, id: string) {
  const row = await db.downtimeEvent.findUnique({ where: { id }, include: itemInclude })
  if (!row) throw notFound(`Event ${id} was not found.`)
  return toItem(row)
}

// ------------------------------------------------------------------ writes
function assertValid(input: DowntimeInput): DowntimeInput {
  const errors = validateDowntimeInput(input, { today: factoryToday() })
  const messages = Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === 'string')
  if (messages.length > 0) throw badRequest('Some fields are not valid.', Object.fromEntries(messages))
  return { ...input, notes: input.notes.trim() }
}

/** Locks machine rows (in a fixed order) so two overlapping events on one machine cannot both be saved. */
async function lockMachines(tx: Tx, ids: string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM machines WHERE id = ${id} FOR UPDATE`
}

async function validateAgainstData(tx: Tx, rawInput: DowntimeInput, opts: { excludeId?: string; keepMachineId?: string; alreadyLinkedReportId?: string }) {
  const input = assertValid(rawInput)
  const machine = await tx.machine.findUnique({ where: { id: input.machineId } })
  if (!machine) throw badRequest('Some fields are not valid.', { machineId: 'Select a valid machine.' })
  if (!machine.isActive && machine.id !== opts.keepMachineId) throw ruleViolation(`${machine.name} is inactive and cannot be used for new downtime events.`)

  if (input.orderId !== '') {
    const order = await tx.productionOrder.findUnique({ where: { orderNumber: input.orderId } })
    if (!order) throw badRequest('Some fields are not valid.', { orderId: 'Select a valid production order.' })
    if (order.lineId !== machine.lineId) throw ruleViolation("The order is not on this machine's production line.")
  }
  if (input.reportId !== '') {
    // Lock the report so an approval cannot slip in between this check and the save.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM production_reports WHERE id = ${input.reportId} FOR UPDATE`
    const report = locked.length === 0 ? null : await tx.productionReport.findUnique({ where: { id: input.reportId } })
    if (!report) throw badRequest('Some fields are not valid.', { reportId: 'Select a valid production report.' })
    if (report.machineId !== machine.id) throw ruleViolation('The report belongs to a different machine.')
    if (isEventLocked(report.status)) throw ruleViolation('Downtime cannot be linked to an approved report.')
  }

  const startTime = new Date(toFactoryIso(input.startTime))
  const endTime = new Date(toFactoryIso(input.endTime))
  const sameMachine = await tx.downtimeEvent.findMany({ where: { machineId: machine.id }, select: { id: true, machineId: true, startTime: true, endTime: true } })
  const overlap = findOverlap(
    sameMachine.map((e) => ({ id: e.id, machineId: e.machineId, startTime: e.startTime.toISOString(), endTime: e.endTime.toISOString() })),
    { machineId: machine.id, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
    opts.excludeId,
  )
  if (overlap) throw ruleViolation(`This overlaps ${overlap}, another downtime event on ${machine.name}.`)
  return { input, machine, startTime, endTime }
}

export async function createDowntimeEvent(db: Db, actor: AuthUser, raw: DowntimeInput) {
  return db.$transaction(async (tx) => {
    const preMachine = typeof raw.machineId === 'string' ? raw.machineId : ''
    await lockMachines(tx, preMachine ? [preMachine] : [])
    // One event number at a time, so simultaneous events never receive the same DT number.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('downtime_event_number'))`
    const { input, machine, startTime, endTime } = await validateAgainstData(tx, raw, {})
    const ids = await tx.downtimeEvent.findMany({ select: { id: true } })
    const id = nextEventId(ids.map((e) => e.id))
    const created = await tx.downtimeEvent.create({
      data: {
        id,
        lineId: machine.lineId,
        machineId: machine.id,
        orderId: input.orderId === '' ? null : input.orderId,
        reportId: input.reportId === '' ? null : input.reportId,
        startTime,
        endTime,
        category: input.category,
        notes: input.notes,
        recordedById: actor.id,
      },
      include,
    })
    return toEvent(created)
  })
}

export async function updateDowntimeEvent(db: Db, actor: AuthUser, id: string, raw: DowntimeInput) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM downtime_events WHERE id = ${id} FOR UPDATE`
    if (locked.length === 0) throw notFound(`Event ${id} was not found.`)
    const current = await tx.downtimeEvent.findUniqueOrThrow({ where: { id }, include: { ...include, report: { select: { status: true } } } })
    // Operators change only events they recorded; supervisors manage all of them.
    if (actor.role === 'operator' && current.recordedById !== actor.id) throw forbidden('You can only change downtime events that you recorded.')
    if (isEventLocked(current.report?.status ?? null)) throw ruleViolation('This event belongs to an approved report and cannot be edited.')
    await lockMachines(tx, [current.machineId, typeof raw.machineId === 'string' ? raw.machineId : ''].filter(Boolean))
    const { input, machine, startTime, endTime } = await validateAgainstData(tx, raw, { excludeId: id, keepMachineId: current.machineId })
    const updated = await tx.downtimeEvent.update({
      where: { id },
      data: {
        lineId: machine.lineId,
        machineId: machine.id,
        orderId: input.orderId === '' ? null : input.orderId,
        reportId: input.reportId === '' ? null : input.reportId,
        startTime,
        endTime,
        category: input.category,
        notes: input.notes,
      },
      include,
    })
    return toEvent(updated)
  })
}
