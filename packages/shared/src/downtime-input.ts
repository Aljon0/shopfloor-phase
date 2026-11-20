import { factoryDateOf } from './dates'
import { MAX_DOWNTIME_MINUTES, MAX_DOWNTIME_NOTES_LENGTH, MIN_NOTES_LENGTH, isLocalDateTime, localDurationMinutes, toFactoryIso } from './downtime-rules'
import { DOWNTIME_CATEGORY_LABELS, type DowntimeCategory } from './labels'

/** What the user enters. Times are factory-local, as 'YYYY-MM-DDTHH:mm'. */
export interface DowntimeInput {
  machineId: string
  /** Order number, or '' when the stop is not tied to an order. */
  orderId: string
  /** Report number, or '' when not linked to a report. */
  reportId: string
  startTime: string
  endTime: string
  category: DowntimeCategory
  notes: string
}

/**
 * Field checks for a downtime event. Same rules and wording as the downtime form; the API runs this on
 * every save. Returns a message per invalid field; an empty object means valid.
 */
export function validateDowntimeInput(input: DowntimeInput, ctx: { today: string }): Partial<Record<keyof DowntimeInput, string>> {
  const errors: Partial<Record<keyof DowntimeInput, string>> = {}
  if (!input.machineId) errors.machineId = 'Select a machine'
  const startOk = typeof input.startTime === 'string' && isLocalDateTime(input.startTime)
  const endOk = typeof input.endTime === 'string' && isLocalDateTime(input.endTime)
  if (!startOk) errors.startTime = 'Enter a valid start date and time'
  if (!endOk) errors.endTime = 'Enter a valid end date and time'
  if (!(input.category in DOWNTIME_CATEGORY_LABELS)) errors.category = 'Select a category'
  if (typeof input.notes !== 'string') errors.notes = 'Describe the reason (at least 3 characters)'
  else if (input.notes.trim().length < MIN_NOTES_LENGTH) errors.notes = 'Describe the reason (at least 3 characters)'
  else if (input.notes.trim().length > MAX_DOWNTIME_NOTES_LENGTH) errors.notes = `Keep the reason under ${MAX_DOWNTIME_NOTES_LENGTH} characters`

  if (startOk && factoryDateOf(toFactoryIso(input.startTime)) > ctx.today) errors.startTime = 'Start cannot be in the future'
  if (endOk && factoryDateOf(toFactoryIso(input.endTime)) > ctx.today) errors.endTime = 'End cannot be in the future'
  if (startOk && endOk) {
    const minutes = localDurationMinutes(input.startTime, input.endTime)
    if (minutes === null) errors.endTime ??= 'End must be after the start'
    else if (minutes > MAX_DOWNTIME_MINUTES) errors.endTime ??= 'A single event cannot be longer than 24 hours'
  }
  return errors
}
