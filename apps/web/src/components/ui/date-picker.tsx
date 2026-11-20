import type { InputHTMLAttributes } from 'react'
import { Input } from './input'

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** YYYY-MM-DD, or an empty string when unset. */
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}

/**
 * Date field built on the native date input: keyboard accessible, large touch target, no external
 * scripts, and it works offline on factory PCs and tablets. Emits plain YYYY-MM-DD strings.
 */
export function DatePicker({ value, onChange, invalid, ...props }: DatePickerProps) {
  return (
    <Input
      type="date"
      value={value}
      invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  )
}
