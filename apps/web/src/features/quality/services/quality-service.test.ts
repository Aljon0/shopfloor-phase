import { beforeAll, describe, expect, it } from 'vitest'
import { getReportDetail } from '@/features/production-reports/services/reports-service'
import { setMockLatency } from '@/mocks/repository'
import { createInspection, getInspectionItem, getQualityReference, listInspectionItems, updateInspection } from './quality-mock-service'
import type { InspectionInput } from '../types'

const input: InspectionInput = {
  orderId: 'PO-2026-003', reportId: '', inspectionDate: '2026-11-06', inspectedQuantity: 80, failedQuantity: 3, defectId: 'defect-burr', notes: 'Spot check',
}

beforeAll(() => setMockLatency(0))

describe('quality service (mock backend)', () => {
  it('lists the sample inspection on the blueprint report', async () => {
    const sample = (await listInspectionItems()).find((i) => i.inspection.reportId === 'RPT-20261103-CUT-AM')
    expect(sample?.inspection.inspectedQuantity).toBe(120)
    expect(sample?.inspection.failedQuantity).toBe(4)
    expect(sample?.inspection.passedQuantity).toBe(116)
    expect(sample?.defectName).toBe('Dimensional deviation')
    expect(sample?.productName).toBe('Steel mounting brackets')
    expect(sample?.passRate).toBeCloseTo(96.667, 3)
  })

  it('keeps every seeded inspection consistent: passed + failed = inspected, defect only with failures', async () => {
    for (const { inspection } of await listInspectionItems()) {
      expect(inspection.passedQuantity + inspection.failedQuantity).toBe(inspection.inspectedQuantity)
      expect(inspection.defectId !== undefined).toBe(inspection.failedQuantity > 0)
    }
  })

  it('creates an inspection: product from the order, passed calculated, next number, inspector', async () => {
    const saved = await createInspection(input, 'Rosa Villanueva')
    expect(saved.id).toMatch(/^QI-2026-\d{4}$/)
    expect(saved.productId).toBe((await listInspectionItems()).find((i) => i.inspection.orderId === 'PO-2026-003')?.inspection.productId)
    expect(saved.passedQuantity).toBe(77)
    expect(saved.inspector).toBe('Rosa Villanueva')
    expect((await getInspectionItem(saved.id))?.defectName).toBe('Burr or rough edge')
  })

  it('drops the defect when nothing failed', async () => {
    const saved = await createInspection({ ...input, failedQuantity: 0 }, 'x')
    expect(saved.defectId).toBeUndefined()
    expect(saved.passedQuantity).toBe(80)
  })

  it('enforces the order, report, quantity and date rules', async () => {
    await expect(createInspection({ ...input, orderId: 'PO-NOPE' }, 'x')).rejects.toThrow('valid production order')
    await expect(createInspection({ ...input, reportId: 'RPT-20261103-CUT-AM' }, 'x')).rejects.toThrow('different production order')
    await expect(createInspection({ ...input, reportId: 'RPT-NOPE' }, 'x')).rejects.toThrow('valid production report')
    await expect(createInspection({ ...input, failedQuantity: 90 }, 'x')).rejects.toThrow('more than the inspected')
    await expect(createInspection({ ...input, defectId: '' }, 'x')).rejects.toThrow('defect classification')
    await expect(createInspection({ ...input, defectId: 'defect-nope' }, 'x')).rejects.toThrow('valid defect')
    await expect(createInspection({ ...input, inspectionDate: '2026-11-08' }, 'x')).rejects.toThrow('future')
  })

  it('caps the inspected quantity at what the linked report produced', async () => {
    const report = (await getQualityReference()).reports.find((r) => r.orderId === 'PO-2026-001')
    expect(report).toBeDefined()
    await expect(createInspection({ ...input, orderId: 'PO-2026-001', reportId: report!.id, inspectedQuantity: report!.producedQuantity + 1, failedQuantity: 0, inspectionDate: '2026-11-04' }, 'x')).rejects.toThrow('cannot be more than')
  })

  it('shows a linked inspection on the report', async () => {
    const before = (await getReportDetail('RPT-20261103-CUT-AM'))?.inspections.length ?? 0
    expect(before).toBeGreaterThan(0)
    const detail = await getReportDetail('RPT-20261103-CUT-AM')
    expect(detail?.inspections[0]?.defectName).toBe('Dimensional deviation')
  })

  it('edits an inspection, keeps the inspector and order, and recalculates passed', async () => {
    const created = await createInspection({ ...input, inspectedQuantity: 60, failedQuantity: 2 }, 'Rosa Villanueva')
    const updated = await updateInspection(created.id, { ...input, inspectedQuantity: 60, failedQuantity: 6, notes: 'Re-counted' })
    expect(updated.inspector).toBe('Rosa Villanueva')
    expect(updated.passedQuantity).toBe(54)
    expect(updated.failedQuantity).toBe(6)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime())
    await expect(updateInspection(created.id, { ...input, orderId: 'PO-2026-005' })).rejects.toThrow('cannot be changed')
    await expect(updateInspection('QI-2026-9999', input)).rejects.toThrow('not found')
  })

  it('offers form reference data', async () => {
    const ref = await getQualityReference()
    expect(ref.today).toBe('2026-11-07')
    expect(ref.defects).toHaveLength(6)
    expect(ref.orders.length).toBeGreaterThan(5)
  })
})
