import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatMinutes } from '@/lib/format'
import { buildDowntimeFormSchema, type DowntimeFormValues } from '../lib/downtime-form-schema'
import { CATEGORY_OPTIONS, MAX_NOTES_LENGTH, localDurationMinutes, toLocalInput } from '../lib/downtime-rules'
import type { DowntimeInput, DowntimeListItem, DowntimeReferenceData } from '../types'

interface Props {
  reference: DowntimeReferenceData
  existing?: DowntimeListItem
  submitting: boolean
  submitError: string | undefined
  onSave: (input: DowntimeInput) => void
  onCancel: () => void
}

export function DowntimeForm({ reference, existing, submitting, submitError, onSave, onCancel }: Props) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const schema = useMemo(() => buildDowntimeFormSchema({ today: reference.today }), [reference.today])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<DowntimeFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: existing
      ? {
          machineId: existing.event.machineId,
          orderId: existing.event.orderId ?? '',
          reportId: existing.event.reportId ?? '',
          startTime: toLocalInput(existing.event.startTime),
          endTime: toLocalInput(existing.event.endTime),
          category: existing.event.category,
          notes: existing.event.notes,
        }
      : { machineId: '', orderId: '', reportId: '', startTime: '', endTime: '', notes: '' },
  })

  const machineId = watch('machineId')
  const orderId = watch('orderId')
  const reportId = watch('reportId')
  const startTime = watch('startTime')
  const endTime = watch('endTime')
  const notesLength = watch('notes')?.length ?? 0

  const machine = reference.machines.find((m) => m.id === machineId)
  const line = reference.lines.find((l) => l.id === machine?.lineId)
  const machineOptions = reference.machines
    .filter((m) => m.isActive || m.id === existing?.event.machineId)
    .map((m) => ({
      value: m.id,
      label: `${reference.lines.find((l) => l.id === m.lineId)?.name ?? ''} · ${m.name}${m.isActive ? '' : ' (inactive)'}`,
    }))
  // Orders on the machine's line that can still be worked on; reports for the machine that are not approved.
  const orderOptions = reference.orders
    .filter((o) => o.lineId === machine?.lineId && (o.status === 'in_progress' || o.status === 'planned' || o.id === existing?.event.orderId))
    .map((o) => ({ value: o.id, label: `${o.orderNumber} · ${o.productName}` }))
  const reportOptions = reference.reports
    .filter((r) => r.machineId === machineId && (r.status !== 'approved' || r.id === existing?.event.reportId))
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
    .map((r) => ({ value: r.id, label: `${r.id} (${r.status.replace('_', ' ')})` }))

  // Switching machine can invalidate the order or report that was chosen for the previous one.
  useEffect(() => {
    if (orderId && !orderOptions.some((o) => o.value === orderId)) setValue('orderId', '', { shouldDirty: true })
    if (reportId && !reportOptions.some((r) => r.value === reportId)) setValue('reportId', '', { shouldDirty: true })
  }, [machineId, orderId, reportId, orderOptions, reportOptions, setValue])

  const minutes = localDurationMinutes(startTime ?? '', endTime ?? '')
  const submit = handleSubmit((values) => onSave(values))

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void submit(e)
      }}
    >
      <Card>
        <CardContent className="space-y-6 p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Machine" htmlFor="dt-machine" required error={errors.machineId?.message}>
              <Select id="dt-machine" options={machineOptions} placeholder="Select a machine" invalid={!!errors.machineId} {...register('machineId')} />
            </FormField>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">Production line</p>
              <div className="flex h-10 items-center text-sm text-ink" data-testid="dt-line">
                {line ? line.name : <span className="text-muted">Set by the machine</span>}
              </div>
            </div>
            <FormField label="Start" htmlFor="dt-start" required error={errors.startTime?.message}>
              <Input id="dt-start" type="datetime-local" invalid={!!errors.startTime} {...register('startTime')} />
            </FormField>
            <FormField label="End" htmlFor="dt-end" required error={errors.endTime?.message}>
              <Input id="dt-end" type="datetime-local" invalid={!!errors.endTime} {...register('endTime')} />
            </FormField>
          </div>

          <div className="rounded-md bg-app px-3 py-2" data-testid="dt-duration">
            <p className="text-xs font-medium text-muted">Duration (calculated from start and end)</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{minutes === null ? '—' : formatMinutes(minutes)}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Category" htmlFor="dt-category" required error={errors.category?.message}>
              <Select id="dt-category" options={CATEGORY_OPTIONS} placeholder="Select a category" invalid={!!errors.category} {...register('category')} />
            </FormField>
            <div />
            <FormField label="Production order" htmlFor="dt-order" hint="Optional. Only orders on this machine's line.">
              <Select id="dt-order" options={[{ value: '', label: 'Not tied to an order' }, ...orderOptions]} disabled={!machine} {...register('orderId')} />
            </FormField>
            <FormField label="Production report" htmlFor="dt-report" hint="Optional. Approved reports cannot be linked.">
              <Select id="dt-report" options={[{ value: '', label: 'Not linked to a report' }, ...reportOptions]} disabled={!machine} {...register('reportId')} />
            </FormField>
          </div>

          <FormField
            label="Reason"
            htmlFor="dt-notes"
            required
            error={errors.notes?.message}
            hint={`${notesLength} / ${MAX_NOTES_LENGTH} characters`}
          >
            <Textarea id="dt-notes" invalid={!!errors.notes} {...register('notes')} />
          </FormField>

          {submitError ? (
            <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          ) : null}
        </CardContent>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={() => (isDirty ? setConfirmingDiscard(true) : onCancel())} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : existing ? 'Save changes' : 'Record downtime'}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmingDiscard}
        onOpenChange={setConfirmingDiscard}
        title="Discard your changes?"
        description="The changes you entered have not been saved."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={onCancel}
      />
    </form>
  )
}
