import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isValidDateString } from '@/lib/dates'
import type { SummaryKind } from '../lib/summary'
import { fetchSummary } from '../services/reports-summary-service'

export function useSummary(kind: SummaryKind, anchor: string, generatedBy: string) {
  return useQuery({
    queryKey: ['reports-summary', kind, anchor],
    queryFn: () => fetchSummary(kind, anchor, generatedBy),
    enabled: isValidDateString(anchor),
    placeholderData: keepPreviousData,
  })
}
