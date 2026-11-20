import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import type { PendingReportRow } from '../lib/aggregate'

const VISIBLE_ROWS = 5

interface PendingApprovalsCardProps {
  reports: PendingReportRow[]
  /** Only roles that may open the Approvals screen get the link. */
  canReview: boolean
}

export function PendingApprovalsCard({ reports, canReview }: PendingApprovalsCardProps) {
  const shown = reports.slice(0, VISIBLE_ROWS)
  const hidden = reports.length - shown.length

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Pending approvals</CardTitle>
        <Badge tone={reports.length > 0 ? 'warning' : 'neutral'}>{reports.length}</Badge>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <EmptyState title="Nothing waiting" description="No reports are waiting for review." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {shown.map((r) => (
                <li key={r.id} className="py-2.5 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{r.orderNumber}</p>
                    <p className="text-xs tabular-nums text-muted">
                      {formatNumber(r.goodQuantity)} good / {formatNumber(r.producedQuantity)} produced
                    </p>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {r.productName} · {r.lineName}
                  </p>
                  <p className="text-xs text-muted">
                    {r.operatorName} · {formatDate(r.reportDate)}
                    {r.submittedAt ? ` · submitted ${formatFactoryDateTime(r.submittedAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">{hidden > 0 ? `+ ${hidden} more` : ''}</span>
              {canReview ? (
                <Link to="/approvals" className="font-medium text-primary hover:underline">
                  Open approvals
                </Link>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
