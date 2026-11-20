/** Quality rules live in @shopfloor/shared so the API enforces the very same ones. */
export {
  MAX_INSPECTION_NOTES_LENGTH as MAX_NOTES_LENGTH,
  MAX_INSPECTION_QUANTITY,
  NO_DEFECT_KEY,
  canInspectOrder,
  passRate,
  passedQuantity,
  nextInspectionId,
  summarizeInspections,
} from '@shopfloor/shared'
