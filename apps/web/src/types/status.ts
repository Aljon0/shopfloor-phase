export type ReportStatus =
  | 'draft'
  | 'pending_review'
  | 'returned'
  | 'revised'
  | 'approved'

export type OrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled'

export type EntityStatus = ReportStatus | OrderStatus | 'active' | 'inactive'
