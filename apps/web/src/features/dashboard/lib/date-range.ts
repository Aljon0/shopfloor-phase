import { addDays, isValidDateString } from '@/lib/dates'
import type { DateRange } from './aggregate'

export type RangePreset = 'today' | 'last7' | 'last14' | 'custom'

export const PRESET_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'custom', label: 'Custom range' },
]

const MAX_SPAN_DAYS = 366

export interface ResolvedRange {
  range: DateRange | null
  error?: string
}

/** Turns a preset (or custom dates) into an inclusive range ending on the factory's current date. */
export function resolveRange(preset: RangePreset, today: string, custom: DateRange): ResolvedRange {
  switch (preset) {
    case 'today':
      return { range: { from: today, to: today } }
    case 'last7':
      return { range: { from: addDays(today, -6), to: today } }
    case 'last14':
      return { range: { from: addDays(today, -13), to: today } }
    case 'custom': {
      if (!isValidDateString(custom.from) || !isValidDateString(custom.to)) {
        return { range: null, error: 'Enter a valid start and end date.' }
      }
      if (custom.from > custom.to) {
        return { range: null, error: 'The start date must be on or before the end date.' }
      }
      if (addDays(custom.from, MAX_SPAN_DAYS) < custom.to) {
        return { range: null, error: `Choose a range of ${MAX_SPAN_DAYS} days or less.` }
      }
      return { range: { from: custom.from, to: custom.to } }
    }
  }
}
