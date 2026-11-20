import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { Priority } from '@/types/domain'
import { PRIORITY_OPTIONS } from '../lib/order-rules'

const TONES: Record<Priority, NonNullable<BadgeProps['tone']>> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'info',
  low: 'neutral',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const label = PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority
  return <Badge tone={TONES[priority]}>{label}</Badge>
}
