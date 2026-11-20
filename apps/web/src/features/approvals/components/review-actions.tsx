import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { ProductionReport } from '@/types/domain'
import { useApproveReport, useReopenReport, useReturnReport } from '../hooks/use-approvals'
import { MIN_REASON_LENGTH, canApprove, canReopen, canReturn } from '../lib/approval-rules'
import { ApprovalRuleError } from '../services/approvals-service'

type Dialog = 'approve' | 'return' | 'reopen' | null

function messageFor(error: unknown): string | undefined {
  if (!error) return undefined
  return error instanceof ApprovalRuleError ? error.message : 'That did not work. Check the connection and try again.'
}

/** Approve / return / reopen. Supervisors only; the service layer enforces the same rules. */
export function ReviewActions({ report }: { report: ProductionReport }) {
  const navigate = useNavigate()
  const approve = useApproveReport(report.id)
  const returnIt = useReturnReport(report.id)
  const reopen = useReopenReport(report.id)
  const [dialog, setDialog] = useState<Dialog>(null)

  const close = () => {
    setDialog(null)
    approve.reset()
    returnIt.reset()
    reopen.reset()
  }
  const done = (notice: string) => () => {
    close()
    navigate(`/approvals/${report.id}`, { replace: true, state: { notice } })
  }

  return (
    <>
      {canApprove(report.status) ? <Button onClick={() => setDialog('approve')}>Approve</Button> : null}
      {canReturn(report.status) ? (
        <Button variant="secondary" onClick={() => setDialog('return')}>
          Return for correction
        </Button>
      ) : null}
      {canReopen(report.status) ? (
        <Button variant="secondary" onClick={() => setDialog('reopen')}>
          Reopen for correction
        </Button>
      ) : null}

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(open) => !open && close()}
        title="Approve this report?"
        description={`${report.id} will count in the official production figures. It cannot be edited afterwards; a correction means reopening it with a reason.`}
        confirmLabel="Approve"
        pending={approve.isPending}
        error={messageFor(approve.error)}
        onConfirm={() => approve.mutate(undefined, { onSuccess: done(`${report.id} was approved.`) })}
      />
      <ConfirmDialog
        open={dialog === 'return'}
        onOpenChange={(open) => !open && close()}
        title="Return for correction?"
        description="The operator will see your reason, correct the report and resubmit it."
        confirmLabel="Return report"
        tone="danger"
        reason={{ label: 'Reason for returning', minLength: MIN_REASON_LENGTH }}
        pending={returnIt.isPending}
        error={messageFor(returnIt.error)}
        onConfirm={(reason) => returnIt.mutate(reason, { onSuccess: done(`${report.id} was returned for correction.`) })}
      />
      <ConfirmDialog
        open={dialog === 'reopen'}
        onOpenChange={(open) => !open && close()}
        title="Reopen this approved report?"
        description="It leaves the official figures until it is corrected, resubmitted and approved again. The history keeps every step."
        confirmLabel="Reopen report"
        tone="danger"
        reason={{ label: 'Reason for reopening', minLength: MIN_REASON_LENGTH }}
        pending={reopen.isPending}
        error={messageFor(reopen.error)}
        onConfirm={(reason) => reopen.mutate(reason, { onSuccess: done(`${report.id} was reopened for correction.`) })}
      />
    </>
  )
}
