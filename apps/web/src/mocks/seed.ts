/**
 * Deterministic mock dataset for Northstar Metalworks (fictional). All figures are illustrative.
 *
 * Every dashboard figure is derived from these records, so KPIs, charts, tables and exports agree.
 * Includes the blueprint sample scenario: PO-2026-001, Steel mounting brackets, 500 planned,
 * Cutting Line 01, Morning shift, 210 produced / 8 rejected / 202 good, 35 min machine maintenance.
 */
import { addDays, eachDate } from '@/lib/dates'
import type {
  ActivityItem,
  AppUser,
  ShiftConfig,
  DowntimeCategory,
  DefectType,
  DowntimeEvent,
  Machine,
  OrderHistoryEntry,
  Priority,
  Product,
  ProductionLine,
  ProductionOrder,
  ProductionReport,
  QualityInspection,
  ReportHistoryEntry,
  ShiftId,
} from '@/types/domain'
import type { ReportStatus } from '@/types/status'

/** "Today" in the mock factory. Replaced by the real factory-local date once an API exists. */
export const FACTORY_TODAY = '2026-11-07'
/** Mock "current time": end of the last mock day. Used to keep review timestamps in the past. */
const FACTORY_NOW_MS = Date.parse('2026-11-07T23:00:00+08:00')
const FIRST_DATE = '2026-10-26'
const SUPERVISOR = 'Rosa Villanueva'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20261107)

