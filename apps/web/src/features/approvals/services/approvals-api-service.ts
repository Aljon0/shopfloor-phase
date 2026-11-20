import { api, describeApiError } from '@/lib/api-client'
import type { ProductionReport } from '@/types/domain'
import type { ApprovalItem } from '../types'
import { ApprovalRuleError } from './approvals-mock-service'

/**
 * Report review over the real API. Only supervisors may call these; the server also refuses a reviewer
 * deciding on a report they filed, and takes the reviewer from the signed-in session (`reviewer` is ignored).
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new ApprovalRuleError(describeApiError(error).message)
  }
}

const base = (id: string) => `/approvals/${encodeURIComponent(id)}`

export const listApprovalItems = (): Promise<ApprovalItem[]> => call(() => api.get<ApprovalItem[]>('/approvals'))
export const approveReport = (reportId: string, _reviewer: string): Promise<ProductionReport> => call(() => api.post<ProductionReport>(`${base(reportId)}/approve`))
export const returnReport = (reportId: string, _reviewer: string, reason: string): Promise<ProductionReport> =>
  call(() => api.post<ProductionReport>(`${base(reportId)}/return`, { reason }))
export const reopenReport = (reportId: string, _reviewer: string, reason: string): Promise<ProductionReport> =>
  call(() => api.post<ProductionReport>(`${base(reportId)}/reopen`, { reason }))
