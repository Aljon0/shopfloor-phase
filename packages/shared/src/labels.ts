export type DowntimeCategory = 'machine_maintenance' | 'equipment_failure' | 'material_shortage' | 'changeover' | 'operator_delay' | 'other'

export const DOWNTIME_CATEGORY_LABELS: Record<DowntimeCategory, string> = {
  machine_maintenance: 'Machine Maintenance',
  equipment_failure: 'Equipment Failure',
  material_shortage: 'Material Shortage',
  changeover: 'Changeover',
  operator_delay: 'Operator-related Delay',
  other: 'Other',
}

export const SHIFT_LABELS: Record<'morning' | 'night', string> = {
  morning: 'Morning',
  night: 'Night',
}
