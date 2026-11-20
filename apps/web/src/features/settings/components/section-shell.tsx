import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

interface SectionShellProps {
  title: string
  description: string
  addLabel?: string
  onAdd?: () => void
  notice?: string | undefined
  error?: string | undefined
  children: ReactNode
}

export function SectionShell({ title, description, addLabel, onAdd, notice, error, children }: SectionShellProps) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted">{description}</p>
        </div>
        {addLabel && onAdd ? (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {addLabel}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}
      <Card>{children}</Card>
    </section>
  )
}

export { CardHeader, CardTitle }
