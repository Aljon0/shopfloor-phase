/**
 * Mock data access. Each function mirrors what a future API client will provide, returns a
 * Promise, and simulates network latency. Feature services call these; UI components never do.
 *
 * Orders, reports and their history are held in memory so create/edit/status changes work during a
 * session. They reset when the page is reloaded (there is no persistence until the backend phase).
 */
import type {
  ActivityItem,
  AppUser,
  SettingsAuditEntry,
  ShiftConfig,
  DefectType,
  DowntimeEvent,
  Machine,
  OrderHistoryEntry,
  Product,
  ProductionLine,
  ProductionOrder,
  ProductionReport,
  QualityInspection,
  ReportHistoryEntry,
} from '@/types/domain'
import {
  ACTIVITY,
  DEFECT_TYPES,
  DOWNTIME_EVENTS,
  INSPECTIONS,
  FACTORY_TODAY,
  LINES,
  MACHINES,
  SHIFT_CONFIGS,
  USERS,
  ORDERS,
  ORDER_HISTORY,
  PRODUCTS,
  REPORTS,
  REPORT_HISTORY,
} from './seed'

let latencyMs = 350

/** Tests set this to 0 so they do not wait on simulated latency. */
export function setMockLatency(ms: number): void {
  latencyMs = ms
}

function respond<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), latencyMs))
}

const lines: ProductionLine[] = LINES.map((l) => ({ ...l }))
const products: Product[] = PRODUCTS.map((p) => ({ ...p }))
const machines: Machine[] = MACHINES.map((m) => ({ ...m }))
const defectTypes: DefectType[] = DEFECT_TYPES.map((d) => ({ ...d }))
const users: AppUser[] = USERS.map((u) => ({ ...u }))
const shiftConfigs: ShiftConfig[] = SHIFT_CONFIGS.map((s) => ({ ...s }))
const settingsAudit: SettingsAuditEntry[] = []

/** Inserts or replaces one record of a configuration list and appends its audit entry. */
function saveConfig<T extends { id: string }>(list: T[], item: T, mode: 'insert' | 'replace', audit: SettingsAuditEntry | undefined, label: string): Promise<T> {
  const index = list.findIndex((x) => x.id === item.id)
  if (mode === 'insert' && index !== -1) return Promise.reject(new Error(`${label} ${item.id} already exists`))
  if (mode === 'replace' && index === -1) return Promise.reject(new Error(`${label} ${item.id} not found`))
  if (mode === 'insert') list.push({ ...item })
  else list[index] = { ...item }
  if (audit) settingsAudit.unshift({ ...audit })
  return respond({ ...item })
}

const orders: ProductionOrder[] = ORDERS.map((o) => ({ ...o }))
const orderHistory: OrderHistoryEntry[] = ORDER_HISTORY.map((h) => ({ ...h }))
let reports: ProductionReport[] = REPORTS.map((r) => ({ ...r }))
const reportHistory: ReportHistoryEntry[] = REPORT_HISTORY.map((h) => ({ ...h }))
const activity: ActivityItem[] = ACTIVITY.map((a) => ({ ...a }))
const downtimeEvents: DowntimeEvent[] = DOWNTIME_EVENTS.map((e) => ({ ...e }))
const inspections: QualityInspection[] = INSPECTIONS.map((i) => ({ ...i }))

