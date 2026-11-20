/**
 * Production order business rules. Pure functions, no UI or framework imports.
 *
 * Assumptions to confirm (the blueprint lists statuses but not the transition rules):
 * - Allowed transitions: Draft -> Planned -> In Progress -> Completed; any open status -> Cancelled.
 * - Completed and Cancelled orders are final and cannot be edited.
 * - Once In Progress, the product and production line are locked.
 * - Planned quantity cannot be set below the quantity already reported (approved + pending).
 * - Cancelling requires a reason.
 */
import { targetAchievement } from '@/lib/kpi'
import type { Priority, ProductionOrder, ProductionReport } from '@/types/domain'
import type { OrderStatus } from '@/types/status'
import type { OrderInput, OrderProgress } from '../types'

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<OrderStatus, string>

export const PRIORITIES: readonly Priority[] = ['low', 'normal', 'high', 'urgent']

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export interface StatusAction {
  to: OrderStatus
  label: string
  tone: 'primary' | 'danger'
  requiresReason: boolean
  confirmTitle: string
  confirmDescription: (orderNumber: string) => string
}

const CANCEL_ACTION: StatusAction = {
  to: 'cancelled',
  label: 'Cancel order',
  tone: 'danger',
  requiresReason: true,
  confirmTitle: 'Cancel this order?',
  confirmDescription: (n) => `${n} will be cancelled. Cancelled orders cannot be edited or reopened.`,
}

const STATUS_ACTIONS: Record<OrderStatus, StatusAction[]> = {
  draft: [
    {
      to: 'planned',
      label: 'Mark as planned',
      tone: 'primary',
      requiresReason: false,
      confirmTitle: 'Mark as planned?',
      confirmDescription: (n) => `${n} will be marked Planned. It stays editable until production starts.`,
    },
    CANCEL_ACTION,
  ],
  planned: [
    {
      to: 'in_progress',
      label: 'Start production',
      tone: 'primary',
      requiresReason: false,
      confirmTitle: 'Start production?',
      confirmDescription: (n) => `${n} will be marked In Progress. Its product and production line can no longer be changed.`,
    },
    CANCEL_ACTION,
  ],
  in_progress: [
    {
      to: 'completed',
      label: 'Mark as completed',
      tone: 'primary',
      requiresReason: false,
      confirmTitle: 'Mark as completed?',
      confirmDescription: (n) => `${n} will be marked Completed. It can no longer be edited or reopened.`,
    },
    CANCEL_ACTION,
  ],
  completed: [],
  cancelled: [],
}

export const MIN_CANCEL_REASON_LENGTH = 3

export function statusActionsFor(status: OrderStatus): StatusAction[] {
  return STATUS_ACTIONS[status]
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_ACTIONS[from].some((a) => a.to === to)
}

export function isEditable(status: OrderStatus): boolean {
  return status === 'draft' || status === 'planned' || status === 'in_progress'
}

export function lockedFields(status: OrderStatus): readonly ('productId' | 'lineId')[] {
  return status === 'in_progress' ? ['productId', 'lineId'] : []
}

/** Next order number for a year, e.g. PO-2026-008. Never reuses a number. */
export function nextOrderNumber(existing: readonly string[], year: number): string {
  const prefix = `PO-${year}-`
  let highest = 0
  for (const number of existing) {
    if (!number.startsWith(prefix)) continue
    const sequence = Number(number.slice(prefix.length))
    if (Number.isInteger(sequence) && sequence > highest) highest = sequence
  }
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

/** An open order whose due date has passed. */
export function isOverdue(order: Pick<ProductionOrder, 'status' | 'dueDate'>, today: string): boolean {
  return isEditable(order.status) && order.dueDate < today
}

/** Order progress from its reports. Official progress counts approved reports only. */
export function orderProgress(plannedQuantity: number, reports: readonly ProductionReport[]): OrderProgress {
  let approvedProduced = 0
  let approvedRejected = 0
  let approvedReportCount = 0
  let pendingProduced = 0
  let pendingRejected = 0
  let pendingReportCount = 0

  for (const r of reports) {
    if (r.status === 'approved') {
      approvedProduced += r.producedQuantity
      approvedRejected += r.rejectedQuantity
      approvedReportCount += 1
    } else if (r.status === 'pending_review' || r.status === 'revised') {
      pendingProduced += r.producedQuantity
      pendingRejected += r.rejectedQuantity
      pendingReportCount += 1
    }
  }

  const approvedGood = approvedProduced - approvedRejected
  return {
    plannedQuantity,
    approvedReportCount,
    approvedProduced,
    approvedRejected,
    approvedGood,
    pendingReportCount,
    pendingGood: pendingProduced - pendingRejected,
    committedProduced: approvedProduced + pendingProduced,
    percent: targetAchievement(approvedGood, plannedQuantity),
  }
}

const FIELD_LABELS: Record<keyof OrderInput, string> = {
  productId: 'Product',
  lineId: 'Production line',
  plannedQuantity: 'Planned quantity',
  plannedStart: 'Planned start',
  dueDate: 'Due date',
  priority: 'Priority',
  instructions: 'Instructions',
}

const COMPARED_FIELDS = Object.keys(FIELD_LABELS) as (keyof OrderInput)[]

/** Human-readable summary of what changed, for the audit history. Empty string = no changes. */
export function describeChanges(
  before: OrderInput,
  after: OrderInput,
  display: (field: keyof OrderInput, value: string | number) => string,
): string {
  const parts: string[] = []
  for (const field of COMPARED_FIELDS) {
    if (before[field] === after[field]) continue
    parts.push(
      field === 'instructions'
        ? 'Instructions changed'
        : `${FIELD_LABELS[field]}: ${display(field, before[field])} → ${display(field, after[field])}`,
    )
  }
  return parts.join('; ')
}
