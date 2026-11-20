import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMinutes, formatNumber, formatPercent } from '@/lib/format'
import type { DowntimeSummary, DowntimeSummaryRow } from '../types'

function Breakdown({ title, rows, total }: { title: string; rows: DowntimeSummaryRow[]; total: number }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title="No downtime" description="Nothing recorded for the current filters." />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const share = total > 0 ? (r.minutes / total) * 100 : 0
              return (
                <li key={r.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink">{r.label}</span>
                    <span className="shrink-0 tabular-nums text-ink">
                      {formatMinutes(r.minutes)}
                      <span className="ml-1.5 text-xs text-muted">
                        {formatPercent(share, 0)} · {formatNumber(r.events)} {r.events === 1 ? 'event' : 'events'}
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

/** Summary of the events currently shown, so it always matches the table below it. */
export function DowntimeSummaryCards({ summary }: { summary: DowntimeSummary }) {
  return (
    <section aria-label="Downtime summary" className="mb-4 grid gap-4 lg:grid-cols-2">
      <Breakdown title={`By category · ${formatMinutes(summary.totalMinutes)} total`} rows={summary.byCategory} total={summary.totalMinutes} />
      <Breakdown title="By machine" rows={summary.byMachine} total={summary.totalMinutes} />
    </section>
  )
}
