import { buildInsights, previousRange, validateDateRange } from '@shopfloor/shared'
import { fetchDashboard } from '@/features/dashboard/services/dashboard-mock-service'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import { mockRepository } from '@/mocks/repository'
import type { InsightsResult, NarrativeResult } from '../types'

/** Demo mode: trends and flags use the same shared rules as the server, over the browser's sample data. */
export async function fetchInsights(range: DateRange): Promise<InsightsResult> {
  const problem = validateDateRange(range)
  if (problem) throw new Error(problem)
  const [current, previous] = await Promise.all([fetchDashboard(range), fetchDashboard(previousRange(range))])
  // Fixed "now" in step with the demo's fixed date, so waiting-time flags make sense for the sample data.
  const now = `${mockRepository.getFactoryToday()}T12:00:00+08:00`
  return { ...buildInsights(current, previous, now), aiConfigured: false }
}

export async function fetchNarrative(_range: DateRange): Promise<NarrativeResult> {
  return { status: 'unavailable', reason: 'not_configured', message: 'AI summaries need the real server. They are not available in demo mode.' }
}
