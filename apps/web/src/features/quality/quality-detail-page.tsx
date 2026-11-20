import { CircleCheck, Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatNumber, formatPercent, NOT_APPLICABLE } from '@/lib/format'
import { canManageInspections } from '@/lib/permissions'
import { useInspectionItem } from './hooks/use-quality'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

export function QualityDetailPage() {
  const { inspectionId = '' } = useParams<{ inspectionId: string }>()
  const { user } = useAuth()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [dismissed, setDismissed] = useState(false)
  const item = useInspectionItem(inspectionId)

  if (item.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void item.refetch()} />
      </Card>
    )
  }
  if (item.isPending) {
    return (
      <div role="status" aria-label="Loading inspection" className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }
  if (!item.data) {
    return (
      <>
        <PageHeader title="Inspection not found" />
        <Card>
          <EmptyState
            title={`${inspectionId} does not exist`}
            description="Check the inspection number, or go back to the list."
            action={
              <Button asChild variant="secondary">
                <Link to="/quality">Back to inspections</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const { inspection: i, productName, lineName, defectName, reportStatus, passRate } = item.data
  const results: [string, string][] = [
    ['Inspected', formatNumber(i.inspectedQuantity)],
    ['Passed', formatNumber(i.passedQuantity)],
    ['Failed', formatNumber(i.failedQuantity)],
    ['Pass rate', formatPercent(passRate)],
  ]

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
          <h1 className="text-xl font-semibold text-ink">{i.id}</h1>
          <p className="mt-1 text-sm text-muted">
            {productName} · {lineName}
          </p>
        </div>
        {canManageInspections(user?.role) ? (
          <Button asChild variant="secondary">
            <Link to={`/quality/${i.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inspection details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Production order">
                <Link to={`/production-orders/${i.orderId}`} className="font-medium text-primary hover:underline">
                  {i.orderId}
                </Link>
              </Field>
              <Field label="Production report">
                {i.reportId ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Link to={`/production-reports/${i.reportId}`} className="font-medium text-primary hover:underline">
                      {i.reportId}
                    </Link>
                    {reportStatus ? <StatusBadge status={reportStatus} /> : null}
                  </span>
                ) : (
                  NOT_APPLICABLE
                )}
              </Field>
              <Field label="Product">{productName}</Field>
              <Field label="Inspection date">{formatDate(i.inspectionDate, true)}</Field>
              <Field label="Inspector">{i.inspector}</Field>
              <Field label="Defect classification">{defectName ?? NOT_APPLICABLE}</Field>
              <Field label="Recorded">{formatFactoryDateTime(i.createdAt)}</Field>
              <Field label="Last updated">{formatFactoryDateTime(i.updatedAt)}</Field>
            </dl>
            <div>
              <p className="text-xs font-medium text-muted">Notes</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{i.notes || <span className="text-muted">No notes.</span>}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              {results.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">A basic inspection record, not a certified quality-management system.</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
