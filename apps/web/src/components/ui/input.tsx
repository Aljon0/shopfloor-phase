import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

/** Also serves as the date input for now (type="date"); a richer DatePicker arrives in Phase 2. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-panel px-3 text-sm text-ink placeholder:text-muted disabled:bg-neutral-bg disabled:opacity-70',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
