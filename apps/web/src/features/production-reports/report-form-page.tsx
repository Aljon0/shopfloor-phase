import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { RestrictedState } from '@/components/shared/restricted-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { canRecordReports } from '@/lib/permissions'
import { ReportForm } from './components/report-form'
import { useCreateReport, useReportDetail, useReportReference, useUpdateReport } from './hooks/use-reports'
import { isReportEditable } from './lib/report-rules'
import { ReportRuleError } from './services/reports-service'
import type { ReportInput, SaveMode } from './types'

function messageFor(error: unknown): string {
  return error instanceof ReportRuleError ? error.message : 'The report could not be saved. Check the connection and try again.'
}

function savedNotice(id: string, mode: SaveMode): string {
  return mode === 'submit' ? `${id} was submitted for review.` : `${id} was saved as a draft.`
}

function FormSkeleton() {
  return (
    <Card className="space-y-4 p-5" role="status" aria-label="Loading form">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </Card>
  )
}

function CreateReportView() {
  const navigate = useNavigate()
  const reference = useReportReference()
  const create = useCreateReport()
  const [error, setError] = useState<string>()

  const handleSave = async (input: ReportInput, mode: SaveMode) => {
    setError(undefined)
    try {
      const report = await create.mutateAsync({ input, mode })
      navigate(`/production-reports/${report.id}`, { replace: true, state: { notice: savedNotice(report.id, mode) } })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <>
      <PageHeader title="New production report" description="Record what the shift produced. Save a draft or submit it for review." />
      {reference.isError ? (
        <Card>
          <ErrorState onRetry={() => void reference.refetch()} />
        </Card>
      ) : !reference.data ? (
        <FormSkeleton />
      ) : (
        <ReportForm
          reference={reference.data}
          submitting={create.isPending}
          submitError={error}
          onSave={(input, mode) => void handleSave(input, mode)}
          onCancel={() => navigate('/production-reports')}
        />
      )}
    </>
  )
}

function EditReportView({ reportId }: { reportId: string }) {
  const navigate = useNavigate()
  const detail = useReportDetail(reportId)
  const reference = useReportReference()
  const update = useUpdateReport(reportId)
  const [error, setError] = useState<string>()
  const backTo = `/production-reports/${reportId}`

  const handleSave = async (input: ReportInput, mode: SaveMode) => {
    setError(undefined)
    try {
      await update.mutateAsync({ input, mode })
      navigate(backTo, { replace: true, state: { notice: savedNotice(reportId, mode) } })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  if (detail.isError || reference.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void Promise.all([detail.refetch(), reference.refetch()])} />
      </Card>
    )
  }
  if (detail.isPending || !reference.data) {
    return (
      <>
        <PageHeader title={`Edit ${reportId}`} />
        <FormSkeleton />
      </>
    )
  }
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

  const { report } = detail.data
  if (!isReportEditable(report.status)) {
    return (
      <>
        <PageHeader title={`Edit ${reportId}`} />
        <Card>
          <EmptyState
            title="This report can no longer be edited"
            description="Only drafts and reports returned for correction can be edited."
            action={
              <Button asChild variant="secondary">
                <Link to={backTo}>Back to report</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title={`Edit ${reportId}`} description="Changes are recorded in the report's history." />
      {report.status === 'returned' && report.returnReason ? (
        <p role="note" className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          <span className="font-medium">Returned for correction:</span> {report.returnReason}
        </p>
      ) : null}
      <ReportForm
        reference={reference.data}
        existing={report}
        submitting={update.isPending}
        submitError={error}
        onSave={(input, mode) => void handleSave(input, mode)}
        onCancel={() => navigate(backTo)}
      />
    </>
  )
}

/** Serves both /production-reports/new and /production-reports/:reportId/edit. */
export function ReportFormPage() {
  const { user } = useAuth()
  const { reportId } = useParams<{ reportId: string }>()

  if (!canRecordReports(user?.role)) {
    return <RestrictedState description="Only operators can file or edit production reports." />
  }
  return reportId ? <EditReportView reportId={reportId} /> : <CreateReportView />
}
