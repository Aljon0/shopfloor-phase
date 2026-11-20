/**
 * Service boundary for production orders. Reads and writes go through the mock repository today;
 * when the API exists these functions call it instead, with no change to the UI.
 *
 * Business rules are enforced here (not only in the form), because hiding or disabling UI is not
 * security: the backend will have to enforce the same rules.
 */
import { downtimeMinutes, rejectionRate } from '@/lib/kpi'
import { mockRepository } from '@/mocks/repository'
import { getFactoryToday } from '@/services/factory-clock'
import type {
  ActivityKind,
  OrderHistoryEntry,
  Product,
  ProductionLine,
  ProductionOrder,
} from '@/types/domain'
import type { OrderStatus } from '@/types/status'
import { buildOrderFormSchema } from '../lib/order-form-schema'
import {
  MIN_CANCEL_REASON_LENGTH,
  ORDER_STATUS_LABELS,
  canTransition,
  describeChanges,
  isEditable,
  isOverdue,
  lockedFields,
  nextOrderNumber,
  orderProgress,
} from '../lib/order-rules'
import type {
  InitialOrderStatus,
  OrderDetail,
  OrderDowntimeRow,
  OrderInput,
  OrderListItem,
  OrderReportRow,
  TimelineEntry,
} from '../types'

/** A business rule was broken. The message is safe to show to the user. */
export class OrderRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderRuleError'
  }
}

export interface OrderReferenceData {
  products: Product[]
  lines: ProductionLine[]
}

export async function getOrderReference(): Promise<OrderReferenceData> {
  const [products, lines] = await Promise.all([mockRepository.listProducts(), mockRepository.listLines()])
  return { products, lines }
}

export async function listOrderItems(): Promise<OrderListItem[]> {
  const [orders, products, lines, reports] = await Promise.all([
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listReports(),
  ])
  const today = getFactoryToday()
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const lineNames = new Map(lines.map((l) => [l.id, l.name]))

  return orders.map((order) => ({
    order,
    productName: productNames.get(order.productId) ?? 'Unknown product',
    lineName: lineNames.get(order.lineId) ?? 'Unknown line',
    progress: orderProgress(
      order.plannedQuantity,
      reports.filter((r) => r.orderId === order.id),
    ),
    overdue: isOverdue(order, today),
  }))
}

const ACTIVITY_VERBS: Record<ActivityKind, string> = {
  report_submitted: 'submitted',
  report_approved: 'approved',
  report_returned: 'returned for correction:',
  downtime_recorded: 'recorded downtime',
}

function historyDescription(entry: OrderHistoryEntry): string {
  switch (entry.action) {
    case 'created':
      return 'created the order'
    case 'updated':
      return 'updated the order'
    case 'status_changed':
      return 'changed the order status'
  }
}

/** Returns null when the order does not exist. */
export async function getOrderDetail(orderNumber: string): Promise<OrderDetail | null> {
  const [orders, products, lines, machines, reports, downtime, activity, history] = await Promise.all([
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listMachines(),
    mockRepository.listReports(),
    mockRepository.listDowntimeEvents(),
    mockRepository.listActivity(),
    mockRepository.listOrderHistory(orderNumber),
  ])
  const order = orders.find((o) => o.id === orderNumber)
  if (!order) return null

  const machineNames = new Map(machines.map((m) => [m.id, m.name]))
  const orderReports = reports.filter((r) => r.orderId === order.id)

  const reportRows: OrderReportRow[] = orderReports
    .map((r) => ({
      id: r.id,
      reportDate: r.reportDate,
      shift: r.shift,
      machineName: machineNames.get(r.machineId) ?? r.machineId,
      operatorName: r.operatorName,
      producedQuantity: r.producedQuantity,
      rejectedQuantity: r.rejectedQuantity,
      goodQuantity: r.producedQuantity - r.rejectedQuantity,
      rejectionRate: rejectionRate(r.rejectedQuantity, r.producedQuantity),
      status: r.status,
    }))
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.id.localeCompare(b.id))

  const downtimeRows: OrderDowntimeRow[] = []
  for (const e of downtime) {
    if (e.orderId !== order.id) continue
    const minutes = downtimeMinutes(e.startTime, e.endTime)
    if (minutes === null) continue
    downtimeRows.push({
      id: e.id,
      machineName: machineNames.get(e.machineId) ?? e.machineId,
      startTime: e.startTime,
      endTime: e.endTime,
      minutes,
      category: e.category,
      notes: e.notes,
      recordedBy: e.recordedBy,
    })
  }
  downtimeRows.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))

  const timeline: TimelineEntry[] = [
    ...history.map((h) => ({
      id: h.id,
      timestamp: h.timestamp,
      actor: h.actor,
      description: historyDescription(h),
      detail: h.detail,
    })),
    ...activity
      .filter((a) => a.orderId === order.id)
      .map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        actor: a.actor,
        description: `${ACTIVITY_VERBS[a.kind]} ${a.subject.split(' · ')[0] ?? a.subject}`,
        ...(a.detail ? { detail: a.detail } : {}),
      })),
  ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return {
    order,
    productName: products.find((p) => p.id === order.productId)?.name ?? 'Unknown product',
    lineName: lines.find((l) => l.id === order.lineId)?.name ?? 'Unknown line',
    progress: orderProgress(order.plannedQuantity, orderReports),
    overdue: isOverdue(order, getFactoryToday()),
    reports: reportRows,
    downtime: downtimeRows,
    timeline,
  }
}

