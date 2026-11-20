import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatNumber, formatPercent } from '@/lib/format'
import type { ProductionReport } from '@/types/domain'
import { validateQuantities } from '@/lib/kpi'
import { buildReportFormSchema, type ReportFormValues } from '../lib/report-form-schema'
import { MAX_NOTES_LENGTH, SHIFT_OPTIONS, canReportAgainstOrder, reportMetrics } from '../lib/report-rules'
import type { ReportInput, ReportReferenceData, SaveMode } from '../types'

interface ReportFormProps {
  reference: ReportReferenceData
  /** Present when editing a draft or returned report. */
  existing?: ProductionReport
  submitting: boolean
  submitError: string | undefined
  onSave: (input: ReportInput, mode: SaveMode) => void
  onCancel: () => void
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-app px-3 py-2">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

export function ReportForm({ reference, existing, submitting, submitError, onSave, onCancel }: ReportFormProps) {
  const isEdit = existing !== undefined
  const resubmitting = existing?.status === 'returned'
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState<ReportFormValues | null>(null)

  const schema = useMemo(
    () =>
      buildReportFormSchema({
        today: reference.today,
        orderStarts: Object.fromEntries(reference.orders.map((o) => [o.id, o.plannedStart])),
      }),
    [reference],
  )

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: existing
      ? {
          orderId: existing.orderId,
          machineId: existing.machineId,
          shift: existing.shift,
          reportDate: existing.reportDate,
          producedQuantity: existing.producedQuantity,
          rejectedQuantity: existing.rejectedQuantity,
          notes: existing.notes ?? '',
        }
      : { orderId: '', machineId: '', shift: 'morning', reportDate: reference.today, notes: '' },
  })

  const orderId = watch('orderId')
  const machineId = watch('machineId')
  const produced = watch('producedQuantity')
  const rejected = watch('rejectedQuantity')
  const notesLength = watch('notes')?.length ?? 0

  // Orders that accept new reports, plus the report's own order when editing.
  const orderOptions = reference.orders
    .filter((o) => canReportAgainstOrder(o.status) || o.id === existing?.orderId)
    .map((o) => ({ value: o.id, label: `${o.orderNumber} · ${o.productName}` }))
  const selectedOrder = reference.orders.find((o) => o.id === orderId)
  const machineOptions = reference.machines
    .filter((m) => m.lineId === selectedOrder?.lineId && (m.isActive || m.id === existing?.machineId))
    .map((m) => ({ value: m.id, label: m.isActive ? m.name : `${m.name} (inactive)` }))

  // Changing the order changes the line, so a machine from the previous line is cleared.
  useEffect(() => {
    if (machineId && !machineOptions.some((m) => m.value === machineId)) {
      setValue('machineId', '', { shouldDirty: true })
    }
  }, [orderId, machineId, machineOptions, setValue])

  // Live preview of the derived values, using the same formulas as the dashboard.
  const machine = reference.machines.find((m) => m.id === machineId)
  const quantitiesOk = validateQuantities({ producedQuantity: produced, rejectedQuantity: rejected }).length === 0
  const metrics =
    quantitiesOk && machine
      ? reportMetrics({ producedQuantity: produced, rejectedQuantity: rejected, shiftTarget: machine.shiftTarget })
      : null

  const toInput = ({ ...values }: ReportFormValues): ReportInput => values
  const saveDraft = handleSubmit((values) => onSave(toInput(values), 'draft'))
  const askToSubmit = handleSubmit((values) => setPendingSubmit(values))

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void saveDraft(e)
      }}
    >
      <Card>
        <CardContent className="space-y-6 p-5">
          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-ink">Work</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Production order" htmlFor="report-order" required error={errors.orderId?.message}
                {...(isEdit ? { hint: 'The order cannot be changed once the report exists.' } : {})}>
                <Select
                  id="report-order"
                  options={orderOptions}
                  placeholder="Select an order in progress"
                  invalid={!!errors.orderId}
                  disabled={isEdit}
                  {...register('orderId')}
                />
              </FormField>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">Production line</p>
                <div className="flex h-10 items-center text-sm text-ink" data-testid="report-line">
                  {selectedOrder ? selectedOrder.lineName : <span className="text-muted">Set by the order</span>}
                </div>
              </div>

              <FormField label="Machine" htmlFor="report-machine" required error={errors.machineId?.message}>
                <Select
                  id="report-machine"
                  options={machineOptions}
                  placeholder={selectedOrder ? 'Select a machine' : 'Select an order first'}
                  invalid={!!errors.machineId}
                  disabled={!selectedOrder}
                  {...register('machineId')}
                />
              </FormField>

              <FormField label="Shift" htmlFor="report-shift" required error={errors.shift?.message}>
                <Select id="report-shift" options={SHIFT_OPTIONS} invalid={!!errors.shift} {...register('shift')} />
              </FormField>

              <FormField label="Report date" htmlFor="report-date" required error={errors.reportDate?.message}>
                <Controller
                  control={control}
                  name="reportDate"
                  render={({ field }) => (
                    <DatePicker
                      id="report-date"
                      max={reference.today}
                      invalid={!!errors.reportDate}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </FormField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-ink">Output</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Produced quantity" htmlFor="report-produced" required error={errors.producedQuantity?.message}>
                <Input
                  id="report-produced"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  invalid={!!errors.producedQuantity}
                  {...register('producedQuantity', { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Rejected quantity" htmlFor="report-rejected" required error={errors.rejectedQuantity?.message}>
                <Input
                  id="report-rejected"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  invalid={!!errors.rejectedQuantity}
                  {...register('rejectedQuantity', { valueAsNumber: true })}
                />
              </FormField>
            </div>
            <dl aria-label="Calculated values" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Good quantity" value={metrics ? formatNumber(metrics.goodQuantity) : '—'} />
              <Tile label="Rejection rate" value={metrics ? formatPercent(metrics.rejectionRate) : '—'} />
              <Tile label="Shift target" value={machine ? formatNumber(machine.shiftTarget) : '—'} />
              <Tile label="Target achievement" value={metrics ? formatPercent(metrics.targetAchievement) : '—'} />
            </dl>
            <p className="text-xs text-muted">
              Calculated from the quantities above. Official figures are only counted once a supervisor approves the report.
            </p>
          </fieldset>

          <FormField
            label="Notes"
            htmlFor="report-notes"
            error={errors.notes?.message}
            hint={`${notesLength} / ${MAX_NOTES_LENGTH} characters`}
          >
            <Textarea id="report-notes" invalid={!!errors.notes} {...register('notes')} />
          </FormField>

          {submitError ? (
            <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          ) : null}
        </CardContent>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <Button
            variant="ghost"
            onClick={() => (isDirty ? setConfirmingDiscard(true) : onCancel())}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => void saveDraft()}>
            {submitting ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void askToSubmit()}>
            {resubmitting ? 'Resubmit for review' : 'Submit for review'}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={pendingSubmit !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSubmit(null)
        }}
        title={resubmitting ? 'Resubmit this report?' : 'Submit for review?'}
        description="A supervisor will review the report. You cannot edit it while it is waiting for review."
        confirmLabel={resubmitting ? 'Resubmit' : 'Submit'}
        pending={submitting}
        error={submitError}
        onConfirm={() => {
          if (pendingSubmit) onSave(toInput(pendingSubmit), 'submit')
        }}
      />

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
