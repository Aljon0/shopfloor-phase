import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'

export interface FieldSpec {
  name: string
  label: string
  kind: 'text' | 'number' | 'time' | 'select' | 'password'
  options?: SelectOption[]
  hint?: string
  /** Shown but not editable (for values that are fixed after creation). */
  readOnly?: boolean
  placeholder?: string
}

interface FieldsDialogProps {
  title: string
  description?: string
  fields: FieldSpec[]
  initial: Record<string, string>
  submitLabel: string
  /** Field-level checks run before saving; return a message per invalid field. */
  validate: (values: Record<string, string>) => Record<string, string | undefined>
  /** Throw to show an error in the dialog; resolve to close it. */
  onSubmit: (values: Record<string, string>) => Promise<void>
  onClose: () => void
}

/** A small form in a modal. Mount it only while open so it starts fresh each time. */
export function FieldsDialog({ title, description, fields, initial, submitLabel, validate, onSubmit, onClose }: FieldsDialogProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [serverError, setServerError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    setSaving(true)
    setServerError(undefined)
    try {
      await onSubmit(values)
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'That did not work. Try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={title}
      {...(description ? { description } : {})}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="settings-fields-form" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </>
      }
    >
      <form id="settings-fields-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        {fields.map((f) => {
          const id = `cfg-${f.name}`
          const common = { id, value: values[f.name] ?? '', onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f.name]: e.target.value })) }
          return (
            <FormField key={f.name} label={f.label} htmlFor={id} required={!f.readOnly} {...(errors[f.name] ? { error: errors[f.name] as string } : {})} {...(f.hint ? { hint: f.hint } : {})}>
              {f.kind === 'select' ? (
                <Select {...common} options={f.options ?? []} placeholder="Select…" invalid={!!errors[f.name]} disabled={f.readOnly} />
              ) : (
                <Input
                  {...common}
                  type={f.kind === 'number' ? 'number' : f.kind === 'time' ? 'time' : f.kind === 'password' ? 'password' : 'text'}
                  {...(f.kind === 'password' ? { autoComplete: 'new-password' } : {})}
                  {...(f.kind === 'number' ? { min: 1, step: 1, inputMode: 'numeric' as const } : {})}
                  {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                  invalid={!!errors[f.name]}
                  readOnly={f.readOnly}
                  disabled={f.readOnly}
                />
              )}
            </FormField>
          )
        })}
        {serverError ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
