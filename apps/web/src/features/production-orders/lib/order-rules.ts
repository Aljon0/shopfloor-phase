/** Order business rules now live in @shopfloor/shared so the API enforces the very same ones. */
export {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_OPTIONS,
  MIN_CANCEL_REASON_LENGTH,
  statusActionsFor,
  canTransition,
  isEditable,
  lockedFields,
  nextOrderNumber,
  isOverdue,
  orderProgress,
  describeChanges,
} from '@shopfloor/shared'
export type {
  ProgressReport,
  StatusAction,
} from '@shopfloor/shared'
