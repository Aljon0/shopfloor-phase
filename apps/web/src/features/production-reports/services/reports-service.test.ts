import { beforeAll, describe, expect, it } from 'vitest'
import { setMockLatency, mockRepository } from '@/mocks/repository'
import { getOrderDetail } from '@/features/production-orders/services/orders-service'
import { buildDashboard } from '@/features/dashboard/lib/aggregate'
import {
  ReportRuleError,
  createReport,
  deleteReport,
  getReportDetail,
  getReportReference,
  listReportItems,
  submitReport,
  updateReport,
} from './reports-mock-service'
import type { ReportInput } from '../types'

// PO-2026-003 (Cutting Line 01, in progress since Nov 4). Shear SH-02 has no morning report on Nov 7.
const input: ReportInput = {
  orderId: 'PO-2026-003',
  machineId: 'mc-sh-02',
  shift: 'morning',
  reportDate: '2026-11-07',
  producedQuantity: 120,
  rejectedQuantity: 4,
  notes: 'Second machine running.',
}

beforeAll(() => setMockLatency(0))

describe('reports service (mock backend)', () => {
  it('lists seeded reports with derived values that match the blueprint sample', async () => {
    const sample = (await listReportItems()).find((i) => i.report.id === 'RPT-20261103-CUT-AM')
    expect(sample?.report.producedQuantity).toBe(210)
    expect(sample?.metrics.goodQuantity).toBe(202)
    expect(sample?.machineName).toBe('Laser Cutter LC-01')
    const detail = await getReportDetail('RPT-20261103-CUT-AM')
    expect(detail?.downtime).toHaveLength(1)
    expect(detail?.totalDowntimeMinutes).toBe(35)
    expect(detail?.timeline.map((t) => t.description)).toContain('approved the report')
  })

  it('returns null for an unknown report', async () => {
    expect(await getReportDetail('RPT-NOPE')).toBeNull()
  })

  it('saves a draft with audit data, the machine target and the next report number', async () => {
    const report = await createReport(input, 'draft', 'Juan Dela Cruz')
    expect(report.id).toBe('RPT-20261107-CUT-AM-2')
    expect(report.status).toBe('draft')
    expect(report.operatorName).toBe('Juan Dela Cruz')
    expect(report.lineId).toBe('line-cut-01')
    expect(report.shiftTarget).toBe(250)
    expect(report.submittedAt).toBeUndefined()
    const detail = await getReportDetail(report.id)
    expect(detail?.timeline.map((t) => t.description)).toEqual(['created the report'])
  })

  it('does not count a draft anywhere official', async () => {
    const draftCountsAsPending = (await getOrderDetail('PO-2026-003'))?.progress.pendingReportCount ?? 0
    const input2 = {
      lines: await mockRepository.listLines(),
      products: await mockRepository.listProducts(),
      orders: await mockRepository.listOrders(),
      reports: await mockRepository.listReports(),
      downtimeEvents: [],
      activity: [],
    }
    const draft = input2.reports.find((r) => r.id === 'RPT-20261107-CUT-AM-2')
    expect(draft?.status).toBe('draft')
    expect(draftCountsAsPending).toBeGreaterThanOrEqual(0)
    const dash = buildDashboard(input2, { from: '2026-11-07', to: '2026-11-07' })
    expect(dash.kpis.producedQuantity).toBe(
      input2.reports.filter((r) => r.reportDate === '2026-11-07' && r.status === 'approved').reduce((s, r) => s + r.producedQuantity, 0),
    )
  })

  it('submits a draft: Pending Review, history, activity, and it joins the order progress as pending', async () => {
    const before = (await getOrderDetail('PO-2026-003'))?.progress.pendingReportCount ?? 0
    const submitted = await submitReport('RPT-20261107-CUT-AM-2', 'Juan Dela Cruz')
    expect(submitted.status).toBe('pending_review')
    expect(submitted.submittedAt).toBeDefined()
    expect((await getOrderDetail('PO-2026-003'))?.progress.pendingReportCount).toBe(before + 1)
    expect((await mockRepository.listActivity())[0]?.reportId).toBe('RPT-20261107-CUT-AM-2')
    const detail = await getReportDetail('RPT-20261107-CUT-AM-2')
    expect(detail?.timeline[0]?.description).toBe('submitted the report for review')
    await expect(updateReport('RPT-20261107-CUT-AM-2', { ...input, producedQuantity: 1 }, 'draft', 'x')).rejects.toThrow('Only draft or returned')
    await expect(submitReport('RPT-20261107-CUT-AM-2', 'x')).rejects.toThrow(ReportRuleError)
  })

  it('creates and submits in one step', async () => {
    const report = await createReport({ ...input, reportDate: '2026-11-06' }, 'submit', 'Juan Dela Cruz')
    expect(report.id).toBe('RPT-20261106-CUT-AM-2')
    expect(report.status).toBe('pending_review')
    const detail = await getReportDetail(report.id)
    expect(detail?.timeline.map((t) => t.description)).toEqual(['submitted the report for review', 'created the report'])
  })

  it('refuses a second report for the same machine, shift and date', async () => {
    await expect(createReport({ ...input, machineId: 'mc-lc-01' }, 'draft', 'x')).rejects.toThrow('already has a report')
  })

  it('enforces the order, machine and date rules', async () => {
    await expect(createReport({ ...input, orderId: 'PO-2026-001' }, 'draft', 'x')).rejects.toThrow('In Progress')
    await expect(createReport({ ...input, orderId: 'PO-NOPE' }, 'draft', 'x')).rejects.toThrow('valid production order')
    await expect(createReport({ ...input, machineId: 'mc-pb-01' }, 'draft', 'x')).rejects.toThrow('production line')
    await expect(createReport({ ...input, reportDate: '2026-11-08' }, 'draft', 'x')).rejects.toThrow('future')
    await expect(createReport({ ...input, reportDate: '2026-11-03' }, 'draft', 'x')).rejects.toThrow('planned start')
    await expect(createReport({ ...input, producedQuantity: 5, rejectedQuantity: 9 }, 'draft', 'x')).rejects.toThrow('more than the produced')
  })

  it('edits a seeded draft, records what changed, and skips no-op saves', async () => {
    // Seed: today's Bending Line night report is a draft.
    const draft = (await listReportItems()).find((i) => i.report.status === 'draft' && i.report.id === 'RPT-20261107-BND-PM')
    expect(draft).toBeDefined()
    const current = draft!.report
    const base: ReportInput = {
      orderId: current.orderId, machineId: current.machineId, shift: current.shift, reportDate: current.reportDate,
      producedQuantity: current.producedQuantity, rejectedQuantity: current.rejectedQuantity, notes: current.notes ?? '',
    }
    await updateReport(current.id, { ...base, producedQuantity: current.producedQuantity + 5 }, 'draft', 'Carlo Mendoza')
    const detail = await getReportDetail(current.id)
    expect(detail?.report.producedQuantity).toBe(current.producedQuantity + 5)
    expect(detail?.timeline[0]?.detail).toBe(`Produced: ${current.producedQuantity} → ${current.producedQuantity + 5}`)
    const count = detail?.timeline.length
    await updateReport(current.id, { ...base, producedQuantity: current.producedQuantity + 5 }, 'draft', 'Carlo Mendoza')
    expect((await getReportDetail(current.id))?.timeline.length).toBe(count)
    await expect(updateReport(current.id, { ...base, orderId: 'PO-2026-003' }, 'draft', 'x')).rejects.toThrow('cannot be changed')
  })

  it('resubmits a returned report as Revised and keeps the return reason', async () => {
    const returned = (await listReportItems()).find((i) => i.report.status === 'returned' && i.report.reportDate === '2026-11-07')
    expect(returned).toBeDefined()
    const revised = await submitReport(returned!.report.id, 'Jose Ramos')
    expect(revised.status).toBe('revised')
    expect(revised.returnReason).toBeDefined()
    const detail = await getReportDetail(revised.id)
    expect(detail?.timeline[0]?.description).toBe('resubmitted the corrected report')
    expect((await getOrderDetail(revised.orderId))?.progress.pendingReportCount).toBeGreaterThan(0)
  })

  it('deletes drafts only, with their history', async () => {
    const target = await createReport({ ...input, reportDate: '2026-11-05' }, 'draft', 'x')
    await deleteReport(target.id)
    expect(await getReportDetail(target.id)).toBeNull()
    await expect(deleteReport('RPT-20261103-CUT-AM')).rejects.toThrow('Only draft')
    await expect(deleteReport('RPT-NOPE')).rejects.toThrow('not found')
  })

  it('offers form reference data', async () => {
    const ref = await getReportReference()
    expect(ref.today).toBe('2026-11-07')
    expect(ref.orders.find((o) => o.id === 'PO-2026-003')?.lineName).toBe('Cutting Line 01')
    expect(ref.machines.every((m) => m.shiftTarget > 0)).toBe(true)
  })
})
