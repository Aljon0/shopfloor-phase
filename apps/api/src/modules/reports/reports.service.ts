import {
  buildReportId,
  canReportAgainstOrder,
  canSubmitReport,
  describeReportChanges,
  downtimeMinutes,
  findSlotConflict,
  isReportDeletable,
  isReportEditable,
  reportMetrics,
  statusAfterSubmit,
  validateReportInput,
  type ReportInput,
  type ReportStatus,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest, forbidden, notFound, ruleViolation } from '../../lib/errors'
import { newId } from '../../lib/ids'
import type { AuthUser } from '../../middleware/context'
import { factoryToday } from '../orders/orders.service'

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]
export type SaveMode = 'draft' | 'submit'

const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`)
const fromDate = (d: Date): string => d.toISOString().slice(0, 10)
const SHIFT_LABEL: Record<string, string> = { morning: 'morning', night: 'night' }

export const reportInclude = {
  operator: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} as const

export interface ReportRow {
  id: string
  orderId: string
  lineId: string
  machineId: string
  shiftId: string
  reportDate: Date
  operatorId: string
  shiftTarget: number
  producedQuantity: number
  rejectedQuantity: number
  status: ReportStatus
  submittedAt: Date | null
  reviewedAt: Date | null
  returnReason: string | null
  notes: string
  createdAt: Date
  updatedAt: Date
  operator: { name: string }
  reviewedBy: { name: string } | null
}

/** JSON shape equals the web's ProductionReport (plus operatorId, which the UI uses for ownership). */
export function toReport(r: ReportRow) {
  return {
    id: r.id,
    orderId: r.orderId,
    lineId: r.lineId,
    machineId: r.machineId,
    shift: r.shiftId,
    reportDate: fromDate(r.reportDate),
    operatorName: r.operator.name,
    operatorId: r.operatorId,
    shiftTarget: r.shiftTarget,
    producedQuantity: r.producedQuantity,
    rejectedQuantity: r.rejectedQuantity,
    status: r.status,
    ...(r.submittedAt ? { submittedAt: r.submittedAt.toISOString() } : {}),
    ...(r.reviewedAt ? { reviewedAt: r.reviewedAt.toISOString() } : {}),
    ...(r.reviewedBy ? { reviewedBy: r.reviewedBy.name } : {}),
    ...(r.returnReason ? { returnReason: r.returnReason } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// ------------------------------------------------------------------- reads
export async function getReference(db: Db) {
  const [orders, lines, machines] = await Promise.all([
    db.productionOrder.findMany({ include: { product: { select: { name: true } }, line: { select: { name: true } } }, orderBy: { orderNumber: 'desc' } }),
    db.productionLine.findMany({ orderBy: { name: 'asc' } }),
    db.machine.findMany({ orderBy: { name: 'asc' } }),
  ])
  return {
    orders: orders.map((o) => ({ id: o.orderNumber, orderNumber: o.orderNumber, productName: o.product.name, lineId: o.lineId, lineName: o.line.name, status: o.status, plannedStart: fromDate(o.plannedStart) })),
    lines: lines.map((l) => ({ id: l.id, name: l.name, code: l.code, isActive: l.isActive })),
    machines: machines.map((m) => ({ id: m.id, name: m.name, lineId: m.lineId, shiftTarget: m.shiftTarget, isActive: m.isActive })),
    today: factoryToday(),
  }
}

export async function listReports(db: Db) {
  const rows = await db.productionReport.findMany({
    include: { ...reportInclude, order: { select: { product: { select: { name: true } } } }, line: { select: { name: true } }, machine: { select: { name: true } } },
    orderBy: [{ reportDate: 'desc' }, { id: 'asc' }],
  })
  return rows.map((r) => ({ report: toReport(r), productName: r.order.product.name, lineName: r.line.name, machineName: r.machine.name, metrics: reportMetrics(r) }))
}

export async function getReportDetail(db: Db, reportId: string) {
  const r = await db.productionReport.findUnique({
    where: { id: reportId },
    include: {
      ...reportInclude,
      order: { select: { status: true, product: { select: { name: true } } } },
      line: { select: { name: true } },
      machine: { select: { name: true } },
      history: { include: { actor: { select: { name: true } } } },
      downtime: { include: { recordedBy: { select: { name: true } } } },
      inspections: { include: { defect: { select: { name: true } }, inspector: { select: { name: true } } } },
    },
  })
  if (!r) throw notFound(`Report ${reportId} was not found.`)

  const verbs: Record<string, string> = {
    created: 'created the report',
    updated: 'updated the report',
    submitted: 'submitted the report for review',
    resubmitted: 'resubmitted the corrected report',
    approved: 'approved the report',
    returned: 'returned the report for correction',
    reopened: 'reopened the approved report for correction',
  }
  const downtime = r.downtime
    .flatMap((e) => {
      const minutes = downtimeMinutes(e.startTime.toISOString(), e.endTime.toISOString())
      return minutes === null ? [] : [{ id: e.id, startTime: e.startTime.toISOString(), endTime: e.endTime.toISOString(), minutes, category: e.category, notes: e.notes, recordedBy: e.recordedBy.name }]
    })
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
  const timeline = [...r.history]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .map((h) => ({ id: h.id, timestamp: h.timestamp.toISOString(), actor: h.actor.name, description: verbs[h.action] ?? h.action, detail: h.detail }))

  return {
    report: toReport(r),
    productName: r.order.product.name,
    lineName: r.line.name,
    machineName: r.machine.name,
    orderStatus: r.order.status,
    metrics: reportMetrics(r),
    downtime,
    inspections: r.inspections
      .map((i) => ({ id: i.id, inspectionDate: fromDate(i.inspectionDate), inspectedQuantity: i.inspectedQuantity, passedQuantity: i.passedQuantity, failedQuantity: i.failedQuantity, defectName: i.defect?.name ?? null, inspector: i.inspector.name }))
      .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate) || b.id.localeCompare(a.id)),
    totalDowntimeMinutes: downtime.reduce((sum, d) => sum + d.minutes, 0),
    timeline,
  }
}

// ------------------------------------------------------------------ writes
export async function addHistory(tx: Tx, reportId: string, actor: AuthUser, action: string, detail: string): Promise<void> {
  // Timestamps only have millisecond precision, so two steps in one request could tie and lose their order.
  // Each entry is stamped at least 1 ms after the previous one for this report, so the order is always exact.
  const latest = await tx.reportHistory.findFirst({ where: { reportId }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } })
  const now = Date.now()
  const timestamp = new Date(latest && latest.timestamp.getTime() >= now ? latest.timestamp.getTime() + 1 : now)
  await tx.reportHistory.create({ data: { id: newId('rh'), reportId, actorId: actor.id, action, detail, timestamp } })
}

/** Locks the report row so two people acting on the same report take turns instead of overwriting each other. */
export async function lockReport(tx: Tx, reportId: string): Promise<ReportRow> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM production_reports WHERE id = ${reportId} FOR UPDATE`
  if (locked.length === 0) throw notFound(`Report ${reportId} was not found.`)
  const row = await tx.productionReport.findUnique({ where: { id: reportId }, include: reportInclude })
  if (!row) throw notFound(`Report ${reportId} was not found.`)
  return row
}

