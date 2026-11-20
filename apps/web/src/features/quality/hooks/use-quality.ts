import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { createInspection, getInspectionItem, getQualityReference, listInspectionItems, updateInspection } from '../services/quality-service'
import type { InspectionInput } from '../types'

export function useInspectionItems() {
  return useQuery({ queryKey: ['quality', 'list'], queryFn: listInspectionItems })
}

export function useQualityReference() {
  return useQuery({ queryKey: ['quality', 'reference'], queryFn: getQualityReference })
}

export function useInspectionItem(inspectionId: string) {
  return useQuery({ queryKey: ['quality', 'item', inspectionId], queryFn: () => getInspectionItem(inspectionId) })
}

/** Inspections also show on report pages, so those refresh too. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return () => Promise.all(['quality', 'reports'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

export function useCreateInspection() {
  const actor = useAuth().user?.name ?? 'Unknown user'
  const refresh = useRefreshAfterChange()
  return useMutation({ mutationFn: (input: InspectionInput) => createInspection(input, actor), onSuccess: refresh })
}

export function useUpdateInspection(inspectionId: string) {
  const refresh = useRefreshAfterChange()
  return useMutation({ mutationFn: (input: InspectionInput) => updateInspection(inspectionId, input), onSuccess: refresh })
}
