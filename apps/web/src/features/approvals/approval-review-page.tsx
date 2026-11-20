import { CircleCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { RestrictedState } from '@/components/shared/restricted-state'
import { ReportMetricsCard, ReportSummaryCard } from '@/features/production-reports/components/report-summary-card'
import { ReportTabs } from '@/features/production-reports/components/report-tabs'
import { useReportDetail } from '@/features/production-reports/hooks/use-reports'
import { isAwaitingReview } from '@/features/production-reports/lib/report-rules'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { formatFactoryDateTime } from '@/lib/dates'
import { canReviewReports } from '@/lib/permissions'
import { ReviewActions } from './components/review-actions'
import { isSelfReview } from './lib/approval-rules'

export function ApprovalReviewPage() {
  const { reportId = '' } = useParams<{ reportId: string }>()
  const { user } = useAuth()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [dismissed, setDismissed] = useState(false)
  const detail = useReportDetail(reportId)

  if (!canReviewReports(user?.role)) return <RestrictedState description="Only supervisors can review reports." />

  if (detail.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void detail.refetch()} />
      </Card>
    )
  }
  if (detail.isPending) {
    return (
      <div role="status" aria-label="Loading report" className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!detail.data) {
    return (
      <>
        <PageHeader title="Report not found" />
        <Card>
          <EmptyState
            title={`${reportId} does not exist`}
            description="Check the report number, or go back to the approvals queue."
            action={
              <Button asChild variant="secondary">
                <Link to="/approvals">Back to approvals</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const data = detail.data
  const { report } = data
  const ownReport = isSelfReview(user?.name ?? '', report.operatorName)
  const decidable = isAwaitingReview(report.status) || report.status === 'approved'

  return (
    <>
      {notice && !dismissed ? (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-success-bg px-4 py-2.5 text-sm text-success">
          <span className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            {notice}
          </span>
          <button type="button" aria-label="Dismiss message" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/60" onClick={() => setDismissed(true)}>
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
            {data.productName} · {data.lineName} · {data.machineName} · filed by {report.operatorName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link to={`/production-reports/${report.id}`}>Open full report</Link>
          </Button>
          {decidable && !ownReport ? <ReviewActions report={report} /> : null}
        </div>
      </div>

      {decidable && ownReport ? (
        <p role="note" className="mb-4 rounded-md bg-neutral-bg px-3 py-2 text-sm text-ink">
          You filed this report, so another supervisor has to review it.
        </p>
      ) : null}
      {report.status === 'returned' && report.returnReason ? (
        <p role="note" className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          <span className="font-medium">Returned for correction</span>
          {report.reviewedBy && report.reviewedAt ? ` by ${report.reviewedBy}, ${formatFactoryDateTime(report.reviewedAt)}` : ''}: {report.returnReason}
        </p>
      ) : null}
      {report.status === 'approved' && report.reviewedBy && report.reviewedAt ? (
        <p role="note" className="mb-4 rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          Approved by {report.reviewedBy}, {formatFactoryDateTime(report.reviewedAt)}. This report is part of the official figures and cannot be edited.
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ReportSummaryCard detail={data} />
          </div>
          <ReportMetricsCard detail={data} />
        </div>
        <ReportTabs detail={data} defaultTab="downtime" />
      </div>
    </>
  )
}
