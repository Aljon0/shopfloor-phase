import { api } from '@/lib/api-client'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import type { AnalyticsData } from '../lib/analytics'

/** Analytics over the real API (manager only; the server enforces it). */
export const fetchAnalytics = (range: DateRange): Promise<AnalyticsData> =>
  api.get<AnalyticsData>(`/analytics?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
