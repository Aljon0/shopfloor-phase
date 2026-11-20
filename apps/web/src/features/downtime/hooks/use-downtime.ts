import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { createDowntimeEvent, getDowntimeItem, getDowntimeReference, listDowntimeItems, updateDowntimeEvent } from '../services/downtime-service'
import type { DowntimeInput } from '../types'

export function useDowntimeItems() {
  return useQuery({ queryKey: ['downtime', 'list'], queryFn: listDowntimeItems })
}

export function useDowntimeReference() {
  return useQuery({ queryKey: ['downtime', 'reference'], queryFn: getDowntimeReference })
}

export function useDowntimeItem(eventId: string) {
  return useQuery({ queryKey: ['downtime', 'item', eventId], queryFn: () => getDowntimeItem(eventId) })
}

/** Downtime shows up on the dashboard, on reports and on orders, so all of them refresh. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      ['downtime', 'dashboard', 'reports', 'orders'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )
}

export function useCreateDowntime() {
  const actor = useAuth().user?.name ?? 'Unknown user'
  const refresh = useRefreshAfterChange()
  return useMutation({ mutationFn: (input: DowntimeInput) => createDowntimeEvent(input, actor), onSuccess: refresh })
}

export function useUpdateDowntime(eventId: string) {
  const refresh = useRefreshAfterChange()
  return useMutation({ mutationFn: (input: DowntimeInput) => updateDowntimeEvent(eventId, input), onSuccess: refresh })
}