function assertValid(input: OrderInput, status: InitialOrderStatus, minPlanned: number): OrderInput {
  const result = buildOrderFormSchema(minPlanned).safeParse({ ...input, status })
  if (!result.success) {
    throw new OrderRuleError(result.error.issues.map((i) => i.message).join(' '))
  }
  const { status: _ignored, ...clean } = result.data
  return clean
}

function newHistoryEntry(
  orderId: string,
  actor: string,
  action: OrderHistoryEntry['action'],
  detail: string,
  timestamp: string,
): OrderHistoryEntry {
  return { id: `OH-${crypto.randomUUID()}`, orderId, timestamp, actor, action, detail }
}

function toInput(order: ProductionOrder): OrderInput {
  return {
    productId: order.productId,
    lineId: order.lineId,
    plannedQuantity: order.plannedQuantity,
    plannedStart: order.plannedStart,
    dueDate: order.dueDate,
    priority: order.priority,
    instructions: order.instructions,
  }
}

export async function createOrder(
  input: OrderInput,
  status: InitialOrderStatus,
  actor: string,
): Promise<ProductionOrder> {
  const clean = assertValid(input, status, 0)
  const [products, lines, existing] = await Promise.all([
    mockRepository.listProducts(),
    mockRepository.listLines(),
    mockRepository.listOrders(),
  ])
  const product = products.find((p) => p.id === clean.productId)
  const line = lines.find((l) => l.id === clean.lineId)
  if (!product) throw new OrderRuleError('Select a valid product.')
  if (!line) throw new OrderRuleError('Select a valid production line.')
  if (!product.isActive) throw new OrderRuleError(`${product.name} is inactive and cannot be used for new orders.`)
  if (!line.isActive) throw new OrderRuleError(`${line.name} is inactive and cannot be used for new orders.`)

  const year = Number(getFactoryToday().slice(0, 4))
  const orderNumber = nextOrderNumber(
    existing.map((o) => o.orderNumber),
    year,
  )
  const now = new Date().toISOString()
  const order: ProductionOrder = {
    ...clean,
    id: orderNumber,
    orderNumber,
    status,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
  }
  return mockRepository.insertOrder(
    order,
    newHistoryEntry(orderNumber, actor, 'created', `Order created as ${ORDER_STATUS_LABELS[status]}`, now),
  )
}

async function requireOrder(orderNumber: string): Promise<ProductionOrder> {
  const orders = await mockRepository.listOrders()
  const order = orders.find((o) => o.id === orderNumber)
  if (!order) throw new OrderRuleError(`Order ${orderNumber} was not found.`)
  return order
}

export async function updateOrder(orderNumber: string, input: OrderInput, actor: string): Promise<ProductionOrder> {
  const order = await requireOrder(orderNumber)
  if (!isEditable(order.status)) {
    throw new OrderRuleError(`${ORDER_STATUS_LABELS[order.status]} orders cannot be edited.`)
  }
  for (const field of lockedFields(order.status)) {
    if (input[field] !== order[field]) {
      throw new OrderRuleError('Product and production line cannot be changed once production has started.')
    }
  }

  const [reports, products, lines] = await Promise.all([
    mockRepository.listReports(),
    mockRepository.listProducts(),
    mockRepository.listLines(),
  ])
  const { committedProduced } = orderProgress(
    order.plannedQuantity,
    reports.filter((r) => r.orderId === order.id),
  )
  const clean = assertValid(input, 'draft', committedProduced)
  // Inactive records stay on existing orders; they just cannot be newly chosen.
  const newProduct = products.find((p) => p.id === clean.productId)
  const newLine = lines.find((l) => l.id === clean.lineId)
  if (clean.productId !== order.productId && newProduct && !newProduct.isActive) {
    throw new OrderRuleError(`${newProduct.name} is inactive and cannot be chosen.`)
  }
  if (clean.lineId !== order.lineId && newLine && !newLine.isActive) {
    throw new OrderRuleError(`${newLine.name} is inactive and cannot be chosen.`)
  }

  const display = (field: keyof OrderInput, value: string | number): string => {
    if (field === 'productId') return products.find((p) => p.id === value)?.name ?? String(value)
    if (field === 'lineId') return lines.find((l) => l.id === value)?.name ?? String(value)
    return String(value)
  }
  const changes = describeChanges(toInput(order), clean, display)
  if (changes === '') return order

  const now = new Date().toISOString()
  const updated: ProductionOrder = { ...order, ...clean, updatedAt: now }
  return mockRepository.replaceOrder(updated, newHistoryEntry(order.id, actor, 'updated', changes, now))
}

export async function changeOrderStatus(
  orderNumber: string,
  to: OrderStatus,
  actor: string,
  reason?: string,
): Promise<ProductionOrder> {
  const order = await requireOrder(orderNumber)
  if (!canTransition(order.status, to)) {
    throw new OrderRuleError(
      `Cannot change status from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[to]}.`,
    )
  }
  const trimmedReason = reason?.trim() ?? ''
  if (to === 'cancelled' && trimmedReason.length < MIN_CANCEL_REASON_LENGTH) {
    throw new OrderRuleError(`A cancellation reason of at least ${MIN_CANCEL_REASON_LENGTH} characters is required.`)
  }

  const now = new Date().toISOString()
  const updated: ProductionOrder = {
    ...order,
    status: to,
    updatedAt: now,
    ...(to === 'cancelled' ? { cancelReason: trimmedReason } : {}),
  }
  const detail =
    `Status: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[to]}` +
    (to === 'cancelled' ? ` (Reason: ${trimmedReason})` : '')
  return mockRepository.replaceOrder(updated, newHistoryEntry(order.id, actor, 'status_changed', detail, now))
}
