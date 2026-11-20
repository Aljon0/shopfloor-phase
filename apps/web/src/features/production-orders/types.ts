import type { DowntimeCategory, Priority, ProductionOrder, ShiftId } from '@/types/domain'
import type { ReportStatus } from '@/types/status'

/** Fields a supervisor enters when creating or editing an order. */
export interface OrderInput {
  productId: string
  lineId: string
  plannedQuantity: number
  /** YYYY-MM-DD, factory local. */
  plannedStart: string
  dueDate: string
  priority: Priority
  instructions: string
}

/** Orders can only be created as Draft or Planned; later changes go through status actions. */
export type InitialOrderStatus = 'draft' | 'planned'

export interface OrderProgress {
  plannedQuantity: number
  approvedReportCount: number
  approvedProduced: number
  approvedRejected: number
  /** Official progress figure: good output from approved reports only. */
  approvedGood: number
  pendingReportCount: number
  /** Good output on reports still awaiting review (shown separately, not in official progress). */
  pendingGood: number
  /** Produced on approved + pending reports. Planned quantity cannot drop below this. */
  committedProduced: number
  /** approvedGood / plannedQuantity x 100, or null when planned quantity is 0. */
  percent: number | null
}

export interface OrderListItem {
  order: ProductionOrder
  productName: string
  lineName: string
  progress: OrderProgress
  overdue: boolean
}

export interface OrderReportRow {
  id: string
  reportDate: string
  shift: ShiftId
  machineName: string
  operatorName: string
  producedQuantity: number
  rejectedQuantity: number
  goodQuantity: number
  rejectionRate: number | null
  status: ReportStatus
}

export interface OrderDowntimeRow {
  id: string
  machineName: string
  startTime: string
  endTime: string
  minutes: number
  category: DowntimeCategory
  notes: string
  recordedBy: string
}

export interface TimelineEntry {
  id: string
  timestamp: string
  actor: string
  /** Text that follows the actor's name, e.g. 'submitted RPT-20261103-CUT-AM'. */
  description: string
  detail?: string
}

export interface OrderDetail {
  order: ProductionOrder
  productName: string
  lineName: string
  progress: OrderProgress
  overdue: boolean
  reports: OrderReportRow[]
  downtime: OrderDowntimeRow[]
  timeline: TimelineEntry[]
}

export interface OrderFilters {
  q: string
  status: ProductionOrder['status'] | 'all'
  lineId: string
  priority: Priority | 'all'
}
