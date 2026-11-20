import { isValidDateString } from '@/lib/dates'
import { mockRepository } from '@/mocks/repository'
import { buildDashboard, type DashboardData, type DateRange } from '../lib/aggregate'

/**
 * Service boundary for the dashboard. Today it reads the mock repository and aggregates in the
 * browser. When the API exists, this function can call a dashboard endpoint instead, with no
 * change to the UI.
 */
export async function fetchDashboard(range: DateRange): Promise<DashboardData> {
  if (!isValidDateString(range.from) || !isValidDateString(range.to) || range.from > range.to) {
    throw new Error('Invalid date range')
  }
  const [lines, products, orders, reports, downtimeEvents, activity] = await Promise.all([
    mockRepository.listLines(),
    mockRepository.listProducts(),
    mockRepository.listOrders(),
    mockRepository.listReports(),
    mockRepository.listDowntimeEvents(),
    mockRepository.listActivity(),
  ])
  return buildDashboard({ lines, products, orders, reports, downtimeEvents, activity }, range)
}