function toInput(r: ReportRow): ReportInput {
  return {
    orderId: r.orderId,
    machineId: r.machineId,
    shift: r.shiftId as ReportInput['shift'],
    reportDate: fromDate(r.reportDate),
    producedQuantity: r.producedQuantity,
    rejectedQuantity: r.rejectedQuantity,
    notes: r.notes,
  }
}

function assertValid(input: ReportInput, orderStart: string | undefined): ReportInput {
  const errors = validateReportInput(input, { today: factoryToday(), orderStart })
  const messages = Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === 'string')
  if (messages.length > 0) throw badRequest('Some fields are not valid.', Object.fromEntries(messages))
  return { ...input, notes: input.notes.trim() }
}

/** An operator changes only their own reports. */
function assertOwner(report: ReportRow, actor: AuthUser): void {
  if (report.operatorId !== actor.id) throw forbidden('You can only change reports that you filed.')
}

async function validateAgainstData(tx: Tx, input: ReportInput, opts: { excludeId?: string; requireInProgress?: boolean; keepMachineId?: string }) {
  const order = await tx.productionOrder.findUnique({ where: { orderNumber: input.orderId }, include: { line: true } })
  if (!order) throw badRequest('Some fields are not valid.', { orderId: 'Select a valid production order.' })
  if (opts.requireInProgress && !canReportAgainstOrder(order.status)) throw ruleViolation('Reports can only be filed against orders that are In Progress.')
  const machine = await tx.machine.findUnique({ where: { id: input.machineId } })
  if (!machine) throw badRequest('Some fields are not valid.', { machineId: 'Select a valid machine.' })
  if (!machine.isActive && machine.id !== opts.keepMachineId) throw ruleViolation(`${machine.name} is inactive and cannot be used for new reports.`)
  if (machine.lineId !== order.lineId) throw ruleViolation("Select a machine on the order's production line.")
  const shift = await tx.shift.findUnique({ where: { id: input.shift } })
  if (!shift) throw badRequest('Some fields are not valid.', { shift: 'Select a shift' })

  const clean = assertValid(input, fromDate(order.plannedStart))
  const sameSlot = await tx.productionReport.findMany({ where: { machineId: clean.machineId, shiftId: clean.shift, reportDate: toDate(clean.reportDate) }, select: { id: true, machineId: true, shiftId: true, reportDate: true } })
  const conflict = findSlotConflict(
    sameSlot.map((s) => ({ id: s.id, machineId: s.machineId, shift: s.shiftId, reportDate: fromDate(s.reportDate) })),
    clean,
    opts.excludeId,
  )
  if (conflict) throw ruleViolation(`${machine.name} already has a report for the ${SHIFT_LABEL[clean.shift]} shift on ${clean.reportDate} (${conflict}).`)
  return { clean, order, machine }
}

