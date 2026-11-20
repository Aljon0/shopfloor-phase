import {
  MIN_CANCEL_REASON_LENGTH,
  ORDER_STATUS_LABELS,
  canTransition,
  describeChanges,
  downtimeMinutes,
  isEditable,
  isOverdue,
  lockedFields,
  nextOrderNumber,
  orderProgress,
  rejectionRate,
  validateOrderInput,
  type OrderInput,
  type OrderStatus,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import { badRequest, notFound, ruleViolation } from '../../lib/errors'
import { newId } from '../../lib/ids'
import type { AuthUser } from '../../middleware/context'

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0]
type Reader = Db | Tx
export type InitialStatus = 'draft' | 'planned'

const FACTORY_TIME_ZONE = 'Asia/Manila'

/** Today's date at the factory (YYYY-MM-DD), not the server's time zone. */
export function factoryToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FACTORY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`)
const fromDate = (d: Date): string => d.toISOString().slice(0, 10)

interface OrderRow {
  orderNumber: string
  productId: string
  lineId: string
  plannedQuantity: number
  plannedStart: Date
  dueDate: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
  instructions: string
  status: OrderStatus
  cancelReason: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: { name: string }
}

/** JSON shape equals the web's ProductionOrder, so the web needs no translation layer. */
function toOrder(o: OrderRow) {
  return {
    id: o.orderNumber,
    orderNumber: o.orderNumber,
    productId: o.productId,
    lineId: o.lineId,
    plannedQuantity: o.plannedQuantity,
    plannedStart: fromDate(o.plannedStart),
    dueDate: fromDate(o.dueDate),
    priority: o.priority,
    instructions: o.instructions,
    status: o.status,
    ...(o.cancelReason ? { cancelReason: o.cancelReason } : {}),
    createdAt: o.createdAt.toISOString(),
    createdBy: o.createdBy.name,
    updatedAt: o.updatedAt.toISOString(),
  }
}

function toInput(o: OrderRow): OrderInput {
  return {
    productId: o.productId,
    lineId: o.lineId,
    plannedQuantity: o.plannedQuantity,
    plannedStart: fromDate(o.plannedStart),
    dueDate: fromDate(o.dueDate),
    priority: o.priority,
    instructions: o.instructions,
  }
}

function checkInput(input: OrderInput, minPlanned: number): OrderInput {
  const errors = validateOrderInput(input, minPlanned)
  const messages = Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === 'string')
  if (messages.length > 0) throw badRequest('Some fields are not valid.', Object.fromEntries(messages))
  return { ...input, instructions: input.instructions.trim() }
}

const orderInclude = { createdBy: { select: { name: true } } } as const

// ------------------------------------------------------------------- reads
export async function listOrders(db: Db) {
  const [orders, products, lines, reports] = await Promise.all([
    db.productionOrder.findMany({ include: orderInclude, orderBy: { orderNumber: 'desc' } }),
    db.product.findMany({ select: { id: true, name: true } }),
    db.productionLine.findMany({ select: { id: true, name: true } }),
    db.productionReport.findMany({ select: { orderId: true, status: true, producedQuantity: true, rejectedQuantity: true } }),
  ])
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const lineNames = new Map(lines.map((l) => [l.id, l.name]))
  const byOrder = new Map<string, typeof reports>()
  for (const r of reports) byOrder.set(r.orderId, [...(byOrder.get(r.orderId) ?? []), r])
  const today = factoryToday()
  return orders.map((o) => {
    const order = toOrder(o)
    return {
      order,
      productName: productNames.get(o.productId) ?? 'Unknown product',
      lineName: lineNames.get(o.lineId) ?? 'Unknown line',
      progress: orderProgress(o.plannedQuantity, byOrder.get(o.orderNumber) ?? []),
      overdue: isOverdue(order, today),
    }
  })
}

export async function getOrderDetail(db: Db, orderNumber: string) {
  const o = await db.productionOrder.findUnique({
    where: { orderNumber },
    include: {
      ...orderInclude,
      product: { select: { name: true } },
      line: { select: { name: true } },
      history: { include: { actor: { select: { name: true } } } },
      reports: { include: { machine: { select: { name: true } }, operator: { select: { name: true } } } },
      downtime: { include: { machine: { select: { name: true } }, recordedBy: { select: { name: true } } } },
    },
  })
  if (!o) throw notFound(`Order ${orderNumber} was not found.`)

  const order = toOrder(o)
  const reports = o.reports
    .map((r) => ({
      id: r.id,
      reportDate: fromDate(r.reportDate),
      shift: r.shiftId,
      machineName: r.machine.name,
      operatorName: r.operator.name,
      producedQuantity: r.producedQuantity,
      rejectedQuantity: r.rejectedQuantity,
      goodQuantity: r.producedQuantity - r.rejectedQuantity,
      rejectionRate: rejectionRate(r.rejectedQuantity, r.producedQuantity),
      status: r.status,
    }))
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.id.localeCompare(b.id))

  const downtime = o.downtime
    .flatMap((e) => {
      const minutes = downtimeMinutes(e.startTime.toISOString(), e.endTime.toISOString())
      return minutes === null
        ? []
        : [{ id: e.id, machineName: e.machine.name, startTime: e.startTime.toISOString(), endTime: e.endTime.toISOString(), minutes, category: e.category, notes: e.notes, recordedBy: e.recordedBy.name }]
    })
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))

  const historyText = { created: 'created the order', updated: 'updated the order', status_changed: 'changed the order status' } as const
  // Report and downtime activity joins this timeline when those modules move to the API (8C/8D).
  const timeline = o.history
    .map((h) => ({
      id: h.id,
      timestamp: h.timestamp.toISOString(),
      actor: h.actor.name,
      description: historyText[h.action as keyof typeof historyText] ?? h.action,
      detail: h.detail,
    }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return {
    order,
    productName: o.product.name,
    lineName: o.line.name,
    progress: orderProgress(o.plannedQuantity, o.reports),
    overdue: isOverdue(order, factoryToday()),
    reports,
    downtime,
    timeline,
  }
}

// ------------------------------------------------------------------ writes
async function history(tx: Tx, orderId: string, actor: AuthUser, action: 'created' | 'updated' | 'status_changed', detail: string): Promise<void> {
  await tx.orderHistory.create({ data: { id: newId('oh'), orderId, actorId: actor.id, action, detail } })
}

/** Locks the order row so two supervisors changing the same order take turns instead of overwriting each other. */
async function lockOrder(tx: Tx, orderNumber: string): Promise<OrderRow> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM production_orders WHERE id = ${orderNumber} FOR UPDATE`
  if (locked.length === 0) throw notFound(`Order ${orderNumber} was not found.`)
  const row = await tx.productionOrder.findUnique({ where: { orderNumber }, include: orderInclude })
  if (!row) throw notFound(`Order ${orderNumber} was not found.`)
  return row
}

