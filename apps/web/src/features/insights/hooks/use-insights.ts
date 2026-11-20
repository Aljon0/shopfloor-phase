import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import { fetchInsights, fetchNarrative } from '../services/insights-service'

export function useInsights(range: DateRange | null, enabled: boolean) {
  return useQuery({
    queryKey: ['insights', range?.from, range?.to],
    queryFn: () => {
      if (!range) throw new Error('No date range selected')
      return fetchInsights(range)
    },
    enabled: enabled && range !== null,
    placeholderData: keepPreviousData,
  })
}

/** On demand only: nothing is sent to the AI service until someone presses the button. */
export function useNarrative() {
  return useMutation({ mutationFn: (range: DateRange) => fetchNarrative(range) })
}
