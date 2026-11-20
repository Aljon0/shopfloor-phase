import { ApiError, api, describeApiError } from '@/lib/api-client'
import type { ProductionReport } from '@/types/domain'
import type { ReportDetail, ReportInput, ReportListItem, ReportReferenceData, SaveMode } from '../types'
import { ReportRuleError } from './reports-mock-service'

/**
 * Production reports over the real API. Same exports as the mock service so screens do not care which is active.
 * The server enforces every rule (including "operators change only their own reports") and takes the
 * actor from the signed-in session, so `actor` is ignored here.
 * Downtime and inspections linked to a report appear once those modules move to the API (8D).
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new ReportRuleError(describeApiError(error).message)
  }
}

export const getReportReference = (): Promise<ReportReferenceData> => call(() => api.get<ReportReferenceData>('/reports/reference'))

export const listReportItems = (): Promise<ReportListItem[]> => call(() => api.get<ReportListItem[]>('/reports'))

/** Returns null when the report does not exist. */
export async function getReportDetail(reportId: string): Promise<ReportDetail | null> {
  try {
    return await api.get<ReportDetail>(`/reports/${encodeURIComponent(reportId)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw new ReportRuleError(describeApiError(error).message)
  }
}

export const createReport = (input: ReportInput, mode: SaveMode, _actor: string): Promise<ProductionReport> =>
  call(() => api.post<ProductionReport>('/reports', { ...input, mode }))

export const updateReport = (reportId: string, input: ReportInput, mode: SaveMode, _actor: string): Promise<ProductionReport> =>
  call(() => api.patch<ProductionReport>(`/reports/${encodeURIComponent(reportId)}`, { ...input, mode }))

export const submitReport = (reportId: string, _actor: string): Promise<ProductionReport> =>
  call(() => api.post<ProductionReport>(`/reports/${encodeURIComponent(reportId)}/submit`))

export const deleteReport = (reportId: string): Promise<void> => call(() => api.delete(`/reports/${encodeURIComponent(reportId)}`))
