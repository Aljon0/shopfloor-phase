import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { DefectType } from '@/types/domain'
import { DEFAULT_QUALITY_FILTERS, hasActiveQualityFilters } from '../lib/quality-filters'
import type { QualityFilters, ResultFilter } from '../types'

interface Props {
  filters: QualityFilters
  onChange: (filters: QualityFilters) => void
  products: { id: string; name: string }[]
  defects: DefectType[]
}

const RESULT_CHOICES = [
  { value: 'all', label: 'All results' },
  { value: 'passed', label: 'No failures' },
  { value: 'failed', label: 'Has failures' },
]

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </label>
  )
}

export function QualityFiltersBar({ filters, onChange, products, defects }: Props) {
  const productChoices = [{ value: 'all', label: 'All products' }, ...products.map((p) => ({ value: p.id, label: p.name }))]
  const defectChoices = [
    { value: 'all', label: 'All defects' },
    ...defects.map((d) => ({ value: d.id, label: d.name })),
    { value: 'none', label: 'No defect recorded' },
  ]
  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:w-64">
          <Label htmlFor="quality-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden="true" />
            <Input
              id="quality-search"
              type="search"
              className="pl-9"
              placeholder="Inspection, order, report or inspector"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="quality-product">Product</Label>
          <Select id="quality-product" value={filters.productId} options={productChoices} onChange={(e) => onChange({ ...filters, productId: e.target.value })} />
        </div>
        <div className="w-full sm:w-52">
          <Label htmlFor="quality-defect">Defect classification</Label>
          <Select id="quality-defect" value={filters.defectId} options={defectChoices} onChange={(e) => onChange({ ...filters, defectId: e.target.value })} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="quality-result">Result</Label>
          <Select id="quality-result" value={filters.result} options={RESULT_CHOICES} onChange={(e) => onChange({ ...filters, result: e.target.value as ResultFilter })} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="quality-from">From</Label>
          <DatePicker id="quality-from" value={filters.from} max={filters.to || undefined} onChange={(from) => onChange({ ...filters, from })} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="quality-to">To</Label>
          <DatePicker id="quality-to" value={filters.to} min={filters.from || undefined} onChange={(to) => onChange({ ...filters, to })} />
        </div>
        {hasActiveQualityFilters(filters) ? (
          <Button variant="ghost" onClick={() => onChange(DEFAULT_QUALITY_FILTERS)}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
