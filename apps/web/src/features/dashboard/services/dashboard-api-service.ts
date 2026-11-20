import { api } from '@/lib/api-client'
import type { DashboardData, DateRange } from '../lib/aggregate'

/** Dashboard over the real API. The server computes the figures with the same shared builder as the demo. */
export const fetchDashboard = (range: DateRange): Promise<DashboardData> =>
  api.get<DashboardData>(`/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
