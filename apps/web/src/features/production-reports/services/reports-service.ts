/**
 * Service boundary for production reports. Reads and writes go through the mock repository today;
 * when the API exists these functions call it instead, with no change to the UI.
 *
 * Business rules are enforced here (not only in the form), because hiding or disabling UI is not
 * security: the backend will have to enforce the same rules. Approving or returning a report is
 * Phase 6 and is deliberately not part of this service.
 */
import { downtimeMinutes } from '@/lib/kpi'
import { SHIFT_LABELS } from '@/lib/labels'
import { mockRepository } from '@/mocks/repository'
import { getFactoryToday } from '@/services/factory-clock'
import type { ActivityItem, ProductionReport, ReportHistoryEntry } from '@/types/domain'
import { buildReportFormSchema } from '../lib/report-form-schema'
import {
  buildReportId,
  canReportAgainstOrder,
  describeReportChanges,
  findSlotConflict,
  isReportDeletable,
  isReportEditable,
  reportMetrics,
  statusAfterSubmit,
} from '../lib/report-rules'
import type {
  ReportDetail,
  ReportDowntimeRow,
  ReportInput,
  ReportListItem,
  ReportReferenceData,
  ReportTimelineEntry,
  SaveMode,
} from '../types'

/** A business rule was broken. The message is safe to show to the user. */
export class ReportRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportRuleError'
  }
}

export async function getReportReference(): Promise<ReportReferenceData> {
  const [orders, products, lines, machines] = await Promise.all([
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listMachines(),
  ])
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const lineNames = new Map(lines.map((l) => [l.id, l.name]))
  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      productName: productNames.get(o.productId) ?? 'Unknown product',
      lineId: o.lineId,
      lineName: lineNames.get(o.lineId) ?? 'Unknown line',
      status: o.status,
      plannedStart: o.plannedStart,
    })),
    lines,
    machines,
    today: getFactoryToday(),
  }
}

export async function listReportItems(): Promise<ReportListItem[]> {
  const [reports, orders, products, lines, machines] = await Promise.all([
    mockRepository.listReports(),
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listMachines(),
  ])
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const productOfOrder = new Map(orders.map((o) => [o.id, productNames.get(o.productId) ?? 'Unknown product']))
  const lineNames = new Map(lines.map((l) => [l.id, l.name]))
  const machineNames = new Map(machines.map((m) => [m.id, m.name]))

  return reports.map((report) => ({
    report,
    productName: productOfOrder.get(report.orderId) ?? 'Unknown product',
    lineName: lineNames.get(report.lineId) ?? report.lineId,
    machineName: machineNames.get(report.machineId) ?? report.machineId,
    metrics: reportMetrics(report),
  }))
}

/** Returns null when the report does not exist. */
export async function getReportDetail(reportId: string): Promise<ReportDetail | null> {
  const [reports, orders, products, lines, machines, downtime, history, inspections, defects] = await Promise.all([
    mockRepository.listReports(),
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listMachines(),
    mockRepository.listDowntimeEvents(),
    mockRepository.listReportHistory(reportId),
    mockRepository.listInspections(),
    mockRepository.listDefectTypes(),
  ])
  const report = reports.find((r) => r.id === reportId)
  if (!report) return null

  const order = orders.find((o) => o.id === report.orderId)
  const downtimeRows: ReportDowntimeRow[] = []
  for (const e of downtime) {
    if (e.reportId !== report.id) continue
    const minutes = downtimeMinutes(e.startTime, e.endTime)
    if (minutes === null) continue
    downtimeRows.push({
      id: e.id,
      startTime: e.startTime,
      endTime: e.endTime,
      minutes,
      category: e.category,
      notes: e.notes,
      recordedBy: e.recordedBy,
    })
  }
  downtimeRows.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))

  // Entries saved in the same instant keep their real order: the later action is listed first.
  const timeline: ReportTimelineEntry[] = [...history]
    .reverse()
    .map((h) => ({
      id: h.id,
      timestamp: h.timestamp,
      actor: h.actor,
      description: HISTORY_VERBS[h.action],
      detail: h.detail,
    }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return {
    report,
    productName: products.find((p) => p.id === order?.productId)?.name ?? 'Unknown product',
    lineName: lines.find((l) => l.id === report.lineId)?.name ?? report.lineId,
    machineName: machines.find((m) => m.id === report.machineId)?.name ?? report.machineId,
    orderStatus: order?.status ?? null,
    metrics: reportMetrics(report),
    downtime: downtimeRows,
    inspections: inspections
      .filter((i) => i.reportId === report.id)
      .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate) || b.id.localeCompare(a.id))
      .map((i) => ({
        id: i.id,
        inspectionDate: i.inspectionDate,
        inspectedQuantity: i.inspectedQuantity,
        passedQuantity: i.passedQuantity,
        failedQuantity: i.failedQuantity,
        defectName: defects.find((d) => d.id === i.defectId)?.name ?? null,
        inspector: i.inspector,
      })),
    totalDowntimeMinutes: downtimeRows.reduce((sum, d) => sum + d.minutes, 0),
    timeline,
  }
}

