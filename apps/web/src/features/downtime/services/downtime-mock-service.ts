/**
 * Service boundary for downtime events (mock backend today, API later). Rules are enforced here,
 * not only in the form: hiding or disabling UI is not security.
 */
import { downtimeMinutes } from '@/lib/kpi'
import { mockRepository } from '@/mocks/repository'
import { getFactoryToday } from '@/services/factory-clock'
import type { ActivityItem, DowntimeEvent } from '@/types/domain'
import { buildDowntimeFormSchema } from '../lib/downtime-form-schema'
import { findOverlap, isEventLocked, nextEventId, toFactoryIso } from '../lib/downtime-rules'
import type { DowntimeInput, DowntimeListItem, DowntimeReferenceData } from '../types'

export class DowntimeRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DowntimeRuleError'
  }
}

export async function getDowntimeReference(): Promise<DowntimeReferenceData> {
  const [lines, machines, orders, products, reports] = await Promise.all([
    mockRepository.listLines(),
    mockRepository.listMachines(),
    mockRepository.listOrders(),
    mockRepository.listProducts(),
    mockRepository.listReports(),
  ])
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  return {
    lines,
    machines: machines.map((m) => ({ id: m.id, name: m.name, lineId: m.lineId, isActive: m.isActive })),
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      lineId: o.lineId,
      status: o.status,
      productName: productNames.get(o.productId) ?? 'Unknown product',
    })),
    reports: reports.map((r) => ({ id: r.id, machineId: r.machineId, orderId: r.orderId, reportDate: r.reportDate, status: r.status })),
    today: getFactoryToday(),
  }
}

export async function listDowntimeItems(): Promise<DowntimeListItem[]> {
  const [events, lines, machines, reports] = await Promise.all([
    mockRepository.listDowntimeEvents(),
    mockRepository.listLines(),
    mockRepository.listMachines(),
    mockRepository.listReports(),
  ])
  const lineNames = new Map(lines.map((l) => [l.id, l.name]))
  const machineNames = new Map(machines.map((m) => [m.id, m.name]))
  const reportStatus = new Map(reports.map((r) => [r.id, r.status]))
  const items: DowntimeListItem[] = []
  for (const event of events) {
    const minutes = downtimeMinutes(event.startTime, event.endTime)
    if (minutes === null) continue
    items.push({
      event,
      minutes,
      lineName: lineNames.get(event.lineId) ?? event.lineId,
      machineName: machineNames.get(event.machineId) ?? event.machineId,
      reportStatus: event.reportId ? (reportStatus.get(event.reportId) ?? null) : null,
    })
  }
  return items
}

/** Returns null when the event does not exist. */
export async function getDowntimeItem(eventId: string): Promise<DowntimeListItem | null> {
  return (await listDowntimeItems()).find((i) => i.event.id === eventId) ?? null
}

async function validateInput(input: DowntimeInput, excludeId?: string, keepMachineId?: string) {
  const parsed = buildDowntimeFormSchema({ today: getFactoryToday() }).safeParse(input)
  if (!parsed.success) throw new DowntimeRuleError(parsed.error.issues.map((i) => i.message).join('. '))
  const clean = parsed.data

  const [machines, orders, reports, events] = await Promise.all([
    mockRepository.listMachines(),
    mockRepository.listOrders(),
    mockRepository.listReports(),
    mockRepository.listDowntimeEvents(),
  ])
  const machine = machines.find((m) => m.id === clean.machineId)
  if (!machine) throw new DowntimeRuleError('Select a valid machine.')
  if (!machine.isActive && machine.id !== keepMachineId) {
    throw new DowntimeRuleError(`${machine.name} is inactive and cannot be used for new downtime events.`)
  }

  if (clean.orderId !== '') {
    const order = orders.find((o) => o.id === clean.orderId)
    if (!order) throw new DowntimeRuleError('Select a valid production order.')
    if (order.lineId !== machine.lineId) throw new DowntimeRuleError("The order is not on this machine's production line.")
  }
  if (clean.reportId !== '') {
    const report = reports.find((r) => r.id === clean.reportId)
    if (!report) throw new DowntimeRuleError('Select a valid production report.')
    if (report.machineId !== machine.id) throw new DowntimeRuleError("The report belongs to a different machine.")
    if (isEventLocked(report.status)) throw new DowntimeRuleError('Downtime cannot be linked to an approved report.')
  }

  const startTime = toFactoryIso(clean.startTime)
  const endTime = toFactoryIso(clean.endTime)
  const overlap = findOverlap(events, { machineId: machine.id, startTime, endTime }, excludeId)
  if (overlap) throw new DowntimeRuleError(`This overlaps ${overlap}, another downtime event on ${machine.name}.`)
  return { clean, machine, startTime, endTime }
}

export async function createDowntimeEvent(input: DowntimeInput, actor: string): Promise<DowntimeEvent> {
  const { clean, machine, startTime, endTime } = await validateInput(input)
  const events = await mockRepository.listDowntimeEvents()
  const id = nextEventId(events.map((e) => e.id))
  const event: DowntimeEvent = {
    id,
    lineId: machine.lineId,
    machineId: machine.id,
    ...(clean.orderId !== '' ? { orderId: clean.orderId } : {}),
    ...(clean.reportId !== '' ? { reportId: clean.reportId } : {}),
    startTime,
    endTime,
    category: clean.category,
    notes: clean.notes,
    recordedBy: actor,
  }
  const activity: ActivityItem = {
    id: `ACT-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actor,
    kind: 'downtime_recorded',
    ...(event.orderId ? { orderId: event.orderId } : {}),
    ...(event.reportId ? { reportId: event.reportId } : {}),
    subject: `${id} · ${machine.name}`,
  }
  return mockRepository.insertDowntimeEvent(event, activity)
}

export async function updateDowntimeEvent(eventId: string, input: DowntimeInput): Promise<DowntimeEvent> {
  const current = await getDowntimeItem(eventId)
  if (!current) throw new DowntimeRuleError(`Event ${eventId} was not found.`)
  if (isEventLocked(current.reportStatus)) {
    throw new DowntimeRuleError('This event belongs to an approved report and cannot be edited.')
  }
  const { clean, machine, startTime, endTime } = await validateInput(input, eventId, current.event.machineId)
  const { orderId: _o, reportId: _r, ...rest } = current.event
  const event: DowntimeEvent = {
    ...rest,
    lineId: machine.lineId,
    machineId: machine.id,
    ...(clean.orderId !== '' ? { orderId: clean.orderId } : {}),
    ...(clean.reportId !== '' ? { reportId: clean.reportId } : {}),
    startTime,
    endTime,
    category: clean.category,
    notes: clean.notes,
  }
  return mockRepository.replaceDowntimeEvent(event)
}
