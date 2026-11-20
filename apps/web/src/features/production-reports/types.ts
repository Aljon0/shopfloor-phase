import type { ProductionLine, ProductionReport, ShiftId, DowntimeCategory } from '@/types/domain'
import type { OrderStatus, ReportStatus } from '@/types/status'

/** What an operator enters. Everything else on a report is derived or set by the system. */
export interface ReportInput {
  /** Production order number, e.g. PO-2026-003. The production line comes from the order. */
  orderId: string
  machineId: string
  shift: ShiftId
  /** YYYY-MM-DD, factory local. */
  reportDate: string
  producedQuantity: number
  rejectedQuantity: number
  notes: string
}

/** 'draft' saves without submitting; 'submit' sends the report for review. */
export type SaveMode = 'draft' | 'submit'

export interface ReportMetrics {
  goodQuantity: number
  /** Percent, or null when nothing was produced. */
  rejectionRate: number | null
  /** Percent, or null when there is no shift target. */
  targetAchievement: number | null
}

export interface ReportListItem {
  report: ProductionReport
  productName: string
  lineName: string
  machineName: string
  metrics: ReportMetrics
}

export interface ReportDowntimeRow {
  id: string
  startTime: string
  endTime: string
  minutes: number
  category: DowntimeCategory
  notes: string
  recordedBy: string
}

export interface ReportInspectionRow {
  id: string
  inspectionDate: string
  inspectedQuantity: number
  passedQuantity: number
  failedQuantity: number
  defectName: string | null
  inspector: string
}

export interface ReportTimelineEntry {
  id: string
  timestamp: string
  actor: string
  description: string
  detail: string
}

export interface ReportDetail {
  report: ProductionReport
  productName: string
  lineName: string
  machineName: string
  /** Status of the order the report belongs to. */
  orderStatus: OrderStatus | null
  metrics: ReportMetrics
  downtime: ReportDowntimeRow[]
  inspections: ReportInspectionRow[]
  totalDowntimeMinutes: number
  timeline: ReportTimelineEntry[]
}

export interface ReportOrderOption {
  id: string
  orderNumber: string
  productName: string
  lineId: string
  lineName: string
  status: OrderStatus
  plannedStart: string
}

export interface ReportReferenceData {
  orders: ReportOrderOption[]
  lines: ProductionLine[]
  machines: { id: string; name: string; lineId: string; shiftTarget: number; isActive: boolean }[]
  today: string
}

export interface ReportFilters {
  q: string
  status: ReportStatus | 'all'
  lineId: string
  shift: ShiftId | 'all'
  /** YYYY-MM-DD or '' for no limit. */
  from: string
  to: string
}
