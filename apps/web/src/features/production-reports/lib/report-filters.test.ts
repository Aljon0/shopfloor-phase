import { describe, expect, it } from 'vitest'
import type { ProductionReport } from '@/types/domain'
import type { ReportListItem } from '../types'
import {
  DEFAULT_REPORT_FILTERS,
  filterReports,
  hasActiveReportFilters,
  parseReportFilters,
  reportFiltersToParams,
  sortReports,
} from './report-filters'

function item(overrides: Partial<ProductionReport>, names: Partial<ReportListItem> = {}): ReportListItem {
  const report: ProductionReport = {
    id: 'RPT-20261103-CUT-AM', orderId: 'PO-2026-001', lineId: 'line-cut-01', machineId: 'mc-lc-01',
    shift: 'morning', reportDate: '2026-11-03', operatorName: 'Juan Dela Cruz', shiftTarget: 250,
    producedQuantity: 210, rejectedQuantity: 8, status: 'approved',
    createdAt: '2026-11-03T13:00:00+08:00', updatedAt: '2026-11-03T13:00:00+08:00', ...overrides,
  }
  return {
    report, productName: 'Steel mounting brackets', lineName: 'Cutting Line 01', machineName: 'Laser Cutter LC-01',
    metrics: { goodQuantity: 202, rejectionRate: 3.8, targetAchievement: 80.8 }, ...names,
  }
}

const items = [
  item({}),
  item({ id: 'RPT-20261104-WLD-PM', reportDate: '2026-11-04', shift: 'night', lineId: 'line-weld-01', operatorName: 'Ana Lim', status: 'draft' },
    { lineName: 'Welding Line 01', machineName: 'Welding Cell WC-02', productName: 'Fabricated steel frames' }),
]

describe('report filters', () => {
  it('filters by status, line, shift and date range', () => {
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, status: 'draft' })).toHaveLength(1)
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, lineId: 'line-cut-01' })).toHaveLength(1)
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, shift: 'night' })).toHaveLength(1)
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, from: '2026-11-04' })).toHaveLength(1)
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, to: '2026-11-03' })).toHaveLength(1)
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, from: '2026-11-03', to: '2026-11-04' })).toHaveLength(2)
  })
  it('searches report, order, operator, machine, line and product', () => {
    for (const q of ['20261104', 'po-2026-001', 'ana lim', 'wc-02', 'welding line', 'frames']) {
      expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, q }).length).toBeGreaterThan(0)
    }
    expect(filterReports(items, { ...DEFAULT_REPORT_FILTERS, q: 'zzz' })).toHaveLength(0)
  })
  it('sorts newest first, morning before night', () => {
    const sorted = sortReports([...items, item({ id: 'RPT-20261104-CUT-AM', reportDate: '2026-11-04' })])
    expect(sorted.map((i) => i.report.id)).toEqual(['RPT-20261104-CUT-AM', 'RPT-20261104-WLD-PM', 'RPT-20261103-CUT-AM'])
  })
  it('round-trips through URL params and ignores invalid values', () => {
    const f = { ...DEFAULT_REPORT_FILTERS, q: 'bracket', status: 'returned' as const, shift: 'night' as const, from: '2026-11-01' }
    expect(parseReportFilters(reportFiltersToParams(f))).toEqual(f)
    expect(reportFiltersToParams(DEFAULT_REPORT_FILTERS).toString()).toBe('')
    expect(parseReportFilters(new URLSearchParams('status=bogus&shift=x&from=2026-13-40'))).toEqual(DEFAULT_REPORT_FILTERS)
    expect(hasActiveReportFilters(DEFAULT_REPORT_FILTERS)).toBe(false)
    expect(hasActiveReportFilters(f)).toBe(true)
  })
})