export async function createOrder(db: Db, actor: AuthUser, rawInput: OrderInput, status: InitialStatus) {
  const input = checkInput(rawInput, 0)
  return db.$transaction(async (tx) => {
    const [product, line] = await Promise.all([
      tx.product.findUnique({ where: { id: input.productId } }),
      tx.productionLine.findUnique({ where: { id: input.lineId } }),
    ])
    if (!product) throw badRequest('Some fields are not valid.', { productId: 'Select a valid product.' })
    if (!line) throw badRequest('Some fields are not valid.', { lineId: 'Select a valid production line.' })
    if (!product.isActive) throw ruleViolation(`${product.name} is inactive and cannot be used for new orders.`)
    if (!line.isActive) throw ruleViolation(`${line.name} is inactive and cannot be used for new orders.`)

    // One order number at a time, so two supervisors creating orders never receive the same number.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production_order_number'))`
    const year = Number(factoryToday().slice(0, 4))
    const existing = await tx.productionOrder.findMany({ where: { orderNumber: { startsWith: `PO-${year}-` } }, select: { orderNumber: true } })
    const orderNumber = nextOrderNumber(existing.map((e) => e.orderNumber), year)

    const created = await tx.productionOrder.create({
      data: {
        id: orderNumber,
        orderNumber,
        productId: input.productId,
        lineId: input.lineId,
        plannedQuantity: input.plannedQuantity,
        plannedStart: toDate(input.plannedStart),
        dueDate: toDate(input.dueDate),
        priority: input.priority,
        instructions: input.instructions,
        status,
        createdById: actor.id,
      },
      include: orderInclude,
    })
    await history(tx, orderNumber, actor, 'created', `Order created as ${ORDER_STATUS_LABELS[status]}`)
    return toOrder(created)
  })
}

