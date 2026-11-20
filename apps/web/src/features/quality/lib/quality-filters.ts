import { isValidDateString } from '@/lib/dates'
import type { InspectionItem, QualityFilters, ResultFilter } from '../types'
import { NO_DEFECT_KEY } from './quality-rules'

export const DEFAULT_QUALITY_FILTERS: QualityFilters = { q: '', productId: 'all', defectId: 'all', result: 'all', from: '', to: '' }

const RESULTS = new Set<string>(['all', 'passed', 'failed'])

export function hasActiveQualityFilters(f: QualityFilters): boolean {
  return f.q.trim() !== '' || f.productId !== 'all' || f.defectId !== 'all' || f.result !== 'all' || f.from !== '' || f.to !== ''
}

export function parseQualityFilters(params: URLSearchParams): QualityFilters {
  const result = params.get('result') ?? 'all'
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  return {
    q: params.get('q') ?? '',
    productId: params.get('product') ?? 'all',
    defectId: params.get('defect') ?? 'all',
    result: RESULTS.has(result) ? (result as ResultFilter) : 'all',
    from: isValidDateString(from) ? from : '',
    to: isValidDateString(to) ? to : '',
  }
}

export function qualityFiltersToParams(f: QualityFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.q.trim() !== '') params.set('q', f.q)
  if (f.productId !== 'all') params.set('product', f.productId)
  if (f.defectId !== 'all') params.set('defect', f.defectId)
  if (f.result !== 'all') params.set('result', f.result)
  if (f.from !== '') params.set('from', f.from)
  if (f.to !== '') params.set('to', f.to)
  return params
}

export function filterInspections(items: readonly InspectionItem[], f: QualityFilters): InspectionItem[] {
  const query = f.q.trim().toLowerCase()
  return items.filter(({ inspection, productName, defectName }) => {
    if (f.productId !== 'all' && inspection.productId !== f.productId) return false
    if (f.defectId === NO_DEFECT_KEY ? inspection.defectId !== undefined : f.defectId !== 'all' && inspection.defectId !== f.defectId) return false
    if (f.result === 'failed' && inspection.failedQuantity === 0) return false
    if (f.result === 'passed' && inspection.failedQuantity > 0) return false
    if (f.from !== '' && inspection.inspectionDate < f.from) return false
    if (f.to !== '' && inspection.inspectionDate > f.to) return false
    if (query === '') return true
    const haystack = `${inspection.id} ${inspection.orderId} ${inspection.reportId ?? ''} ${inspection.inspector} ${productName} ${defectName ?? ''} ${inspection.notes}`.toLowerCase()
    return haystack.includes(query)
  })
}

/** Newest inspection date first, then by number (highest first). */
export function sortInspections(items: readonly InspectionItem[]): InspectionItem[] {
  return [...items].sort(
    (a, b) => b.inspection.inspectionDate.localeCompare(a.inspection.inspectionDate) || b.inspection.id.localeCompare(a.inspection.id),
  )
}
