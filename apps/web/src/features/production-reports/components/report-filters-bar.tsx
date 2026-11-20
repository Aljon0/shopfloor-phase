import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ProductionLine, ShiftId } from '@/types/domain'
import type { ReportStatus } from '@/types/status'
import { DEFAULT_REPORT_FILTERS, hasActiveReportFilters } from '../lib/report-filters'
import { REPORT_STATUS_OPTIONS, SHIFT_OPTIONS } from '../lib/report-rules'
import type { ReportFilters } from '../types'

interface ReportFiltersBarProps {
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
  lines: ProductionLine[]
  /** Statuses offered in the status filter. Defaults to all report statuses. */
  statuses?: { value: ReportStatus; label: string }[]
}

const SHIFT_CHOICES = [{ value: 'all', label: 'All shifts' }, ...SHIFT_OPTIONS]

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </label>
  )
}

export function ReportFiltersBar({ filters, onChange, lines, statuses = REPORT_STATUS_OPTIONS }: ReportFiltersBarProps) {
  const statusChoices = [{ value: 'all', label: 'All statuses' }, ...statuses]
  const lineChoices = [{ value: 'all', label: 'All lines' }, ...lines.map((l) => ({ value: l.id, label: l.name }))]

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:w-64">
          <Label htmlFor="report-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden="true" />
            <Input
              id="report-search"
              type="search"
              className="pl-9"
              placeholder="Report, order, operator or machine"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
            />
          </div>
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="report-status">Status</Label>
          <Select
            id="report-status"
            value={filters.status}
            options={statusChoices}
            onChange={(e) => onChange({ ...filters, status: e.target.value as ReportStatus | 'all' })}
          />
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="report-line">Production line</Label>
          <Select
            id="report-line"
            value={filters.lineId}
            options={lineChoices}
            onChange={(e) => onChange({ ...filters, lineId: e.target.value })}
          />
        </div>
        <div className="w-full sm:w-32">
          <Label htmlFor="report-shift">Shift</Label>
          <Select
            id="report-shift"
            value={filters.shift}
            options={SHIFT_CHOICES}
            onChange={(e) => onChange({ ...filters, shift: e.target.value as ShiftId | 'all' })}
          />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="report-from">From</Label>
          <DatePicker id="report-from" value={filters.from} max={filters.to || undefined} onChange={(from) => onChange({ ...filters, from })} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="report-to">To</Label>
          <DatePicker id="report-to" value={filters.to} min={filters.from || undefined} onChange={(to) => onChange({ ...filters, to })} />
        </div>
        {hasActiveReportFilters(filters) ? (
          <Button variant="ghost" onClick={() => onChange(DEFAULT_REPORT_FILTERS)}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
