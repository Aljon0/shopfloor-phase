import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { approveReport, listApprovalItems, reopenReport, returnReport } from '../services/approvals-service'

export function useApprovalItems() {
  return useQuery({ queryKey: ['reports', 'approvals'], queryFn: listApprovalItems })
}

/**
 * A decision changes the official figures (dashboard), order progress, the report itself, and which
 * downtime events are locked, so all of them refresh.
 */
function useRefreshAfterDecision() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(['reports', 'dashboard', 'orders', 'downtime'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

function useReviewer(): string {
  return useAuth().user?.name ?? 'Unknown user'
}

export function useApproveReport(reportId: string) {
  const reviewer = useReviewer()
  const refresh = useRefreshAfterDecision()
  return useMutation({ mutationFn: () => approveReport(reportId, reviewer), onSuccess: refresh })
}

export function useReturnReport(reportId: string) {
  const reviewer = useReviewer()
  const refresh = useRefreshAfterDecision()
  return useMutation({ mutationFn: (reason: string) => returnReport(reportId, reviewer, reason), onSuccess: refresh })
}

export function useReopenReport(reportId: string) {
  const reviewer = useReviewer()
  const refresh = useRefreshAfterDecision()
  return useMutation({ mutationFn: (reason: string) => reopenReport(reportId, reviewer, reason), onSuccess: refresh })
}