const HISTORY_VERBS: Record<ReportHistoryEntry['action'], string> = {
  created: 'created the report',
  updated: 'updated the report',
  submitted: 'submitted the report for review',
  resubmitted: 'resubmitted the corrected report',
  approved: 'approved the report',
  returned: 'returned the report for correction',
  reopened: 'reopened the approved report for correction',
}

function historyEntry(
  reportId: string,
  actor: string,
  action: ReportHistoryEntry['action'],
  detail: string,
  timestamp: string,
): ReportHistoryEntry {
  return { id: `RH-${crypto.randomUUID()}`, reportId, timestamp, actor, action, detail }
}

function toInput(report: ProductionReport): ReportInput {
  return {
    orderId: report.orderId,
    machineId: report.machineId,
    shift: report.shift,
    reportDate: report.reportDate,
    producedQuantity: report.producedQuantity,
    rejectedQuantity: report.rejectedQuantity,
    notes: report.notes ?? '',
  }
}

function withNotes(report: ProductionReport, notes: string): ProductionReport {
  const { notes: _previous, ...rest } = report
  return notes === '' ? rest : { ...rest, notes }
}

function submittedActivity(report: ProductionReport, actor: string, timestamp: string): ActivityItem {
  return {
    id: `ACT-${crypto.randomUUID()}`,
    timestamp,
    actor,
    kind: 'report_submitted',
    orderId: report.orderId,
    reportId: report.id,
    subject: `${report.id} · ${report.orderId}`,
  }
}

/** Validation shared by create and update. Returns the cleaned input and the machine's line/target. */
async function validateInput(input: ReportInput, options: { excludeId?: string; requireInProgress?: boolean; keepMachineId?: string } = {}) {
  const [orders, machines, reports] = await Promise.all([
    mockRepository.listOrders(),
    mockRepository.listMachines(),
    mockRepository.listReports(),
  ])
  const order = orders.find((o) => o.id === input.orderId)
  if (!order) throw new ReportRuleError('Select a valid production order.')
  if (options.requireInProgress && !canReportAgainstOrder(order.status)) {
    throw new ReportRuleError('Reports can only be filed against orders that are In Progress.')
  }
  const machine = machines.find((m) => m.id === input.machineId)
  if (!machine) throw new ReportRuleError('Select a valid machine.')
  if (!machine.isActive && machine.id !== options.keepMachineId) {
    throw new ReportRuleError(`${machine.name} is inactive and cannot be used for new reports.`)
  }
  if (machine.lineId !== order.lineId) {
    throw new ReportRuleError("Select a machine on the order's production line.")
  }

  const parsed = buildReportFormSchema({
    today: getFactoryToday(),
    orderStarts: { [order.id]: order.plannedStart },
  }).safeParse(input)
  if (!parsed.success) throw new ReportRuleError(parsed.error.issues.map((i) => i.message).join('. '))

  const conflict = findSlotConflict(reports, parsed.data, options.excludeId)
  if (conflict) {
    throw new ReportRuleError(
      `${machine.name} already has a report for the ${SHIFT_LABELS[parsed.data.shift].toLowerCase()} shift on ${parsed.data.reportDate} (${conflict}).`,
    )
  }
  return { clean: parsed.data, order, machine, reports }
}

