import { isValidDateString } from '@/lib/dates'
import { mockRepository } from '@/mocks/repository'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import { buildAnalytics, type AnalyticsData } from '../lib/analytics'

/** Service boundary: swap the repository calls for an analytics endpoint when the API exists. */
export async function fetchAnalytics(range: DateRange): Promise<AnalyticsData> {
  if (!isValidDateString(range.from) || !isValidDateString(range.to) || range.from > range.to) {
    throw new Error('Invalid date range')
  }
  const [lines, products, machines, orders, reports, downtimeEvents, activity] = await Promise.all([
    mockRepository.listLines(),
    mockRepository.listProducts(),
    mockRepository.listMachines(),
    mockRepository.listOrders(),
    mockRepository.listReports(),
    mockRepository.listDowntimeEvents(),
    mockRepository.listActivity(),
  ])
  return buildAnalytics({ lines, products, machines, orders, reports, downtimeEvents, activity }, range)
}
