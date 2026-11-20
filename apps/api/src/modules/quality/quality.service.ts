import {
  canInspectOrder,
  nextInspectionId,
  passRate,
  validateInspectionInput,
  type InspectionInput,
  type ReportStatus,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest, notFound, ruleViolation } from '../../lib/errors'
import type { AuthUser } from '../../middleware/context'
import { factoryToday } from '../orders/orders.service'

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]
const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`)
const fromDate = (d: Date): string => d.toISOString().slice(0, 10)

interface InspectionRow {
  id: string
  orderId: string
  reportId: string | null
  productId: string
  inspectionDate: Date
  inspectedQuantity: number
  passedQuantity: number
  failedQuantity: number
  defectId: string | null
  notes: string
  createdAt: Date
  updatedAt: Date
  inspector: { name: string }
}

const include = { inspector: { select: { name: true } } } as const

/** JSON shape equals the web's QualityInspection. */
function toInspection(i: InspectionRow) {
  return {
    id: i.id,
    orderId: i.orderId,
    ...(i.reportId ? { reportId: i.reportId } : {}),
    productId: i.productId,
    inspectionDate: fromDate(i.inspectionDate),
    inspectedQuantity: i.inspectedQuantity,
    passedQuantity: i.passedQuantity,
    failedQuantity: i.failedQuantity,
    ...(i.defectId ? { defectId: i.defectId } : {}),
    notes: i.notes,
    inspector: i.inspector.name,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }
}

// ------------------------------------------------------------------- reads
export async function getReference(db: Db) {
  const [orders, reports, defects] = await Promise.all([
    db.productionOrder.findMany({ include: { product: { select: { name: true } }, line: { select: { name: true } } }, orderBy: { orderNumber: 'desc' } }),
    db.productionReport.findMany({ select: { id: true, orderId: true, reportDate: true, producedQuantity: true, status: true }, orderBy: { id: 'desc' } }),
    db.defectType.findMany({ orderBy: { name: 'asc' } }),
  ])
  return {
    orders: orders.map((o) => ({ id: o.orderNumber, orderNumber: o.orderNumber, productName: o.product.name, lineName: o.line.name, status: o.status, plannedStart: fromDate(o.plannedStart) })),
    reports: reports.map((r) => ({ id: r.id, orderId: r.orderId, reportDate: fromDate(r.reportDate), producedQuantity: r.producedQuantity, status: r.status })),
    defects: defects.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive })),
    today: factoryToday(),
  }
}

const itemInclude = {
  ...include,
  order: { select: { line: { select: { name: true } } } },
  product: { select: { name: true } },
  defect: { select: { name: true } },
  report: { select: { status: true } },
} as const

function toItem(i: InspectionRow & { order: { line: { name: string } }; product: { name: string }; defect: { name: string } | null; report: { status: ReportStatus } | null }) {
  return {
    inspection: toInspection(i),
    productName: i.product.name,
    lineName: i.order.line.name,
    defectName: i.defect?.name ?? null,
    reportStatus: i.report?.status ?? null,
    passRate: passRate(i.passedQuantity, i.inspectedQuantity),
  }
}

export async function listInspectionItems(db: Db) {
  const rows = await db.qualityInspection.findMany({ include: itemInclude, orderBy: [{ inspectionDate: 'desc' }, { id: 'desc' }] })
  return rows.map(toItem)
}

export async function getInspectionItem(db: Db, id: string) {
  const row = await db.qualityInspection.findUnique({ where: { id }, include: itemInclude })
  if (!row) throw notFound(`Inspection ${id} was not found.`)
  return toItem(row)
}

// ------------------------------------------------------------------ writes
async function validateAgainstData(tx: Tx, input: InspectionInput, keepDefectId: string) {
  const order = await tx.productionOrder.findUnique({ where: { orderNumber: input.orderId } })
  if (!order) throw badRequest('Some fields are not valid.', { orderId: 'Select a valid production order.' })

  const errors = validateInspectionInput(input, { today: factoryToday(), orderStart: fromDate(order.plannedStart) })
  const messages = Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === 'string')
  if (messages.length > 0) throw badRequest('Some fields are not valid.', Object.fromEntries(messages))
  const clean = { ...input, notes: input.notes.trim() }

  if (clean.reportId !== '') {
    // Lock the report so its quantities cannot change between this check and the save.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM production_reports WHERE id = ${clean.reportId} FOR UPDATE`
    const report = locked.length === 0 ? null : await tx.productionReport.findUnique({ where: { id: clean.reportId } })
    if (!report) throw badRequest('Some fields are not valid.', { reportId: 'Select a valid production report.' })
    if (report.orderId !== order.orderNumber) throw ruleViolation('The report belongs to a different production order.')
    if (clean.inspectedQuantity > report.producedQuantity) {
      throw ruleViolation(`Inspected quantity cannot be more than the ${report.producedQuantity} produced on ${report.id}.`)
    }
  }
  // A defect is only kept when something failed.
  const defectId = clean.failedQuantity > 0 ? clean.defectId : ''
  if (defectId !== '') {
    const defect = await tx.defectType.findUnique({ where: { id: defectId } })
    if (!defect) throw badRequest('Some fields are not valid.', { defectId: 'Select a valid defect classification.' })
    if (!defect.isActive && defect.id !== keepDefectId) throw ruleViolation(`${defect.name} is inactive and cannot be chosen.`)
  }
  return { clean, order, defectId }
}

export async function createInspection(db: Db, actor: AuthUser, raw: InspectionInput) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('quality_inspection_number'))`
    const { clean, order, defectId } = await validateAgainstData(tx, raw, '')
    if (!canInspectOrder(order.status)) throw ruleViolation('Inspections can only be recorded for orders that are In Progress or Completed.')
    const year = factoryToday().slice(0, 4)
    const existing = await tx.qualityInspection.findMany({ where: { id: { startsWith: `QI-${year}-` } }, select: { id: true } })
    const id = nextInspectionId(existing.map((e) => e.id), year)
    const created = await tx.qualityInspection.create({
      data: {
        id,
        orderId: order.orderNumber,
        reportId: clean.reportId === '' ? null : clean.reportId,
        productId: order.productId,
        inspectionDate: toDate(clean.inspectionDate),
        inspectedQuantity: clean.inspectedQuantity,
        passedQuantity: clean.inspectedQuantity - clean.failedQuantity,
        failedQuantity: clean.failedQuantity,
        defectId: defectId === '' ? null : defectId,
        notes: clean.notes,
        inspectorId: actor.id,
      },
      include,
    })
    return toInspection(created)
  })
}

export async function updateInspection(db: Db, id: string, raw: InspectionInput) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM quality_inspections WHERE id = ${id} FOR UPDATE`
    if (locked.length === 0) throw notFound(`Inspection ${id} was not found.`)
    const current = await tx.qualityInspection.findUniqueOrThrow({ where: { id } })
    if (raw.orderId !== current.orderId) throw ruleViolation('The production order of an inspection cannot be changed.')
    const { clean, defectId } = await validateAgainstData(tx, raw, current.defectId ?? '')
    const updated = await tx.qualityInspection.update({
      where: { id },
      data: {
        reportId: clean.reportId === '' ? null : clean.reportId,
        inspectionDate: toDate(clean.inspectionDate),
        inspectedQuantity: clean.inspectedQuantity,
        passedQuantity: clean.inspectedQuantity - clean.failedQuantity,
        failedQuantity: clean.failedQuantity,
        defectId: defectId === '' ? null : defectId,
        notes: clean.notes,
      },
      include,
    })
    return toInspection(updated)
  })
}

