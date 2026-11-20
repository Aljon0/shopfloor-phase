/** Official production calculations now live in @shopfloor/shared so the API uses the very same code. */
export {
  validateQuantities,
  goodQuantity,
  rejectionRate,
  targetAchievement,
  summarizeQuantities,
  downtimeMinutes,
} from '@shopfloor/shared'
export type {
  QuantityInput,
  QuantityTotals,
  KpiSummary,
  QuantityRecord,
} from '@shopfloor/shared'
