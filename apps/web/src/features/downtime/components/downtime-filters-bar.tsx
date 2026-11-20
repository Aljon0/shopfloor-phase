import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { DowntimeCategory } from '@/types/domain'
import { DEFAULT_DOWNTIME_FILTERS, hasActiveDowntimeFilters } from '../lib/downtime-filters'
import { CATEGORY_OPTIONS } from '../lib/downtime-rules'
import type { DowntimeFilters, DowntimeReferenceData } from '../types'

interface Props {
  filters: DowntimeFilters
  onChange: (filters: DowntimeFilters) => void
  reference: DowntimeReferenceData | undefined
}

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </label>
  )
}

export function DowntimeFiltersBar({ filters, onChange, reference }: Props) {
  const lineChoices = [{ value: 'all', label: 'All lines' }, ...(reference?.lines ?? []).map((l) => ({ value: l.id, label: l.name }))]
  // Machine choices follow the selected line.
  const machineChoices = [
    { value: 'all', label: 'All machines' },
    ...(reference?.machines ?? [])
      .filter((m) => filters.lineId === 'all' || m.lineId === filters.lineId)
      .map((m) => ({ value: m.id, label: m.name })),
  ]
  const categoryChoices = [{ value: 'all', label: 'All categories' }, ...CATEGORY_OPTIONS]

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:w-64">
          <Label htmlFor="downtime-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden="true" />
            <Input
              id="downtime-search"
              type="search"
              className="pl-9"
              placeholder="Event, reason, order or machine"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
            />
          </div>
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="downtime-line">Production line</Label>
          <Select
            id="downtime-line"
            value={filters.lineId}
            options={lineChoices}
            onChange={(e) => onChange({ ...filters, lineId: e.target.value, machineId: 'all' })}
          />
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="downtime-machine">Machine</Label>
          <Select
            id="downtime-machine"
            value={filters.machineId}
            options={machineChoices}
            onChange={(e) => onChange({ ...filters, machineId: e.target.value })}
          />
        </div>
        <div className="w-full sm:w-52">
          <Label htmlFor="downtime-category">Category</Label>
          <Select
            id="downtime-category"
            value={filters.category}
            options={categoryChoices}
            onChange={(e) => onChange({ ...filters, category: e.target.value as DowntimeCategory | 'all' })}
          />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="downtime-from">From</Label>
          <DatePicker id="downtime-from" value={filters.from} max={filters.to || undefined} onChange={(from) => onChange({ ...filters, from })} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="downtime-to">To</Label>
          <DatePicker id="downtime-to" value={filters.to} min={filters.from || undefined} onChange={(to) => onChange({ ...filters, to })} />
        </div>
        {hasActiveDowntimeFilters(filters) ? (
          <Button variant="ghost" onClick={() => onChange(DEFAULT_DOWNTIME_FILTERS)}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
