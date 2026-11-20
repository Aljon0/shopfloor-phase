import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/format'
import type { OrderProgress } from '../types'
import { OrderProgressBar } from './order-progress'

export function OrderProgressCard({ progress }: { progress: OrderProgress }) {
  const rows: [string, string][] = [
    ['Produced (approved)', formatNumber(progress.approvedProduced)],
    ['Rejected (approved)', formatNumber(progress.approvedRejected)],
    [
      'Good, awaiting approval',
      `${formatNumber(progress.pendingGood)} (${progress.pendingReportCount} ${progress.pendingReportCount === 1 ? 'report' : 'reports'})`,
    ],
  ]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-ink">{formatPercent(progress.percent)}</p>
          <p className="text-xs text-muted">
            {formatNumber(progress.approvedGood)} good of {formatNumber(progress.plannedQuantity)} planned, approved
            reports only
          </p>
        </div>
        <OrderProgressBar progress={progress} className="h-2.5" />
        <dl className="space-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-4 rounded-sm bg-primary" aria-hidden="true" /> Approved
          <span className="ml-2 h-2 w-4 rounded-sm bg-blue-200" aria-hidden="true" /> Awaiting approval
        </p>
      </CardContent>
    </Card>
  )
}
