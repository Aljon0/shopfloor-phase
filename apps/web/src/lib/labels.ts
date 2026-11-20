import type { DowntimeCategory, ShiftId } from '@/types/domain'

export const DOWNTIME_CATEGORY_LABELS: Record<DowntimeCategory, string> = {
  machine_maintenance: 'Machine Maintenance',
  equipment_failure: 'Equipment Failure',
  material_shortage: 'Material Shortage',
  changeover: 'Changeover',
  operator_delay: 'Operator-related Delay',
  other: 'Other',
}

export const SHIFT_LABELS: Record<ShiftId, string> = {
  morning: 'Morning',
  night: 'Night',
}
