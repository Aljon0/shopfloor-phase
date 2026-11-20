import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { addDays } from '@/lib/dates'
import { getFactoryToday } from '@/services/factory-clock'
import type { ProductionOrder } from '@/types/domain'
import type { OrderReferenceData } from '../services/orders-service'
import { MAX_INSTRUCTIONS_LENGTH, buildOrderFormSchema, type OrderFormValues } from '../lib/order-form-schema'
import { PRIORITY_OPTIONS, lockedFields } from '../lib/order-rules'
import type { InitialOrderStatus, OrderInput } from '../types'

interface OrderFormProps {
  reference: OrderReferenceData
  /** Present when editing. */
  existing?: ProductionOrder
  /** Quantity already reported against the order; planned quantity cannot go below it. */
  committedProduced?: number
  submitting: boolean
  submitError: string | undefined
  onSubmit: (input: OrderInput, status: InitialOrderStatus) => void
  onCancel: () => void
}

const NEW_ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'planned', label: 'Planned' },
]

export function OrderForm({
  reference,
  existing,
  committedProduced = 0,
  submitting,
  submitError,
  onSubmit,
  onCancel,
}: OrderFormProps) {
  const isEdit = existing !== undefined
  const schema = useMemo(() => buildOrderFormSchema(committedProduced), [committedProduced])
  const locked = existing ? lockedFields(existing.status) : []
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const today = getFactoryToday()
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: existing
      ? {
          productId: existing.productId,
          lineId: existing.lineId,
          plannedQuantity: existing.plannedQuantity,
          plannedStart: existing.plannedStart,
          dueDate: existing.dueDate,
          priority: existing.priority,
          instructions: existing.instructions,
          status: 'draft',
        }
      : {
          productId: '',
          lineId: '',
          plannedStart: today,
          dueDate: addDays(today, 7),
          priority: 'normal',
          instructions: '',
          status: 'draft',
        },
  })

  // Inactive products and lines stay selectable only on an order that already uses them.
  const productOptions = reference.products
    .filter((p) => p.isActive || p.id === existing?.productId)
    .map((p) => ({ value: p.id, label: p.isActive ? p.name : `${p.name} (inactive)` }))
  const lineOptions = reference.lines
    .filter((l) => l.isActive || l.id === existing?.lineId)
    .map((l) => ({ value: l.id, label: l.isActive ? l.name : `${l.name} (inactive)` }))
  const instructionsLength = watch('instructions')?.length ?? 0

  const submit = handleSubmit(({ status, ...input }) => onSubmit(input, status))

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Order number" htmlFor="order-number">
              <Input
                id="order-number"
                disabled
                value={existing ? existing.orderNumber : 'Assigned when saved'}
                readOnly
              />
            </FormField>

            {isEdit ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">Status</p>
                <div className="flex h-10 items-center gap-3">
                  <StatusBadge status={existing.status} />
                  <span className="text-xs text-muted">Change status from the order page.</span>
                </div>
              </div>
            ) : (
              <FormField
                label="Initial status"
                htmlFor="order-initial-status"
                hint="Draft orders can be planned later."
              >
                <Select id="order-initial-status" options={NEW_ORDER_STATUS_OPTIONS} {...register('status')} />
              </FormField>
            )}

            <FormField label="Product" htmlFor="order-product" required error={errors.productId?.message}>
              {locked.includes('productId') ? (
                <Select id="order-product" options={productOptions} value={watch('productId')} disabled onChange={() => undefined} />
              ) : (
                <Select
                  id="order-product"
                  options={productOptions}
                  placeholder="Select a product"
                  invalid={!!errors.productId}
                  {...register('productId')}
                />
              )}
            </FormField>

            <FormField
              label="Production line"
              htmlFor="order-line"
              required
              error={errors.lineId?.message}
              {...(locked.length > 0 ? { hint: 'Product and line are locked once production has started.' } : {})}
            >
              {locked.includes('lineId') ? (
                <Select id="order-line" options={lineOptions} value={watch('lineId')} disabled onChange={() => undefined} />
              ) : (
                <Select
                  id="order-line"
                  options={lineOptions}
                  placeholder="Select a production line"
                  invalid={!!errors.lineId}
                  {...register('lineId')}
                />
              )}
            </FormField>

            <FormField
              label="Planned quantity"
              htmlFor="order-quantity"
              required
              error={errors.plannedQuantity?.message}
              {...(committedProduced > 0
                ? { hint: `${committedProduced} units already reported against this order.` }
                : {})}
            >
              <Input
                id="order-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                invalid={!!errors.plannedQuantity}
                {...register('plannedQuantity', { valueAsNumber: true })}
              />
            </FormField>

            <FormField label="Priority" htmlFor="order-priority" required error={errors.priority?.message}>
              <Select id="order-priority" options={PRIORITY_OPTIONS} {...register('priority')} />
            </FormField>

            <FormField label="Planned start date" htmlFor="order-start" required error={errors.plannedStart?.message}>
              <Controller
                control={control}
                name="plannedStart"
                render={({ field }) => (
                  <DatePicker
                    id="order-start"
                    invalid={!!errors.plannedStart}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </FormField>

            <FormField label="Due date" htmlFor="order-due" required error={errors.dueDate?.message}>
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <DatePicker
                    id="order-due"
                    invalid={!!errors.dueDate}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </FormField>
          </div>

          <FormField
            label="Instructions"
            htmlFor="order-instructions"
            error={errors.instructions?.message}
            hint={`${instructionsLength} / ${MAX_INSTRUCTIONS_LENGTH} characters`}
          >
            <Textarea id="order-instructions" invalid={!!errors.instructions} {...register('instructions')} />
          </FormField>

          {submitError ? (
            <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          ) : null}
        </CardContent>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <Button
            variant="secondary"
            onClick={() => (isDirty ? setConfirmingDiscard(true) : onCancel())}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create order'}
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