export const mockRepository = {
  getFactoryToday: (): string => FACTORY_TODAY,
  listLines: (): Promise<ProductionLine[]> => respond(lines.map((l) => ({ ...l }))),
  listProducts: (): Promise<Product[]> => respond(products.map((p) => ({ ...p }))),
  listMachines: (): Promise<Machine[]> => respond(machines.map((m) => ({ ...m }))),
  listOrders: (): Promise<ProductionOrder[]> => respond(orders.map((o) => ({ ...o }))),
  listReports: (): Promise<ProductionReport[]> => respond(reports.map((r) => ({ ...r }))),
  listDowntimeEvents: (): Promise<DowntimeEvent[]> => respond(downtimeEvents.map((e) => ({ ...e }))),
  listDefectTypes: (): Promise<DefectType[]> => respond(defectTypes.map((d) => ({ ...d }))),
  listInspections: (): Promise<QualityInspection[]> => respond(inspections.map((i) => ({ ...i }))),
  listActivity: (): Promise<ActivityItem[]> => respond(activity.map((a) => ({ ...a }))),
  listReportHistory: (reportId: string): Promise<ReportHistoryEntry[]> =>
    respond(reportHistory.filter((h) => h.reportId === reportId).map((h) => ({ ...h }))),
  listOrderHistory: (orderId: string): Promise<OrderHistoryEntry[]> =>
    respond(orderHistory.filter((h) => h.orderId === orderId).map((h) => ({ ...h }))),

  listUsers: (): Promise<AppUser[]> => respond(users.map((u) => ({ ...u }))),
  listShiftConfigs: (): Promise<ShiftConfig[]> => respond(shiftConfigs.map((s) => ({ ...s }))),
  listSettingsAudit: (): Promise<SettingsAuditEntry[]> => respond(settingsAudit.map((a) => ({ ...a }))),

  insertLine: (item: ProductionLine, audit?: SettingsAuditEntry) => saveConfig(lines, item, 'insert', audit, 'Line'),
  replaceLine: (item: ProductionLine, audit?: SettingsAuditEntry) => saveConfig(lines, item, 'replace', audit, 'Line'),
  insertProduct: (item: Product, audit?: SettingsAuditEntry) => saveConfig(products, item, 'insert', audit, 'Product'),
  replaceProduct: (item: Product, audit?: SettingsAuditEntry) => saveConfig(products, item, 'replace', audit, 'Product'),
  insertMachine: (item: Machine, audit?: SettingsAuditEntry) => saveConfig(machines, item, 'insert', audit, 'Machine'),
  replaceMachine: (item: Machine, audit?: SettingsAuditEntry) => saveConfig(machines, item, 'replace', audit, 'Machine'),
  insertDefectType: (item: DefectType, audit?: SettingsAuditEntry) => saveConfig(defectTypes, item, 'insert', audit, 'Defect type'),
  replaceDefectType: (item: DefectType, audit?: SettingsAuditEntry) => saveConfig(defectTypes, item, 'replace', audit, 'Defect type'),
  insertUser: (item: AppUser, audit?: SettingsAuditEntry) => saveConfig(users, item, 'insert', audit, 'User'),
  replaceUser: (item: AppUser, audit?: SettingsAuditEntry) => saveConfig(users, item, 'replace', audit, 'User'),
  replaceShiftConfig: (item: ShiftConfig, audit?: SettingsAuditEntry) => saveConfig(shiftConfigs, item, 'replace', audit, 'Shift'),

  insertOrder: (order: ProductionOrder, entry: OrderHistoryEntry): Promise<ProductionOrder> => {
    if (orders.some((o) => o.id === order.id)) {
      return Promise.reject(new Error(`Order ${order.id} already exists`))
    }
    orders.push({ ...order })
    orderHistory.push({ ...entry })
    return respond({ ...order })
  },

  replaceOrder: (order: ProductionOrder, entry: OrderHistoryEntry): Promise<ProductionOrder> => {
    const index = orders.findIndex((o) => o.id === order.id)
    if (index === -1) return Promise.reject(new Error(`Order ${order.id} not found`))
    orders[index] = { ...order }
    orderHistory.push({ ...entry })
    return respond({ ...order })
  },

  insertReport: (
    report: ProductionReport,
    entries: ReportHistoryEntry[],
    activityItem?: ActivityItem,
  ): Promise<ProductionReport> => {
    if (reports.some((r) => r.id === report.id)) {
      return Promise.reject(new Error(`Report ${report.id} already exists`))
    }
    reports.push({ ...report })
    reportHistory.push(...entries.map((e) => ({ ...e })))
    if (activityItem) activity.unshift({ ...activityItem })
    return respond({ ...report })
  },

  replaceReport: (
    report: ProductionReport,
    entries: ReportHistoryEntry[],
    activityItem?: ActivityItem,
  ): Promise<ProductionReport> => {
    const index = reports.findIndex((r) => r.id === report.id)
    if (index === -1) return Promise.reject(new Error(`Report ${report.id} not found`))
    reports[index] = { ...report }
    reportHistory.push(...entries.map((e) => ({ ...e })))
    if (activityItem) activity.unshift({ ...activityItem })
    return respond({ ...report })
  },

  /** Removes a report and its history. The service only allows this for drafts. */
  deleteReport: (reportId: string): Promise<void> => {
    if (!reports.some((r) => r.id === reportId)) return Promise.reject(new Error(`Report ${reportId} not found`))
    reports = reports.filter((r) => r.id !== reportId)
    for (let i = reportHistory.length - 1; i >= 0; i--) {
      if (reportHistory[i]?.reportId === reportId) reportHistory.splice(i, 1)
    }
    return respond(undefined)
  },

  insertDowntimeEvent: (event: DowntimeEvent, activityItem?: ActivityItem): Promise<DowntimeEvent> => {
    if (downtimeEvents.some((e) => e.id === event.id)) return Promise.reject(new Error(`Event ${event.id} already exists`))
    downtimeEvents.push({ ...event })
    if (activityItem) activity.unshift({ ...activityItem })
    return respond({ ...event })
  },

  replaceDowntimeEvent: (event: DowntimeEvent): Promise<DowntimeEvent> => {
    const index = downtimeEvents.findIndex((e) => e.id === event.id)
    if (index === -1) return Promise.reject(new Error(`Event ${event.id} not found`))
    downtimeEvents[index] = { ...event }
    return respond({ ...event })
  },

  insertInspection: (inspection: QualityInspection): Promise<QualityInspection> => {
    if (inspections.some((i) => i.id === inspection.id)) return Promise.reject(new Error(`Inspection ${inspection.id} already exists`))
    inspections.push({ ...inspection })
    return respond({ ...inspection })
  },

  replaceInspection: (inspection: QualityInspection): Promise<QualityInspection> => {
    const index = inspections.findIndex((i) => i.id === inspection.id)
    if (index === -1) return Promise.reject(new Error(`Inspection ${inspection.id} not found`))
    inspections[index] = { ...inspection }
    return respond({ ...inspection })
  },
}
