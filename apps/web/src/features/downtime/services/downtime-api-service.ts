import { ApiError, api, describeApiError } from '@/lib/api-client'
import type { DowntimeEvent } from '@/types/domain'
import type { DowntimeInput, DowntimeListItem, DowntimeReferenceData } from '../types'
import { DowntimeRuleError } from './downtime-mock-service'

/**
 * Downtime over the real API. Same exports as the mock service so screens do not care which is active.
 * The server enforces every rule (overlaps, locks, "operators change only their own events") and takes
 * the recorder from the signed-in session, so `actor` is ignored here.
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new DowntimeRuleError(describeApiError(error).message)
  }
}

export const getDowntimeReference = (): Promise<DowntimeReferenceData> => call(() => api.get<DowntimeReferenceData>('/downtime/reference'))
export const listDowntimeItems = (): Promise<DowntimeListItem[]> => call(() => api.get<DowntimeListItem[]>('/downtime'))

/** Returns null when the event does not exist. */
export async function getDowntimeItem(eventId: string): Promise<DowntimeListItem | null> {
  try {
    return await api.get<DowntimeListItem>(`/downtime/${encodeURIComponent(eventId)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw new DowntimeRuleError(describeApiError(error).message)
  }
}

export const createDowntimeEvent = (input: DowntimeInput, _actor: string): Promise<DowntimeEvent> => call(() => api.post<DowntimeEvent>('/downtime', input))
export const updateDowntimeEvent = (eventId: string, input: DowntimeInput): Promise<DowntimeEvent> =>
  call(() => api.patch<DowntimeEvent>(`/downtime/${encodeURIComponent(eventId)}`, input))
