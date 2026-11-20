import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import { fetchAnalytics } from '../services/analytics-service'

export function useAnalytics(range: DateRange | null) {
  return useQuery({
    queryKey: ['analytics', range?.from, range?.to],
    queryFn: () => {
      if (!range) throw new Error('No date range selected')
      return fetchAnalytics(range)
    },
    enabled: range !== null,
    placeholderData: keepPreviousData,
  })
}