function pick<T>(items: readonly T[], r: number): T {
  const item = items[Math.min(items.length - 1, Math.floor(r * items.length))]
  if (item === undefined) throw new Error('pick() called with an empty list')
  return item
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Builds a factory-local (UTC+8) ISO timestamp from a date and minutes after midnight. */
function toIso(date: string, minutes: number): string {
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00+08:00`
}

export const LINES: ProductionLine[] = [
  { id: 'line-cut-01', name: 'Cutting Line 01', code: 'CUT', isActive: true },
  { id: 'line-bend-01', name: 'Bending Line 01', code: 'BND', isActive: true },
  { id: 'line-weld-01', name: 'Welding Line 01', code: 'WLD', isActive: true },
]

export const PRODUCTS: Product[] = [
  { id: 'prod-bracket', name: 'Steel mounting brackets', isActive: true },
  { id: 'prod-frame', name: 'Fabricated steel frames', isActive: true },
  { id: 'prod-panel', name: 'Metal panels', isActive: true },
  { id: 'prod-custom', name: 'Custom metal components', isActive: true },
]

export const MACHINES: Machine[] = [
  { id: 'mc-lc-01', name: 'Laser Cutter LC-01', lineId: 'line-cut-01', shiftTarget: 250, isActive: true },
  { id: 'mc-sh-02', name: 'Shear SH-02', lineId: 'line-cut-01', shiftTarget: 250, isActive: true },
  { id: 'mc-pb-01', name: 'Press Brake PB-01', lineId: 'line-bend-01', shiftTarget: 220, isActive: true },
  { id: 'mc-pb-02', name: 'Press Brake PB-02', lineId: 'line-bend-01', shiftTarget: 220, isActive: true },
  { id: 'mc-wc-01', name: 'Welding Cell WC-01', lineId: 'line-weld-01', shiftTarget: 180, isActive: true },
  { id: 'mc-wc-02', name: 'Welding Cell WC-02', lineId: 'line-weld-01', shiftTarget: 180, isActive: true },
]

const SHIFTS: readonly ShiftId[] = ['morning', 'night']

interface LineConfig {
  lineId: string
  code: string
  shiftTarget: number
  machineIds: Record<ShiftId, string>
  operators: Record<ShiftId, string>
}

const LINE_CONFIGS: LineConfig[] = [
  {
    lineId: 'line-cut-01',
    code: 'CUT',
    shiftTarget: 250,
    machineIds: { morning: 'mc-lc-01', night: 'mc-sh-02' },
    operators: { morning: 'Juan Dela Cruz', night: 'Mark Bautista' },
  },
  {
    lineId: 'line-bend-01',
    code: 'BND',
    shiftTarget: 220,
    machineIds: { morning: 'mc-pb-01', night: 'mc-pb-02' },
    operators: { morning: 'Maria Reyes', night: 'Carlo Mendoza' },
  },
  {
    lineId: 'line-weld-01',
    code: 'WLD',
    shiftTarget: 180,
    machineIds: { morning: 'mc-wc-01', night: 'mc-wc-02' },
    operators: { morning: 'Jose Ramos', night: 'Ana Lim' },
  },
]

interface OrderConfig {
  orderNumber: string
  productId: string
  lineId: string
  /** Reports dated within [start, end] on this line belong to the order. */
  start: string
  end: string
  priority: Priority
  instructions: string
  /** Fixed planned quantity; otherwise derived from the order's reports. */
  fixedPlanned?: number
}

const ORDER_CONFIGS: OrderConfig[] = [
  { orderNumber: 'PO-2026-002', productId: 'prod-panel', lineId: 'line-cut-01', start: '2026-10-26', end: '2026-11-02', priority: 'normal', instructions: 'Cut 2 mm cold-rolled sheet to panel blanks.' },
  { orderNumber: 'PO-2026-001', productId: 'prod-bracket', lineId: 'line-cut-01', start: '2026-11-03', end: '2026-11-03', priority: 'high', instructions: 'Cut 3 mm steel plate to bracket blanks. Deburr edges.', fixedPlanned: 500 },
  { orderNumber: 'PO-2026-003', productId: 'prod-bracket', lineId: 'line-cut-01', start: '2026-11-04', end: '2026-11-07', priority: 'normal', instructions: 'Second bracket batch. Check blank dimensions every 50 pieces.' },
  { orderNumber: 'PO-2026-004', productId: 'prod-custom', lineId: 'line-bend-01', start: '2026-10-26', end: '2026-11-04', priority: 'low', instructions: 'Customer drawing rev C. Bend angle tolerance +/- 1 degree.' },
  { orderNumber: 'PO-2026-005', productId: 'prod-frame', lineId: 'line-bend-01', start: '2026-11-05', end: '2026-11-07', priority: 'high', instructions: 'Bend frame members per drawing FR-120.' },
  { orderNumber: 'PO-2026-006', productId: 'prod-frame', lineId: 'line-weld-01', start: '2026-10-26', end: '2026-11-05', priority: 'normal', instructions: 'MIG weld frame assemblies. Visual weld check before release.' },
  { orderNumber: 'PO-2026-007', productId: 'prod-custom', lineId: 'line-weld-01', start: '2026-11-06', end: '2026-11-07', priority: 'urgent', instructions: 'Rush order. Weld and grind flush.' },
]

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function orderConfigFor(lineId: string, date: string): OrderConfig {
  const found = ORDER_CONFIGS.find((o) => o.lineId === lineId && date >= o.start && date <= o.end)
  if (!found) throw new Error(`No mock order covers ${lineId} on ${date}`)
  return found
}

function reportStatusFor(date: string, shift: ShiftId, lineIndex: number, shiftIndex: number): ReportStatus {
  if (date <= '2026-11-04') return 'approved'
  if (date < FACTORY_TODAY) {
    const dayOfMonth = Number(date.slice(8, 10))
    return (dayOfMonth + lineIndex + shiftIndex) % 4 === 0 ? 'pending_review' : 'approved'
  }
  const morning: ReportStatus[] = ['approved', 'pending_review', 'returned']
  const night: ReportStatus[] = ['pending_review', 'draft', 'pending_review']
  return (shift === 'morning' ? morning : night)[lineIndex] ?? 'draft'
}

const DOWNTIME_CATEGORIES: readonly DowntimeCategory[] = [
  'machine_maintenance',
  'equipment_failure',
  'equipment_failure',
  'material_shortage',
  'changeover',
  'changeover',
  'operator_delay',
  'other',
]

const DOWNTIME_NOTES: Record<DowntimeCategory, string> = {
  machine_maintenance: 'Routine maintenance and lubrication.',
  equipment_failure: 'Unplanned stop, machine reset required.',
  material_shortage: 'Waiting for raw material delivery to the line.',
  changeover: 'Tooling and fixture change for next job.',
  operator_delay: 'Operator reassigned during shift handover.',
  other: 'Short stop, reason not classified.',
}

const SCENARIO_DATE = '2026-11-03'

const reportDrafts: ProductionReport[] = []
const reportHistory: ReportHistoryEntry[] = []

/** Audit entries implied by a seeded report's own timestamps. */
function historyFor(report: ProductionReport): ReportHistoryEntry[] {
  const entry = (n: number, timestamp: string, actor: string, action: ReportHistoryEntry['action'], detail: string): ReportHistoryEntry => ({
    id: `RH-${report.id}-${n}`,
    reportId: report.id,
    timestamp,
    actor,
    action,
    detail,
  })
  const entries = [entry(1, report.createdAt, report.operatorName, 'created', 'Report created as a draft')]
  if (report.submittedAt) {
    entries.push(entry(2, report.submittedAt, report.operatorName, 'submitted', 'Submitted for review'))
  }
  if (report.reviewedAt && report.reviewedBy) {
    entries.push(
      report.status === 'returned'
        ? entry(3, report.reviewedAt, report.reviewedBy, 'returned', `Returned for correction: ${report.returnReason ?? ''}`.trim())
        : entry(3, report.reviewedAt, report.reviewedBy, 'approved', 'Approved'),
    )
  }
  return entries
}
const downtimeEvents: DowntimeEvent[] = []
let downtimeCounter = 0

const workDates = eachDate(FIRST_DATE, FACTORY_TODAY).filter((d) => dayOfWeek(d) !== 0)

for (const date of workDates) {
  LINE_CONFIGS.forEach((cfg, lineIndex) => {
    SHIFTS.forEach((shift, shiftIndex) => {
      const order = orderConfigFor(cfg.lineId, date)
      const isScenario = date === SCENARIO_DATE && cfg.lineId === 'line-cut-01' && shift === 'morning'

      let produced = Math.round(cfg.shiftTarget * (0.8 + rng() * 0.22))
      let rejected = Math.round(produced * (0.01 + rng() * 0.05))
      if (isScenario) {
        produced = 210
        rejected = 8
      }

      const status = reportStatusFor(date, shift, lineIndex, shiftIndex)
      const operatorName = cfg.operators[shift]
      const id = `RPT-${date.replace(/-/g, '')}-${cfg.code}-${shift === 'morning' ? 'AM' : 'PM'}`

      const report: ProductionReport = {
        id,
        orderId: order.orderNumber,
        lineId: cfg.lineId,
        machineId: cfg.machineIds[shift],
        shift,
        reportDate: date,
        operatorName,
        shiftTarget: cfg.shiftTarget,
        producedQuantity: produced,
        rejectedQuantity: rejected,
        status,
        createdAt: toIso(date, shift === 'morning' ? 13 * 60 : 21 * 60),
        updatedAt: '',
        ...(isScenario ? { notes: 'Blade maintenance during the shift; output recovered after restart.' } : {}),
      }

      if (status !== 'draft') {
        const submitMinute = (shift === 'morning' ? 14 * 60 : 22 * 60) + 10 + Math.floor(rng() * 30)
        const submittedAt = toIso(date, submitMinute)
        report.submittedAt = submittedAt
        if (status === 'approved' || status === 'returned') {
          const delayMinutes = 30 + Math.floor(rng() * 570)
          const reviewedMs = Math.min(Date.parse(submittedAt) + delayMinutes * 60_000, FACTORY_NOW_MS - 5 * 60_000)
          report.reviewedAt = new Date(reviewedMs).toISOString()
          report.reviewedBy = SUPERVISOR
          if (status === 'returned') {
            report.returnReason = 'Rejected quantity does not match the QC count. Please recheck and resubmit.'
          }
        }
      }
      report.updatedAt = report.reviewedAt ?? report.submittedAt ?? report.createdAt
      reportDrafts.push(report)
      reportHistory.push(...historyFor(report))

      const wantsDowntime = rng() < 0.4
      if (isScenario || wantsDowntime) {
        const category: DowntimeCategory = isScenario ? 'machine_maintenance' : pick(DOWNTIME_CATEGORIES, rng())
        const startMinute = isScenario ? 9 * 60 + 10 : (shift === 'morning' ? 7 * 60 : 15 * 60) + Math.floor(rng() * 300)
        const duration = isScenario ? 35 : 10 + Math.floor(rng() * 80)
        downtimeCounter += 1
        downtimeEvents.push({
          id: `DT-${String(downtimeCounter).padStart(4, '0')}`,
          lineId: cfg.lineId,
          machineId: cfg.machineIds[shift],
          orderId: order.orderNumber,
          reportId: id,
          startTime: toIso(date, startMinute),
          endTime: toIso(date, startMinute + duration),
          category,
          notes: isScenario ? 'Scheduled blade maintenance.' : DOWNTIME_NOTES[category],
          recordedBy: operatorName,
        })
      }
    })
  })
}

export const REPORTS: ProductionReport[] = reportDrafts
export const REPORT_HISTORY: ReportHistoryEntry[] = reportHistory

export const ORDERS: ProductionOrder[] = ORDER_CONFIGS.map((cfg) => {
  const producedTotal = REPORTS.filter((r) => r.orderId === cfg.orderNumber).reduce(
    (sum, r) => sum + r.producedQuantity,
    0,
  )
  const inProgress = cfg.end === FACTORY_TODAY
  return {
    id: cfg.orderNumber,
    orderNumber: cfg.orderNumber,
    productId: cfg.productId,
    lineId: cfg.lineId,
    plannedQuantity: cfg.fixedPlanned ?? Math.ceil((producedTotal * 1.1) / 50) * 50,
    plannedStart: cfg.start,
    dueDate: inProgress ? addDays(cfg.end, 3) : cfg.end,
    priority: cfg.priority,
    instructions: cfg.instructions,
    status: inProgress ? 'in_progress' : 'completed',
    createdAt: toIso(addDays(cfg.start, -3), 9 * 60),
    createdBy: SUPERVISOR,
    updatedAt: inProgress ? toIso(cfg.start, 6 * 60) : toIso(cfg.end, 22 * 60 + 30),
  }
})

export const ORDER_HISTORY: OrderHistoryEntry[] = ORDER_CONFIGS.flatMap((cfg) => {
  const entry = (n: number, timestamp: string, action: OrderHistoryEntry['action'], detail: string): OrderHistoryEntry => ({
    id: `OH-${cfg.orderNumber}-${n}`,
    orderId: cfg.orderNumber,
    timestamp,
    actor: SUPERVISOR,
    action,
    detail,
  })
  const entries = [
    entry(1, toIso(addDays(cfg.start, -3), 9 * 60), 'created', 'Order created as Draft'),
    entry(2, toIso(addDays(cfg.start, -3), 10 * 60), 'status_changed', 'Status: Draft → Planned'),
    entry(3, toIso(cfg.start, 6 * 60), 'status_changed', 'Status: Planned → In Progress'),
  ]
  if (cfg.end !== FACTORY_TODAY) {
    entries.push(entry(4, toIso(cfg.end, 22 * 60 + 30), 'status_changed', 'Status: In Progress → Completed'))
  }
  return entries
})

export const DOWNTIME_EVENTS: DowntimeEvent[] = downtimeEvents

export const DEFECT_TYPES: DefectType[] = [
  { id: 'defect-dimensional', name: 'Dimensional deviation', isActive: true },
  { id: 'defect-surface', name: 'Surface scratch or dent', isActive: true },
  { id: 'defect-burr', name: 'Burr or rough edge', isActive: true },
  { id: 'defect-bend', name: 'Bend angle out of tolerance', isActive: true },
  { id: 'defect-weld', name: 'Weld defect', isActive: true },
  { id: 'defect-other', name: 'Other', isActive: true },
]

/**
 * Inspections sample some of each approved report's output. They use their own generator so the
 * production, downtime and activity data above stay exactly as they were.
 */
function buildInspections(): QualityInspection[] {
  const irng = mulberry32(20261108)
  const items: QualityInspection[] = []
  let counter = 0
  let approvedIndex = 0
  const orderProduct = new Map(ORDERS.map((o) => [o.orderNumber, o.productId]))
  for (const report of REPORTS) {
    if (report.status !== 'approved' || report.producedQuantity === 0) continue
    approvedIndex += 1
    const isScenario = report.id === 'RPT-20261103-CUT-AM'
    if (!isScenario && approvedIndex % 2 !== 0) continue
    const inspected = isScenario ? 120 : Math.max(1, Math.round(report.producedQuantity * (0.5 + irng() * 0.3)))
    // Inspections sample part of the output, so some samples are clean even when the report had rejects.
    const cleanSample = !isScenario && (counter + 1) % 4 === 0
    const failed = isScenario ? 4 : cleanSample ? 0 : Math.min(inspected, Math.round((report.rejectedQuantity * inspected) / report.producedQuantity))
    const defect = failed > 0 ? (isScenario ? DEFECT_TYPES[0] : pick(DEFECT_TYPES, irng())) : undefined
    counter += 1
    const when = report.reviewedAt ?? report.submittedAt ?? report.createdAt
    items.push({
      id: `QI-2026-${String(counter).padStart(4, '0')}`,
      orderId: report.orderId,
      reportId: report.id,
      productId: orderProduct.get(report.orderId) ?? 'prod-custom',
      inspectionDate: report.reportDate,
      inspectedQuantity: inspected,
      passedQuantity: inspected - failed,
      failedQuantity: failed,
      ...(defect ? { defectId: defect.id } : {}),
      notes: failed > 0 ? 'Failed pieces set aside for rework or scrap.' : 'No defects found in the sample.',
      inspector: SUPERVISOR,
      createdAt: when,
      updatedAt: when,
    })
  }
  return items
}

export const INSPECTIONS: QualityInspection[] = buildInspections()

function buildActivity(): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const r of REPORTS) {
    const subject = `${r.id} · ${r.orderId}`
    if (r.submittedAt) {
      items.push({
        id: `${r.id}-sub`,
        timestamp: r.submittedAt,
        actor: r.operatorName,
        kind: 'report_submitted',
        orderId: r.orderId,
        subject,
      })
    }
    if (r.reviewedAt && r.reviewedBy) {
      items.push({
        id: `${r.id}-rev`,
        timestamp: r.reviewedAt,
        actor: r.reviewedBy,
        kind: r.status === 'approved' ? 'report_approved' : 'report_returned',
        orderId: r.orderId,
        subject,
        ...(r.returnReason ? { detail: r.returnReason } : {}),
      })
    }
  }
  for (const e of DOWNTIME_EVENTS) {
    items.push({
      id: `${e.id}-rec`,
      timestamp: e.endTime,
      actor: e.recordedBy,
      kind: 'downtime_recorded',
      ...(e.orderId ? { orderId: e.orderId } : {}),
      subject: `${e.id} · ${e.orderId ?? 'No order'}`,
    })
  }
  return items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}

export const ACTIVITY: ActivityItem[] = buildActivity()

export const SHIFT_CONFIGS: ShiftConfig[] = [
  { id: 'morning', name: 'Morning', startTime: '06:00', endTime: '18:00' },
  { id: 'night', name: 'Night', startTime: '18:00', endTime: '06:00' },
]

export const USERS: AppUser[] = [
  { id: 'user-admin', name: 'Carlo Reyes', email: 'carlo.reyes@northstar.example', role: 'administrator', isActive: true, createdAt: '2026-10-01T08:00:00+08:00' },
  { id: 'user-mgr', name: 'Mira Santos', email: 'mira.santos@northstar.example', role: 'manager', isActive: true, createdAt: '2026-10-01T08:05:00+08:00' },
  { id: 'user-sup-1', name: 'Rosa Villanueva', email: 'rosa.villanueva@northstar.example', role: 'supervisor', isActive: true, createdAt: '2026-10-01T08:10:00+08:00' },
  { id: 'user-sup-2', name: 'Benjie Ramos', email: 'benjie.ramos@northstar.example', role: 'supervisor', isActive: true, createdAt: '2026-10-01T08:12:00+08:00' },
  { id: 'user-op-1', name: 'Juan Dela Cruz', email: 'juan.delacruz@northstar.example', role: 'operator', isActive: true, createdAt: '2026-10-02T08:00:00+08:00' },
  { id: 'user-op-2', name: 'Mark Bautista', email: 'mark.bautista@northstar.example', role: 'operator', isActive: true, createdAt: '2026-10-02T08:05:00+08:00' },
  { id: 'user-op-3', name: 'Maria Reyes', email: 'maria.reyes@northstar.example', role: 'operator', isActive: true, createdAt: '2026-10-02T08:10:00+08:00' },
  { id: 'user-op-4', name: 'Carlo Mendoza', email: 'carlo.mendoza@northstar.example', role: 'operator', isActive: true, createdAt: '2026-10-02T08:15:00+08:00' },
  { id: 'user-op-5', name: 'Jose Ramos', email: 'jose.ramos@northstar.example', role: 'operator', isActive: true, createdAt: '2026-10-02T08:20:00+08:00' },
  { id: 'user-op-6', name: 'Ana Lim', email: 'ana.lim@northstar.example', role: 'operator', isActive: false, createdAt: '2026-10-02T08:25:00+08:00' },
]
