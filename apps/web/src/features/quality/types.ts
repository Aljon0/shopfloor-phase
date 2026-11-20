import type { DefectType, QualityInspection } from '@/types/domain'
import type { OrderStatus, ReportStatus } from '@/types/status'

/** What the inspector enters. Passed quantity is calculated (inspected - failed), never typed. */
export interface InspectionInput {
  /** Production order number. The product comes from the order. */
  orderId: string
  /** Report number, or '' when the inspection is not tied to a report. */
  reportId: string
  inspectionDate: string
  inspectedQuantity: number
  failedQuantity: number
  /** Defect classification, or '' when nothing failed. */
  defectId: string
  notes: string
}

export interface InspectionItem {
  inspection: QualityInspection
  productName: string
  lineName: string
  /** Null when nothing failed. */
  defectName: string | null
  /** Status of the linked report, if any. */
  reportStatus: ReportStatus | null
  /** Percent of inspected pieces that passed. */
  passRate: number | null
}

export interface QualityReferenceData {
  orders: { id: string; orderNumber: string; productName: string; lineName: string; status: OrderStatus; plannedStart: string }[]
  reports: { id: string; orderId: string; reportDate: string; producedQuantity: number; status: ReportStatus }[]
  defects: DefectType[]
  today: string
}

export type ResultFilter = 'all' | 'passed' | 'failed'

export interface QualityFilters {
  q: string
  productId: string
  /** 'all', 'none' (no defect recorded) or a defect id. */
  defectId: string
  /** 'failed' = at least one failed piece. */
  result: ResultFilter
  from: string
  to: string
}

export interface DefectSummaryRow {
  key: string
  label: string
  failed: number
  inspections: number
}

export interface QualitySummary {
  inspections: number
  inspected: number
  passed: number
  failed: number
  /** Percentages from summed quantities, not averages of per-inspection percentages. */
  passRate: number | null
  failureRate: number | null
  byDefect: DefectSummaryRow[]
}
