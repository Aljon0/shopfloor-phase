import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/dates'
import type { DateRange } from '../lib/aggregate'
import { PRESET_OPTIONS, type RangePreset } from '../lib/date-range'

interface DashboardFiltersProps {
  preset: RangePreset
  onPresetChange: (preset: RangePreset) => void
  custom: DateRange
  onCustomChange: (range: DateRange) => void
  /** The range actually applied, or null when the custom dates are invalid. */
  range: DateRange | null
  error: string | undefined
  updatedAt: string | undefined
}

export function DashboardFilters({
  preset,
  onPresetChange,
  custom,
  onCustomChange,
  range,
  error,
  updatedAt,
}: DashboardFiltersProps) {
  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-48">
          <FormField label="Period" htmlFor="dash-period">
            <Select
              id="dash-period"
              value={preset}
              options={PRESET_OPTIONS}
              onChange={(e) => onPresetChange(e.target.value as RangePreset)}
            />
          </FormField>
        </div>

        {preset === 'custom' ? (
          <>
            <div className="w-full sm:w-44">
              <FormField label="From" htmlFor="dash-from">
                <DatePicker
                  id="dash-from"
                  value={custom.from}
                  invalid={error !== undefined}
                  onChange={(from) => onCustomChange({ ...custom, from })}
                />
              </FormField>
            </div>
            <div className="w-full sm:w-44">
              <FormField label="To" htmlFor="dash-to">
                <DatePicker
                  id="dash-to"
                  value={custom.to}
                  invalid={error !== undefined}
                  onChange={(to) => onCustomChange({ ...custom, to })}
                />
              </FormField>
            </div>
          </>
        ) : null}

        <div className="min-w-0 flex-1 text-sm text-muted">
          {range ? (
            <p>
              <span className="font-medium text-ink">
                {range.from === range.to
                  ? formatDate(range.from, true)
                  : `${formatDate(range.from)} – ${formatDate(range.to, true)}`}
              </span>
              {updatedAt ? <span> · Updated {updatedAt}</span> : null}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs">
            Production figures count approved reports only. Times are factory local time.
          </p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  )
}
