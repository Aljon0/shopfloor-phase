import { api } from '@/lib/api-client'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import type { InsightsResult, NarrativeResult } from '../types'

export const fetchInsights = (range: DateRange): Promise<InsightsResult> =>
  api.get<InsightsResult>(`/insights?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)

/** The server calls the AI provider; the browser never sees the key. A failure comes back as status "unavailable", not an error. */
export const fetchNarrative = (range: DateRange): Promise<NarrativeResult> => api.post<NarrativeResult>('/insights/narrative', range)
