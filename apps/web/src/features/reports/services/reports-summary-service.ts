import { isValidDateString } from '@/lib/dates'
import { mockRepository } from '@/mocks/repository'
import { buildSummary, type OperationalSummary, type SummaryKind } from '../lib/summary'

/** Service boundary: replace with a summary endpoint when the API exists. */
export async function fetchSummary(kind: SummaryKind, anchor: string, generatedBy: string): Promise<OperationalSummary> {
  if (!isValidDateString(anchor)) throw new Error('Invalid date')
  const [lines, products, orders, reports, downtimeEvents, activity] = await Promise.all([
    mockRepository.listLines(),
    mockRepository.listProducts(),
    mockRepository.listOrders(),
    mockRepository.listReports(),
    mockRepository.listDowntimeEvents(),
    mockRepository.listActivity(),
  ])
  const summary = buildSummary({ lines, products, orders, reports, downtimeEvents, activity }, kind, anchor, {
    generatedBy,
    generatedAt: new Date().toISOString(),
    today: mockRepository.getFactoryToday(),
  })
  if (!summary) throw new Error('Invalid date')
  return summary
}
