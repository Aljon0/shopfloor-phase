import type { Role } from './roles'
import type { OrderStatus, ReportStatus } from './status'

export type ShiftId = 'morning' | 'night'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export type DowntimeCategory =
  | 'machine_maintenance'
  | 'equipment_failure'
  | 'material_shortage'
  | 'changeover'
  | 'operator_delay'
  | 'other'

export interface ProductionLine {
  id: string
  name: string
  /** Short code used in report numbers, e.g. 'CUT'. Fixed once created. */
  code: string
  /** Inactive records stay on past orders and reports but cannot be chosen for new work. */
  isActive: boolean
}

export interface Product {
  id: string
  name: string
  isActive: boolean
}

export interface Machine {
  id: string
  name: string
  lineId: string
  /**
   * Standard good-output target for one shift on this machine. A report's shift target is taken
   * from its machine. (Assumption: the blueprint does not say where shift targets come from.)
   */
  shiftTarget: number
  isActive: boolean
}

export interface ProductionOrder {
  id: string
  orderNumber: string
  productId: string
  lineId: string
  plannedQuantity: number
  /** Calendar dates, YYYY-MM-DD, factory local. */
  plannedStart: string
  dueDate: string
  priority: Priority
  instructions: string
  status: OrderStatus
  /** Required when an order is cancelled. */
  cancelReason?: string
  /** Audit metadata (ISO timestamps). */
  createdAt: string
  createdBy: string
  updatedAt: string
}

export type OrderHistoryAction = 'created' | 'updated' | 'status_changed'

/** Audit trail of changes to an order: who did what, and when. */
export interface OrderHistoryEntry {
  id: string
  orderId: string
  timestamp: string
  actor: string
  action: OrderHistoryAction
  detail: string
}

export interface ProductionReport {
  id: string
  orderId: string
  lineId: string
  machineId: string
  shift: ShiftId
  /** Calendar date, YYYY-MM-DD, factory local. */
  reportDate: string
  operatorName: string
  /** Planned output for this shift. Dashboard target achievement sums these. */
  shiftTarget: number
  producedQuantity: number
  rejectedQuantity: number
  status: ReportStatus
  /** ISO timestamps. */
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: string
  returnReason?: string
  /** Operator notes, up to 500 characters. */
  notes?: string
  /** Audit metadata (ISO timestamps). */
  createdAt: string
  updatedAt: string
}

export type ReportHistoryAction = 'created' | 'updated' | 'submitted' | 'resubmitted' | 'approved' | 'returned' | 'reopened'

/** Audit trail of a production report: who did what, and when. */
export interface ReportHistoryEntry {
  id: string
  reportId: string
  timestamp: string
  actor: string
  action: ReportHistoryAction
  detail: string
}

export interface DowntimeEvent {
  id: string
  lineId: string
  machineId: string
  orderId?: string
  reportId?: string
  /** ISO timestamps with offset. Duration is always calculated from these, never stored. */
  startTime: string
  endTime: string
  category: DowntimeCategory
  notes: string
  recordedBy: string
}

export type ActivityKind = 'report_submitted' | 'report_approved' | 'report_returned' | 'downtime_recorded'

export interface ActivityItem {
  id: string
  timestamp: string
  actor: string
  kind: ActivityKind
  orderId?: string
  reportId?: string
  /** Short reference such as 'RPT-20261103-CUT-AM · PO-2026-001'. */
  subject: string
  detail?: string
}

/** A defect classification used on quality inspections. */
export interface DefectType {
  id: string
  name: string
  isActive: boolean
}

/**
 * A basic inspection record. This is a record of what was checked, not a certified
 * quality-management system. Passed + failed always equals inspected.
 */
export interface QualityInspection {
  id: string
  /** Production order number, e.g. PO-2026-001. */
  orderId: string
  reportId?: string
  productId: string
  /** YYYY-MM-DD, factory local. */
  inspectionDate: string
  inspectedQuantity: number
  passedQuantity: number
  failedQuantity: number
  /** Required when failedQuantity > 0, absent otherwise. */
  defectId?: string
  notes: string
  inspector: string
  createdAt: string
  updatedAt: string
}

/** A person who can sign in. Prototype only: sign-in is still name + role, so this is not linked to it yet. */
export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
}

/** Working hours of a shift, 'HH:MM' factory local time. A shift that ends before it starts runs overnight. */
export interface ShiftConfig {
  id: ShiftId
  name: string
  startTime: string
  endTime: string
}

export type SettingsEntity = 'user' | 'product' | 'line' | 'machine' | 'shift' | 'defect_type'

/** Audit trail for configuration changes. */
export interface SettingsAuditEntry {
  id: string
  timestamp: string
  actor: string
  entity: SettingsEntity
  entityId: string
  action: 'created' | 'updated' | 'activated' | 'deactivated' | 'password_reset' | 'password_changed'
  detail: string
}
