import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Priority, ProductionLine } from '@/types/domain'
import type { OrderStatus } from '@/types/status'
import { DEFAULT_FILTERS, hasActiveFilters } from '../lib/order-filters'
import { ORDER_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../lib/order-rules'
import type { OrderFilters } from '../types'

interface OrderFiltersBarProps {
  filters: OrderFilters
  onChange: (filters: OrderFilters) => void
  lines: ProductionLine[]
}

const STATUS_CHOICES = [{ value: 'all', label: 'All statuses' }, ...ORDER_STATUS_OPTIONS]
const PRIORITY_CHOICES = [{ value: 'all', label: 'All priorities' }, ...PRIORITY_OPTIONS]

export function OrderFiltersBar({ filters, onChange, lines }: OrderFiltersBarProps) {
  const lineChoices = [{ value: 'all', label: 'All lines' }, ...lines.map((l) => ({ value: l.id, label: l.name }))]

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:w-72">
          <label htmlFor="order-search" className="mb-1.5 block text-sm font-medium text-ink">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden="true" />
            <Input
              id="order-search"
              type="search"
              className="pl-9"
              placeholder="Order number, product or line"
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
            />
          </div>
        </div>

        <div className="w-full sm:w-40">
          <label htmlFor="order-status" className="mb-1.5 block text-sm font-medium text-ink">
            Status
          </label>
          <Select
            id="order-status"
            value={filters.status}
            options={STATUS_CHOICES}
            onChange={(e) => onChange({ ...filters, status: e.target.value as OrderStatus | 'all' })}
          />
        </div>

        <div className="w-full sm:w-44">
          <label htmlFor="order-line" className="mb-1.5 block text-sm font-medium text-ink">
            Production line
          </label>
          <Select
            id="order-line"
            value={filters.lineId}
            options={lineChoices}
            onChange={(e) => onChange({ ...filters, lineId: e.target.value })}
          />
        </div>

        <div className="w-full sm:w-40">
          <label htmlFor="order-priority" className="mb-1.5 block text-sm font-medium text-ink">
            Priority
          </label>
          <Select
            id="order-priority"
            value={filters.priority}
            options={PRIORITY_CHOICES}
            onChange={(e) => onChange({ ...filters, priority: e.target.value as Priority | 'all' })}
          />
        </div>

        {hasActiveFilters(filters) ? (
          <Button variant="ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
