import { ApiError, api, describeApiError } from '@/lib/api-client'
import type { QualityInspection } from '@/types/domain'
import type { InspectionInput, InspectionItem, QualityReferenceData } from '../types'
import { QualityRuleError } from './quality-mock-service'

/**
 * Quality inspections over the real API. Supervisors (acting as inspectors) write; managers and
 * supervisors read. The server enforces every rule and takes the inspector from the signed-in session.
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new QualityRuleError(describeApiError(error).message)
  }
}

export const getQualityReference = (): Promise<QualityReferenceData> => call(() => api.get<QualityReferenceData>('/quality/reference'))
export const listInspectionItems = (): Promise<InspectionItem[]> => call(() => api.get<InspectionItem[]>('/quality'))

/** Returns null when the inspection does not exist. */
export async function getInspectionItem(inspectionId: string): Promise<InspectionItem | null> {
  try {
    return await api.get<InspectionItem>(`/quality/${encodeURIComponent(inspectionId)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw new QualityRuleError(describeApiError(error).message)
  }
}

export const createInspection = (input: InspectionInput, _actor: string): Promise<QualityInspection> => call(() => api.post<QualityInspection>('/quality', input))
export const updateInspection = (inspectionId: string, input: InspectionInput): Promise<QualityInspection> =>
  call(() => api.patch<QualityInspection>(`/quality/${encodeURIComponent(inspectionId)}`, input))
