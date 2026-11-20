import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface KpiCardProps {
  label: string
  value: string
  hint: string
  icon: LucideIcon
}

export function KpiCard({ label, value, hint, icon: Icon }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Card>
  )
}
