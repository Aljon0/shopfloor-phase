import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-md border bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted disabled:bg-neutral-bg disabled:opacity-70',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
