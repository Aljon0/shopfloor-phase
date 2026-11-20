import { z } from 'zod'
import { factoryDateOf } from '@/lib/dates'
import { DOWNTIME_CATEGORY_LABELS } from '@/lib/labels'
import type { DowntimeCategory } from '@/types/domain'
import {
  MAX_DOWNTIME_MINUTES,
  MAX_NOTES_LENGTH,
  MIN_NOTES_LENGTH,
  isLocalDateTime,
  localDurationMinutes,
  toFactoryIso,
} from './downtime-rules'

const CATEGORIES = Object.keys(DOWNTIME_CATEGORY_LABELS) as [DowntimeCategory, ...DowntimeCategory[]]

/** Validation for the downtime form. The service runs the same schema, so the rules cannot be skipped. */
export function buildDowntimeFormSchema(ctx: { today: string }) {
  return z
    .object({
      machineId: z.string().min(1, 'Select a machine'),
      orderId: z.string(),
      reportId: z.string(),
      startTime: z.string().refine(isLocalDateTime, 'Enter a valid start date and time'),
      endTime: z.string().refine(isLocalDateTime, 'Enter a valid end date and time'),
      category: z.enum(CATEGORIES, { error: 'Select a category' }),
      notes: z
        .string()
        .trim()
        .min(MIN_NOTES_LENGTH, 'Describe the reason (at least 3 characters)')
        .max(MAX_NOTES_LENGTH, `Keep the reason under ${MAX_NOTES_LENGTH} characters`),
    })
    .superRefine((v, c) => {
      if (isLocalDateTime(v.startTime) && factoryDateOf(toFactoryIso(v.startTime)) > ctx.today) {
        c.addIssue({ code: 'custom', path: ['startTime'], message: 'Start cannot be in the future' })
      }
      if (isLocalDateTime(v.endTime) && factoryDateOf(toFactoryIso(v.endTime)) > ctx.today) {
        c.addIssue({ code: 'custom', path: ['endTime'], message: 'End cannot be in the future' })
      }
      if (!isLocalDateTime(v.startTime) || !isLocalDateTime(v.endTime)) return
      const minutes = localDurationMinutes(v.startTime, v.endTime)
      if (minutes === null) {
        c.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be after the start' })
      } else if (minutes > MAX_DOWNTIME_MINUTES) {
        c.addIssue({ code: 'custom', path: ['endTime'], message: 'A single event cannot be longer than 24 hours' })
      }
    })
}

export type DowntimeFormValues = z.infer<ReturnType<typeof buildDowntimeFormSchema>>
