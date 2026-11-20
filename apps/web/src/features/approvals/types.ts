import type { ReportListItem } from '@/features/production-reports/types'

/** A submitted (non-draft) report with what a reviewer wants to see at a glance. */
export interface ApprovalItem extends ReportListItem {
  /** Total minutes of downtime events linked to this report. */
  downtimeMinutes: number
}

export type ApprovalTab = 'pending' | 'decided'
