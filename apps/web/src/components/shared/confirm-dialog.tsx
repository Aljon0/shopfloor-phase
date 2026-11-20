import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  /** When set, the user must type a reason (at least minLength characters) before confirming. */
  reason?: { label: string; minLength: number }
  pending?: boolean
  /** Error from the last attempt, shown inside the dialog. */
  error?: string | undefined
  onConfirm: (reason: string) => void
}

/** Confirmation step for consequential actions (status changes, cancelling, discarding edits). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  reason,
  pending = false,
  error,
  onConfirm,
}: ConfirmDialogProps) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = text.trim()
  const reasonError =
    reason && trimmed.length < reason.minLength ? `Enter a reason of at least ${reason.minLength} characters.` : undefined

  const handleOpenChange = (next: boolean) => {
    if (pending) return
    if (!next) {
      setText('')
      setTouched(false)
    }
    onOpenChange(next)
  }

  const handleConfirm = () => {
    if (reasonError) {
      setTouched(true)
      return
    }
    onConfirm(trimmed)
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={pending}>
            Keep as is
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {reason ? (
        <FormField label={reason.label} htmlFor="confirm-reason" required error={touched ? reasonError : undefined}>
          <Textarea
            id="confirm-reason"
            rows={3}
            value={text}
            invalid={touched && reasonError !== undefined}
            onChange={(e) => setText(e.target.value)}
          />
        </FormField>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}
