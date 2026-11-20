/** Downtime rules live in @shopfloor/shared so the API enforces the very same ones. */
export {
  MAX_DOWNTIME_MINUTES,
  MAX_DOWNTIME_NOTES_LENGTH as MAX_NOTES_LENGTH,
  MIN_NOTES_LENGTH,
  CATEGORY_OPTIONS,
  isLocalDateTime,
  toFactoryIso,
  toLocalInput,
  localDurationMinutes,
  isEventLocked,
  findOverlap,
  nextEventId,
  summarizeDowntime,
} from '@shopfloor/shared'
