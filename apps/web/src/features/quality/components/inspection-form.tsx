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
import { buildInspectionFormSchema, type InspectionFormValues } from '../lib/quality-form-schema'
import { MAX_NOTES_LENGTH, canInspectOrder, passRate, passedQuantity } from '../lib/quality-rules'
import type { InspectionInput, InspectionItem, QualityReferenceData } from '../types'

interface Props {
  reference: QualityReferenceData
  /** Present when editing. */
  existing?: InspectionItem
  submitting: boolean
  submitError: string | undefined
  onSave: (input: InspectionInput) => void
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

export function InspectionForm({ reference, existing, submitting, submitError, onSave, onCancel }: Props) {
  const isEdit = existing !== undefined
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const schema = useMemo(
    () =>
      buildInspectionFormSchema({
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
  } = useForm<InspectionFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: existing
      ? {
          orderId: existing.inspection.orderId,
          reportId: existing.inspection.reportId ?? '',
          inspectionDate: existing.inspection.inspectionDate,
          inspectedQuantity: existing.inspection.inspectedQuantity,
          failedQuantity: existing.inspection.failedQuantity,
          defectId: existing.inspection.defectId ?? '',
          notes: existing.inspection.notes,
        }
      : { orderId: '', reportId: '', inspectionDate: reference.today, defectId: '', notes: '' },
  })

  const orderId = watch('orderId')
  const reportId = watch('reportId')
  const inspected = watch('inspectedQuantity')
  const failed = watch('failedQuantity')
  const notesLength = watch('notes')?.length ?? 0

  const orderOptions = reference.orders
    .filter((o) => canInspectOrder(o.status) || o.id === existing?.inspection.orderId)
    .map((o) => ({ value: o.id, label: `${o.orderNumber} · ${o.productName}` }))
  const selectedOrder = reference.orders.find((o) => o.id === orderId)
  const reportOptions = reference.reports
    .filter((r) => r.orderId === orderId)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.id.localeCompare(b.id))
    .map((r) => ({ value: r.id, label: `${r.id} (${r.producedQuantity} produced)` }))

  // A report from the previous order must not stay selected when the order changes.
  useEffect(() => {
    if (reportId && !reportOptions.some((r) => r.value === reportId)) setValue('reportId', '', { shouldDirty: true })
  }, [orderId, reportId, reportOptions, setValue])

  const passed = passedQuantity(inspected, failed)
  const noFailures = Number.isInteger(failed) && failed === 0

  // Clearing the failed count to zero also clears the defect, which only applies to failures.
  useEffect(() => {
    if (noFailures) setValue('defectId', '')
  }, [noFailures, setValue])

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit((values) => onSave({ ...values }))(e)
      }}
    >
      <Card>
        <CardContent className="space-y-6 p-5">
          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-ink">What was inspected</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label="Production order"
                htmlFor="qi-order"
                required
                error={errors.orderId?.message}
                {...(isEdit ? { hint: 'The order cannot be changed once the inspection exists.' } : {})}
              >
                <Select
                  id="qi-order"
                  options={orderOptions}
                  placeholder="Select an order"
                  invalid={!!errors.orderId}
                  disabled={isEdit}
                  {...register('orderId')}
                />
              </FormField>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">Product</p>
                <div className="flex h-10 items-center text-sm text-ink" data-testid="qi-product">
                  {selectedOrder ? selectedOrder.productName : <span className="text-muted">Set by the order</span>}
                </div>
              </div>
              <FormField label="Production report" htmlFor="qi-report" error={errors.reportId?.message} hint="Optional. Link the report this sample came from.">
                <Select
                  id="qi-report"
                  options={reportOptions}
                  placeholder={selectedOrder ? 'Not linked to a report' : 'Select an order first'}
                  disabled={!selectedOrder}
                  {...register('reportId')}
                />
              </FormField>
              <FormField label="Inspection date" htmlFor="qi-date" required error={errors.inspectionDate?.message}>
                <Controller
                  control={control}
                  name="inspectionDate"
                  render={({ field }) => (
                    <DatePicker
                      id="qi-date"
                      max={reference.today}
                      invalid={!!errors.inspectionDate}
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
            <legend className="mb-1 text-sm font-semibold text-ink">Result</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Inspected quantity" htmlFor="qi-inspected" required error={errors.inspectedQuantity?.message}>
                <Input id="qi-inspected" type="number" inputMode="numeric" min={1} step={1} invalid={!!errors.inspectedQuantity} {...register('inspectedQuantity', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Failed quantity" htmlFor="qi-failed" required error={errors.failedQuantity?.message}>
                <Input id="qi-failed" type="number" inputMode="numeric" min={0} step={1} invalid={!!errors.failedQuantity} {...register('failedQuantity', { valueAsNumber: true })} />
              </FormField>
              <FormField
                label="Defect classification"
                htmlFor="qi-defect"
                required={!noFailures}
                error={errors.defectId?.message}
                hint={noFailures ? 'Only needed when something failed.' : undefined}
              >
                <Select
                  id="qi-defect"
                  options={reference.defects
                    .filter((d) => d.isActive || d.id === existing?.inspection.defectId)
                    .map((d) => ({ value: d.id, label: d.isActive ? d.name : `${d.name} (inactive)` }))}
                  placeholder="Select a defect"
                  invalid={!!errors.defectId}
                  disabled={noFailures}
                  {...register('defectId')}
                />
              </FormField>
            </div>
            <dl aria-label="Calculated values" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Passed quantity" value={passed !== null ? formatNumber(passed) : '—'} />
              <Tile label="Pass rate" value={passed !== null ? formatPercent(passRate(passed, inspected)) : '—'} />
            </dl>
            <p className="text-xs text-muted">Passed = inspected − failed. A basic record of what was checked, not a certified quality system.</p>
          </fieldset>

          <FormField label="Notes" htmlFor="qi-notes" error={errors.notes?.message} hint={`${notesLength} / ${MAX_NOTES_LENGTH} characters`}>
            <Textarea id="qi-notes" invalid={!!errors.notes} {...register('notes')} />
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
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Record inspection'}
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
