import { describe, expect, it } from 'vitest'
import type { InspectionItem } from '../types'
import { DEFAULT_QUALITY_FILTERS, filterInspections, hasActiveQualityFilters, parseQualityFilters, qualityFiltersToParams, sortInspections } from './quality-filters'

const item = (id: string, date: string, failed: number, over: Partial<InspectionItem['inspection']> = {}, defectName: string | null = null): InspectionItem => ({
  inspection: {
    id, orderId: 'PO-2026-001', reportId: 'RPT-1', productId: 'p1', inspectionDate: date, inspectedQuantity: 100,
    passedQuantity: 100 - failed, failedQuantity: failed, ...(failed > 0 ? { defectId: 'defect-burr' } : {}), notes: 'sample', inspector: 'Rosa',
    createdAt: '', updatedAt: '', ...over,
  },
  productName: 'Steel mounting brackets', lineName: 'Cutting Line 01', defectName, reportStatus: null, passRate: 100 - failed,
})
const items = [item('QI-2026-0001', '2026-11-03', 0), item('QI-2026-0002', '2026-11-04', 5, { productId: 'p2', inspector: 'Ana Lim' }, 'Burr or rough edge')]

describe('quality filters', () => {
  it('filters by product, defect, result and date range', () => {
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, productId: 'p2' })).toHaveLength(1)
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, defectId: 'defect-burr' })).toHaveLength(1)
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, defectId: 'none' })).toHaveLength(1)
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, result: 'failed' })[0]?.inspection.id).toBe('QI-2026-0002')
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, result: 'passed' })[0]?.inspection.id).toBe('QI-2026-0001')
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, from: '2026-11-04' })).toHaveLength(1)
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, to: '2026-11-03' })).toHaveLength(1)
  })
  it('searches id, order, inspector and defect name', () => {
    for (const q of ['0002', 'po-2026-001', 'ana lim', 'rough edge']) expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, q }).length).toBeGreaterThan(0)
    expect(filterInspections(items, { ...DEFAULT_QUALITY_FILTERS, q: 'zzz' })).toHaveLength(0)
  })
  it('sorts newest first', () => expect(sortInspections(items).map((i) => i.inspection.id)).toEqual(['QI-2026-0002', 'QI-2026-0001']))
  it('round-trips through URL params and ignores invalid values', () => {
    const f = { ...DEFAULT_QUALITY_FILTERS, q: 'x', result: 'failed' as const, defectId: 'none', from: '2026-11-01' }
    expect(parseQualityFilters(qualityFiltersToParams(f))).toEqual(f)
    expect(parseQualityFilters(new URLSearchParams('result=bogus&to=2026-99-99'))).toEqual(DEFAULT_QUALITY_FILTERS)
    expect(hasActiveQualityFilters(DEFAULT_QUALITY_FILTERS)).toBe(false)
  })
})
