import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMinutes, formatNumber, formatPercent } from '@/lib/format'
import type { DowntimeCategoryRow } from '../lib/aggregate'

interface DowntimeSummaryProps {
  categories: DowntimeCategoryRow[]
  totalMinutes: number
}

export function DowntimeSummary({ categories, totalMinutes }: DowntimeSummaryProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Downtime by category</CardTitle>
        <span className="text-xs text-muted">{formatMinutes(totalMinutes)} total</span>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <EmptyState title="No downtime recorded" description="No downtime events started in this period." />
        ) : (
          <ul className="space-y-3">
            {categories.map((c) => {
              const share = totalMinutes > 0 ? (c.minutes / totalMinutes) * 100 : 0
              return (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink">{c.label}</span>
                    <span className="shrink-0 tabular-nums text-ink">
                      {formatMinutes(c.minutes)}
                      <span className="ml-1.5 text-xs text-muted">
                        {formatPercent(share, 0)} · {formatNumber(c.events)} {c.events === 1 ? 'event' : 'events'}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-sm bg-neutral-bg" aria-hidden="true">
                    <div className="h-full rounded-sm bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
