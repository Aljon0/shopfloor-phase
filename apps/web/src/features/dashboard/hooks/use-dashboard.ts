import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange } from '../lib/aggregate'
import { fetchDashboard } from '../services/dashboard-service'

/** Pass null while the selected range is invalid; the query then stays idle. */
export function useDashboard(range: DateRange | null) {
  return useQuery({
    queryKey: ['dashboard', range?.from, range?.to],
    queryFn: () => {
      if (!range) throw new Error('No date range selected')
      return fetchDashboard(range)
    },
    enabled: range !== null,
    placeholderData: keepPreviousData,
  })
}