export async function createReport(input: ReportInput, mode: SaveMode, actor: string): Promise<ProductionReport> {
  const { clean, order, machine, reports } = await validateInput(input, { requireInProgress: true })
  const lines = await mockRepository.listLines()
  const line = lines.find((l) => l.id === order.lineId)
  if (!line) throw new ReportRuleError('The order has no valid production line.')

  const now = new Date().toISOString()
  const id = buildReportId(
    reports.map((r) => r.id),
    clean.reportDate,
    line.code,
    clean.shift,
  )
  const base: ProductionReport = {
    id,
    orderId: order.id,
    lineId: order.lineId,
    machineId: machine.id,
    shift: clean.shift,
    reportDate: clean.reportDate,
    operatorName: actor,
    shiftTarget: machine.shiftTarget,
    producedQuantity: clean.producedQuantity,
    rejectedQuantity: clean.rejectedQuantity,
    status: mode === 'submit' ? 'pending_review' : 'draft',
    createdAt: now,
    updatedAt: now,
    ...(mode === 'submit' ? { submittedAt: now } : {}),
  }
  const report = withNotes(base, clean.notes)

  const entries = [historyEntry(id, actor, 'created', 'Report created as a draft', now)]
  if (mode === 'submit') entries.push(historyEntry(id, actor, 'submitted', 'Submitted for review', now))
  return mockRepository.insertReport(report, entries, mode === 'submit' ? submittedActivity(report, actor, now) : undefined)
}

async function requireReport(reportId: string): Promise<ProductionReport> {
  const reports = await mockRepository.listReports()
  const report = reports.find((r) => r.id === reportId)
  if (!report) throw new ReportRuleError(`Report ${reportId} was not found.`)
  return report
}

/** Saves changes to a draft or returned report. With mode 'submit' it also sends it for review. */
export async function updateReport(
  reportId: string,
  input: ReportInput,
  mode: SaveMode,
  actor: string,
): Promise<ProductionReport> {
  const report = await requireReport(reportId)
  if (!isReportEditable(report.status)) {
    throw new ReportRuleError('Only draft or returned reports can be edited.')
  }
  if (input.orderId !== report.orderId) {
    throw new ReportRuleError('The production order of a report cannot be changed.')
  }
  const { clean, machine } = await validateInput(input, { excludeId: report.id, keepMachineId: report.machineId })

  const [machines] = await Promise.all([mockRepository.listMachines()])
  const display = (field: 'machineId' | 'shift' | 'reportDate' | 'producedQuantity' | 'rejectedQuantity' | 'notes', value: string | number): string => {
    if (field === 'machineId') return machines.find((m) => m.id === value)?.name ?? String(value)
    if (field === 'shift') return SHIFT_LABELS[value as 'morning' | 'night']
    return String(value)
  }
  const changes = describeReportChanges(toInput(report), clean, display)
  if (changes === '' && mode === 'draft') return report

  const now = new Date().toISOString()
  let updated: ProductionReport = withNotes(
    {
      ...report,
      machineId: machine.id,
      shift: clean.shift,
      reportDate: clean.reportDate,
      producedQuantity: clean.producedQuantity,
      rejectedQuantity: clean.rejectedQuantity,
      shiftTarget: machine.shiftTarget,
      updatedAt: now,
    },
    clean.notes,
  )

  const entries: ReportHistoryEntry[] = []
  if (changes !== '') entries.push(historyEntry(report.id, actor, 'updated', changes, now))

  let activity: ActivityItem | undefined
  if (mode === 'submit') {
    const next = statusAfterSubmit(report.status)
    if (!next) throw new ReportRuleError('This report cannot be submitted.')
    updated = { ...updated, status: next, submittedAt: now }
    const resubmitted = report.status === 'returned'
    entries.push(
      historyEntry(
        report.id,
        actor,
        resubmitted ? 'resubmitted' : 'submitted',
        resubmitted ? 'Corrected and resubmitted for review' : 'Submitted for review',
        now,
      ),
    )
    activity = submittedActivity(updated, actor, now)
  }
  return mockRepository.replaceReport(updated, entries, activity)
}

/** Submits a stored draft or returned report as it is. */
export async function submitReport(reportId: string, actor: string): Promise<ProductionReport> {
  const report = await requireReport(reportId)
  return updateReport(reportId, toInput(report), 'submit', actor)
}

export async function deleteReport(reportId: string): Promise<void> {
  const report = await requireReport(reportId)
  if (!isReportDeletable(report.status)) throw new ReportRuleError('Only draft reports can be deleted.')
  await mockRepository.deleteReport(reportId)
}
