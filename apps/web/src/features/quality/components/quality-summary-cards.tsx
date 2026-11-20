import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNumber, formatPercent } from '@/lib/format'
import type { QualitySummary } from '../types'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  )
}

/** Summary of the inspections currently shown, so it always matches the table below it. */
export function QualitySummaryCards({ summary }: { summary: QualitySummary }) {
  return (
    <section aria-label="Quality summary" className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Inspections" value={formatNumber(summary.inspections)} />
        <Stat label="Pieces inspected" value={formatNumber(summary.inspected)} />
        <Stat label="Pieces failed" value={formatNumber(summary.failed)} hint={`Failure rate ${formatPercent(summary.failureRate)}`} />
        <Stat label="Pass rate" value={formatPercent(summary.passRate)} hint="Passed ÷ inspected" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Failed pieces by defect classification</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.byDefect.length === 0 ? (
            <EmptyState title="No failures" description="Nothing failed in the inspections shown." />
          ) : (
            <ul className="space-y-3">
              {summary.byDefect.map((r) => {
                const share = summary.failed > 0 ? (r.failed / summary.failed) * 100 : 0
                return (
                  <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{r.label}</span>
                      <span className="shrink-0 tabular-nums text-ink">
                        {formatNumber(r.failed)} failed
                        <span className="ml-1.5 text-xs text-muted">
                          {formatPercent(share, 0)} · {formatNumber(r.inspections)} {r.inspections === 1 ? 'inspection' : 'inspections'}
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
    </section>
  )
}
