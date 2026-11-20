import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { ProductionReport } from '@/types/domain'
import { useDeleteReport, useSubmitReport } from '../hooks/use-reports'
import { canSubmitReport, isReportDeletable, isReportEditable } from '../lib/report-rules'
import { ReportRuleError } from '../services/reports-service'

interface ReportActionsProps {
  report: ProductionReport
  /** Operators only. Hiding buttons is not security; the service layer enforces the rules too. */
  canRecord: boolean
}

function messageFor(error: unknown): string | undefined {
  if (!error) return undefined
  return error instanceof ReportRuleError ? error.message : 'That did not work. Check the connection and try again.'
}

export function ReportActions({ report, canRecord }: ReportActionsProps) {
  const navigate = useNavigate()
  const submit = useSubmitReport(report.id)
  const remove = useDeleteReport(report.id)
  const [dialog, setDialog] = useState<'submit' | 'delete' | null>(null)

  if (!canRecord) return null
  const resubmit = report.status === 'returned'

  const close = () => {
    setDialog(null)
    submit.reset()
    remove.reset()
  }

  return (
    <>
      {isReportEditable(report.status) ? (
        <Button asChild variant="secondary">
          <Link to={`/production-reports/${report.id}/edit`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
      ) : null}
      {isReportDeletable(report.status) ? (
        <Button variant="secondary" className="text-danger" onClick={() => setDialog('delete')}>
          Delete draft
        </Button>
      ) : null}
      {canSubmitReport(report.status) ? (
        <Button onClick={() => setDialog('submit')}>{resubmit ? 'Resubmit for review' : 'Submit for review'}</Button>
      ) : null}

      <ConfirmDialog
        open={dialog === 'submit'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={resubmit ? 'Resubmit this report?' : 'Submit for review?'}
        description={`${report.id} will be sent to a supervisor. You cannot edit it while it is waiting for review.`}
        confirmLabel={resubmit ? 'Resubmit' : 'Submit'}
        pending={submit.isPending}
        error={messageFor(submit.error)}
        onConfirm={() => submit.mutate(undefined, { onSuccess: close })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete this draft?"
        description={`${report.id} and its history will be removed. This cannot be undone.`}
        confirmLabel="Delete draft"
        tone="danger"
        pending={remove.isPending}
        error={messageFor(remove.error)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => navigate('/production-reports', { replace: true, state: { notice: `${report.id} was deleted.` } }),
          })
        }
      />
    </>
  )
}
