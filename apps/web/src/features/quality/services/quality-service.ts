/**
 * Service boundary for quality inspections (mock backend today, API later). Rules are enforced here,
 * not only in the form: hiding or disabling UI is not security.
 */
import { mockRepository } from '@/mocks/repository'
import { getFactoryToday } from '@/services/factory-clock'
import type { QualityInspection } from '@/types/domain'
import { buildInspectionFormSchema } from '../lib/quality-form-schema'
import { canInspectOrder, nextInspectionId, passRate } from '../lib/quality-rules'
import type { InspectionInput, InspectionItem, QualityReferenceData } from '../types'

export class QualityRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QualityRuleError'
  }
}

export async function getQualityReference(): Promise<QualityReferenceData> {
  const [orders, products, lines, reports, defects] = await Promise.all([
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listReports(),
    mockRepository.listDefectTypes(),
  ])
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const lineNames = new Map(lines.map((l) => [l.id, l.name]))
  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      productName: productNames.get(o.productId) ?? 'Unknown product',
      lineName: lineNames.get(o.lineId) ?? 'Unknown line',
      status: o.status,
      plannedStart: o.plannedStart,
    })),
    reports: reports.map((r) => ({ id: r.id, orderId: r.orderId, reportDate: r.reportDate, producedQuantity: r.producedQuantity, status: r.status })),
    defects,
    today: getFactoryToday(),
  }
}

export async function listInspectionItems(): Promise<InspectionItem[]> {
  const [inspections, orders, products, lines, reports, defects] = await Promise.all([
    mockRepository.listInspections(),
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listReports(),
    mockRepository.listDefectTypes(),
  ])
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const lineOfOrder = new Map(orders.map((o) => [o.id, lines.find((l) => l.id === o.lineId)?.name ?? 'Unknown line']))
  const reportStatus = new Map(reports.map((r) => [r.id, r.status]))
  const defectNames = new Map(defects.map((d) => [d.id, d.name]))
  return inspections.map((inspection) => ({
    inspection,
    productName: productNames.get(inspection.productId) ?? 'Unknown product',
    lineName: lineOfOrder.get(inspection.orderId) ?? 'Unknown line',
    defectName: inspection.defectId ? (defectNames.get(inspection.defectId) ?? null) : null,
    reportStatus: inspection.reportId ? (reportStatus.get(inspection.reportId) ?? null) : null,
    passRate: passRate(inspection.passedQuantity, inspection.inspectedQuantity),
  }))
}

/** Returns null when the inspection does not exist. */
export async function getInspectionItem(inspectionId: string): Promise<InspectionItem | null> {
  return (await listInspectionItems()).find((i) => i.inspection.id === inspectionId) ?? null
}

async function validateInput(input: InspectionInput, keepDefectId = '') {
  const [orders, reports, defects] = await Promise.all([
    mockRepository.listOrders(),
    mockRepository.listReports(),
    mockRepository.listDefectTypes(),
  ])
  const order = orders.find((o) => o.id === input.orderId)
  if (!order) throw new QualityRuleError('Select a valid production order.')

  const parsed = buildInspectionFormSchema({ today: getFactoryToday(), orderStarts: { [order.id]: order.plannedStart } }).safeParse(input)
  if (!parsed.success) throw new QualityRuleError(parsed.error.issues.map((i) => i.message).join('. '))
  const clean = parsed.data

  if (clean.reportId !== '') {
    const report = reports.find((r) => r.id === clean.reportId)
    if (!report) throw new QualityRuleError('Select a valid production report.')
    if (report.orderId !== order.id) throw new QualityRuleError('The report belongs to a different production order.')
    if (clean.inspectedQuantity > report.producedQuantity) {
      throw new QualityRuleError(`Inspected quantity cannot be more than the ${report.producedQuantity} produced on ${report.id}.`)
    }
  }
  // A defect is only kept when something failed.
  const defectId = clean.failedQuantity > 0 ? clean.defectId : ''
  const defect = defects.find((d) => d.id === defectId)
  if (defectId !== '' && !defect) throw new QualityRuleError('Select a valid defect classification.')
  if (defect && !defect.isActive && defect.id !== keepDefectId) {
    throw new QualityRuleError(`${defect.name} is inactive and cannot be chosen.`)
  }
  return { clean, order, defectId }
}

export async function createInspection(input: InspectionInput, actor: string): Promise<QualityInspection> {
  const { clean, order, defectId } = await validateInput(input)
  if (!canInspectOrder(order.status)) {
    throw new QualityRuleError('Inspections can only be recorded for orders that are In Progress or Completed.')
  }
  const existing = await mockRepository.listInspections()
  const now = new Date().toISOString()
  const inspection: QualityInspection = {
    id: nextInspectionId(existing.map((i) => i.id), getFactoryToday().slice(0, 4)),
    orderId: order.id,
    ...(clean.reportId !== '' ? { reportId: clean.reportId } : {}),
    productId: order.productId,
    inspectionDate: clean.inspectionDate,
    inspectedQuantity: clean.inspectedQuantity,
    passedQuantity: clean.inspectedQuantity - clean.failedQuantity,
    failedQuantity: clean.failedQuantity,
    ...(defectId !== '' ? { defectId } : {}),
    notes: clean.notes,
    inspector: actor,
    createdAt: now,
    updatedAt: now,
  }
  return mockRepository.insertInspection(inspection)
}

export async function updateInspection(inspectionId: string, input: InspectionInput): Promise<QualityInspection> {
  const current = await getInspectionItem(inspectionId)
  if (!current) throw new QualityRuleError(`Inspection ${inspectionId} was not found.`)
  if (input.orderId !== current.inspection.orderId) {
    throw new QualityRuleError('The production order of an inspection cannot be changed.')
  }
  const { clean, defectId } = await validateInput(input, current.inspection.defectId ?? '')
  const { reportId: _r, defectId: _d, ...rest } = current.inspection
  return mockRepository.replaceInspection({
    ...rest,
    ...(clean.reportId !== '' ? { reportId: clean.reportId } : {}),
    inspectionDate: clean.inspectionDate,
    inspectedQuantity: clean.inspectedQuantity,
    passedQuantity: clean.inspectedQuantity - clean.failedQuantity,
    failedQuantity: clean.failedQuantity,
    ...(defectId !== '' ? { defectId } : {}),
    notes: clean.notes,
    updatedAt: new Date().toISOString(),
  })
}
