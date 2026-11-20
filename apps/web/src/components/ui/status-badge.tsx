import { Badge, type BadgeProps } from './badge'
import type { EntityStatus } from '@/types/status'

interface StatusConfig {
  label: string
  tone: NonNullable<BadgeProps['tone']>
}

const STATUS_CONFIG: Record<EntityStatus, StatusConfig> = {
  draft: { label: 'Draft', tone: 'neutral' },
  planned: { label: 'Planned', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  pending_review: { label: 'Pending Review', tone: 'warning' },
  returned: { label: 'Returned for Correction', tone: 'danger' },
  revised: { label: 'Revised', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
}

export function StatusBadge({ status }: { status: EntityStatus }) {
  const { label, tone } = STATUS_CONFIG[status]
  return <Badge tone={tone}>{label}</Badge>
}