export async function createReport(db: Db, actor: AuthUser, rawInput: ReportInput, mode: SaveMode) {
  return db.$transaction(async (tx) => {
    // One report number at a time, so simultaneous reports on one line, shift and day get different numbers.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production_report_number'))`
    const { clean, order, machine } = await validateAgainstData(tx, rawInput, { requireInProgress: true })
    const prefix = `RPT-${clean.reportDate.replace(/-/g, '')}-${order.line.code}-`
    const taken = await tx.productionReport.findMany({ where: { id: { startsWith: prefix } }, select: { id: true } })
    const id = buildReportId(taken.map((t) => t.id), clean.reportDate, order.line.code, clean.shift)
    const now = new Date()
    const created = await tx.productionReport.create({
      data: {
        id,
        orderId: order.orderNumber,
        lineId: order.lineId,
        machineId: machine.id,
        shiftId: clean.shift,
        reportDate: toDate(clean.reportDate),
        operatorId: actor.id,
        shiftTarget: machine.shiftTarget,
        producedQuantity: clean.producedQuantity,
        rejectedQuantity: clean.rejectedQuantity,
        status: mode === 'submit' ? 'pending_review' : 'draft',
        ...(mode === 'submit' ? { submittedAt: now } : {}),
        notes: clean.notes,
      },
      include: reportInclude,
    })
    await addHistory(tx, id, actor, 'created', 'Report created as a draft')
    if (mode === 'submit') await addHistory(tx, id, actor, 'submitted', 'Submitted for review')
    return toReport(created)
  })
}

export async function updateReport(db: Db, actor: AuthUser, reportId: string, rawInput: ReportInput, mode: SaveMode) {
  return db.$transaction(async (tx) => {
    const report = await lockReport(tx, reportId)
    assertOwner(report, actor)
    if (!isReportEditable(report.status)) throw ruleViolation('Only draft or returned reports can be edited.')
    if (rawInput.orderId !== report.orderId) throw ruleViolation('The production order of a report cannot be changed.')
    const { clean, machine } = await validateAgainstData(tx, rawInput, { excludeId: report.id, keepMachineId: report.machineId })

    const oldMachine = machine.id === report.machineId ? machine : await tx.machine.findUnique({ where: { id: report.machineId } })
    const names: Record<string, string> = { [report.machineId]: oldMachine?.name ?? report.machineId, [machine.id]: machine.name }
    const changes = describeReportChanges(toInput(report), clean, (field, value) =>
      field === 'machineId' ? names[String(value)] ?? String(value) : field === 'shift' ? (value === 'morning' ? 'Morning' : 'Night') : String(value),
    )
    if (changes === '' && mode === 'draft') return toReport(report)

    let status: ReportStatus = report.status
    let submittedAt: Date | undefined
    let resubmitted = false
    if (mode === 'submit') {
      if (!canSubmitReport(report.status)) throw ruleViolation('This report cannot be submitted.')
      const next = statusAfterSubmit(report.status)
      if (!next) throw ruleViolation('This report cannot be submitted.')
      status = next
      submittedAt = new Date()
      resubmitted = report.status === 'returned'
    }
    const updated = await tx.productionReport.update({
      where: { id: reportId },
      data: {
        machineId: machine.id,
        shiftId: clean.shift,
        reportDate: toDate(clean.reportDate),
        producedQuantity: clean.producedQuantity,
        rejectedQuantity: clean.rejectedQuantity,
        shiftTarget: machine.shiftTarget,
        notes: clean.notes,
        status,
        ...(submittedAt ? { submittedAt } : {}),
      },
      include: reportInclude,
    })
    if (changes !== '') await addHistory(tx, reportId, actor, 'updated', changes)
    if (mode === 'submit') await addHistory(tx, reportId, actor, resubmitted ? 'resubmitted' : 'submitted', resubmitted ? 'Corrected and resubmitted for review' : 'Submitted for review')
    return toReport(updated)
  })
}

/** Submits a stored draft or returned report as it is. */
export async function submitReport(db: Db, actor: AuthUser, reportId: string) {
  const current = await db.productionReport.findUnique({ where: { id: reportId }, include: reportInclude })
  if (!current) throw notFound(`Report ${reportId} was not found.`)
  assertOwner(current, actor)
  return updateReport(db, actor, reportId, toInput(current), 'submit')
}

export async function deleteReport(db: Db, actor: AuthUser, reportId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const report = await lockReport(tx, reportId)
    assertOwner(report, actor)
    if (!isReportDeletable(report.status)) throw ruleViolation('Only draft reports can be deleted.')
    const [downtime, inspections] = await Promise.all([tx.downtimeEvent.count({ where: { reportId } }), tx.qualityInspection.count({ where: { reportId } })])
    if (downtime + inspections > 0) throw ruleViolation('This draft has downtime or inspections linked to it, so it cannot be deleted.')
    await tx.reportHistory.deleteMany({ where: { reportId } })
    await tx.productionReport.delete({ where: { id: reportId } })
  })
}
