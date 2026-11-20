import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import {
  createReport,
  deleteReport,
  getReportDetail,
  getReportReference,
  listReportItems,
  submitReport,
  updateReport,
} from '../services/reports-service'
import type { ReportInput, SaveMode } from '../types'

const keys = {
  all: ['reports'] as const,
  list: ['reports', 'list'] as const,
  reference: ['reports', 'reference'] as const,
  detail: (id: string) => ['reports', 'detail', id] as const,
}

export function useReportItems() {
  return useQuery({ queryKey: keys.list, queryFn: listReportItems })
}

export function useReportReference() {
  return useQuery({ queryKey: keys.reference, queryFn: getReportReference, staleTime: Infinity })
}

export function useReportDetail(reportId: string) {
  return useQuery({ queryKey: keys.detail(reportId), queryFn: () => getReportDetail(reportId) })
}

function useActor(): string {
  return useAuth().user?.name ?? 'Unknown user'
}

/** Report changes affect the lists, the order progress and the dashboard's pending queue. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.all }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}

export function useCreateReport() {
  const actor = useActor()
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: ({ input, mode }: { input: ReportInput; mode: SaveMode }) => createReport(input, mode, actor),
    onSuccess: refresh,
  })
}

export function useUpdateReport(reportId: string) {
  const actor = useActor()
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: ({ input, mode }: { input: ReportInput; mode: SaveMode }) => updateReport(reportId, input, mode, actor),
    onSuccess: refresh,
  })
}

export function useSubmitReport(reportId: string) {
  const actor = useActor()
  const refresh = useRefreshAfterChange()
  return useMutation({ mutationFn: () => submitReport(reportId, actor), onSuccess: refresh })
}

export function useDeleteReport(reportId: string) {
  const refresh = useRefreshAfterChange()
  return useMutation({ mutationFn: () => deleteReport(reportId), onSuccess: refresh })
}
