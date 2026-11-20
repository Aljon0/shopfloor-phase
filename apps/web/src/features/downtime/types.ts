import type { DowntimeCategory, DowntimeEvent, ProductionLine } from '@/types/domain'
import type { OrderStatus, ReportStatus } from '@/types/status'

/** What the user enters. Times are factory-local, as 'YYYY-MM-DDTHH:mm' (what a datetime-local input holds). */
export interface DowntimeInput {
  machineId: string
  /** Order number, or '' when the stop is not tied to an order. */
  orderId: string
  /** Report number, or '' when not linked to a report. */
  reportId: string
  startTime: string
  endTime: string
  category: DowntimeCategory
  notes: string
}

export interface DowntimeListItem {
  event: DowntimeEvent
  minutes: number
  lineName: string
  machineName: string
  /** Status of the linked report, if any. An approved report locks its events. */
  reportStatus: ReportStatus | null
}

export interface DowntimeReferenceData {
  lines: ProductionLine[]
  machines: { id: string; name: string; lineId: string; isActive: boolean }[]
  orders: { id: string; orderNumber: string; lineId: string; status: OrderStatus; productName: string }[]
  reports: { id: string; machineId: string; orderId: string; reportDate: string; status: ReportStatus }[]
  today: string
}

export interface DowntimeFilters {
  q: string
  lineId: string
  machineId: string
  category: DowntimeCategory | 'all'
  from: string
  to: string
}

export interface DowntimeSummaryRow {
  key: string
  label: string
  minutes: number
  events: number
}

export interface DowntimeSummary {
  totalMinutes: number
  totalEvents: number
  byCategory: DowntimeSummaryRow[]
  byMachine: DowntimeSummaryRow[]
}
