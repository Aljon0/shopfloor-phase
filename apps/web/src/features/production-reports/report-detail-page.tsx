import { CircleCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { formatFactoryDateTime } from '@/lib/dates'
import { canRecordReports, canReviewReports } from '@/lib/permissions'
import { ReportActions } from './components/report-actions'
import { ReportMetricsCard, ReportSummaryCard } from './components/report-summary-card'
import { ReportTabs } from './components/report-tabs'
import { isAwaitingReview } from './lib/report-rules'
import { useReportDetail } from './hooks/use-reports'

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading report" className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function ReportDetailPage() {
  const { reportId = '' } = useParams<{ reportId: string }>()
  const { user } = useAuth()
  const location = useLocation()
  const detail = useReportDetail(reportId)
  const [dismissed, setDismissed] = useState(false)
  const notice = (location.state as { notice?: string } | null)?.notice

  if (detail.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void detail.refetch()} />
      </Card>
    )
  }
  if (detail.isPending) return <DetailSkeleton />
  if (!detail.data) {
    return (
      <>
        <PageHeader title="Report not found" />
        <Card>
          <EmptyState
            title={`${reportId} does not exist`}
            description="Check the report number, or go back to the list."
            action={
              <Button asChild variant="secondary">
                <Link to="/production-reports">Back to reports</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const data = detail.data
  const { report } = data

  return (
    <>
      {notice && !dismissed ? (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-success-bg px-4 py-2.5 text-sm text-success"
        >
          <span className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            {notice}
          </span>
          <button
            type="button"
            aria-label="Dismiss message"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/60"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{report.id}</h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {data.productName} · {data.lineName} · {data.machineName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReportActions report={report} canRecord={canRecordReports(user?.role)} />
          {canReviewReports(user?.role) && (isAwaitingReview(report.status) || report.status === 'approved') ? (
            <Button asChild>
              <Link to={`/approvals/${report.id}`}>{report.status === 'approved' ? 'Approval actions' : 'Review report'}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {report.status === 'returned' && report.returnReason ? (
        <p role="note" className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          <span className="font-medium">Returned for correction</span>
          {report.reviewedBy && report.reviewedAt
            ? ` by ${report.reviewedBy}, ${formatFactoryDateTime(report.reviewedAt)}`
            : ''}
          : {report.returnReason}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ReportSummaryCard detail={data} />
          </div>
          <ReportMetricsCard detail={data} />
        </div>
        <ReportTabs detail={data} />
      </div>
    </>
  )
}