export async function updateOrder(db: Db, actor: AuthUser, orderNumber: string, rawInput: OrderInput) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderNumber)
    if (!isEditable(order.status)) throw ruleViolation(`${ORDER_STATUS_LABELS[order.status]} orders cannot be edited.`)
    for (const field of lockedFields(order.status)) {
      if (rawInput[field] !== order[field]) throw ruleViolation('Product and production line cannot be changed once production has started.')
    }

    const reports = await tx.productionReport.findMany({ where: { orderId: orderNumber }, select: { status: true, producedQuantity: true, rejectedQuantity: true } })
    const { committedProduced } = orderProgress(order.plannedQuantity, reports)
    const input = checkInput(rawInput, committedProduced)

    // Inactive records stay on existing orders; they just cannot be newly chosen.
    const [newProduct, newLine] = await Promise.all([
      tx.product.findUnique({ where: { id: input.productId } }),
      tx.productionLine.findUnique({ where: { id: input.lineId } }),
    ])
    if (!newProduct) throw badRequest('Some fields are not valid.', { productId: 'Select a valid product.' })
    if (!newLine) throw badRequest('Some fields are not valid.', { lineId: 'Select a valid production line.' })
    if (input.productId !== order.productId && !newProduct.isActive) throw ruleViolation(`${newProduct.name} is inactive and cannot be chosen.`)
    if (input.lineId !== order.lineId && !newLine.isActive) throw ruleViolation(`${newLine.name} is inactive and cannot be chosen.`)

    const before = toInput(order)
    const oldProduct = input.productId === order.productId ? newProduct : await tx.product.findUnique({ where: { id: order.productId } })
    const oldLine = input.lineId === order.lineId ? newLine : await tx.productionLine.findUnique({ where: { id: order.lineId } })
    const names: Record<string, string> = {
      [order.productId]: oldProduct?.name ?? order.productId,
      [input.productId]: newProduct.name,
      [order.lineId]: oldLine?.name ?? order.lineId,
      [input.lineId]: newLine.name,
    }
    const changes = describeChanges(before, input, (field, value) => (field === 'productId' || field === 'lineId' ? names[String(value)] ?? String(value) : String(value)))
    if (changes === '') return toOrder(order)

    const updated = await tx.productionOrder.update({
      where: { orderNumber },
      data: {
        productId: input.productId,
        lineId: input.lineId,
        plannedQuantity: input.plannedQuantity,
        plannedStart: toDate(input.plannedStart),
        dueDate: toDate(input.dueDate),
        priority: input.priority,
        instructions: input.instructions,
      },
      include: orderInclude,
    })
    await history(tx, orderNumber, actor, 'updated', changes)
    return toOrder(updated)
  })
}

export async function changeOrderStatus(db: Db, actor: AuthUser, orderNumber: string, to: OrderStatus, reason: string | undefined) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderNumber)
    if (!canTransition(order.status, to)) {
      throw ruleViolation(`Cannot change status from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[to]}.`)
    }
    const trimmed = reason?.trim() ?? ''
    if (to === 'cancelled' && trimmed.length < MIN_CANCEL_REASON_LENGTH) {
      throw badRequest('Some fields are not valid.', { reason: `A cancellation reason of at least ${MIN_CANCEL_REASON_LENGTH} characters is required.` })
    }
    const updated = await tx.productionOrder.update({
      where: { orderNumber },
      data: { status: to, ...(to === 'cancelled' ? { cancelReason: trimmed } : {}) },
      include: orderInclude,
    })
    await history(tx, orderNumber, actor, 'status_changed', `Status: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[to]}${to === 'cancelled' ? ` (Reason: ${trimmed})` : ''}`)
    return toOrder(updated)
  })
}
