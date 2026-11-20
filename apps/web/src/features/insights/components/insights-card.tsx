import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, OctagonAlert, Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import { useInsights, useNarrative } from '../hooks/use-insights'
import type { Trend } from '../types'

const ASSESSMENT_TEXT: Record<Trend['assessment'], string> = { better: 'Better', worse: 'Worse', neutral: 'No real change', unknown: 'Not compared' }
const ASSESSMENT_TONE: Record<Trend['assessment'], 'success' | 'danger' | 'neutral'> = { better: 'success', worse: 'danger', neutral: 'neutral', unknown: 'neutral' }

function DirectionIcon({ direction }: { direction: Trend['direction'] }) {
  if (direction === 'up') return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
  if (direction === 'down') return <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
  return <Minus className="h-4 w-4" aria-hidden="true" />
}

export function InsightsCard({ range }: { range: DateRange }) {
  const query = useInsights(range, true)
  const narrative = useNarrative()
  const data = query.data
  // A summary belongs to the dates it was made for; clear it when the dates change.
  useEffect(() => {
    narrative.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights</CardTitle>
        {data ? <span className="text-xs text-muted">Compared with {data.previousRange.from} to {data.previousRange.to}</span> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isError && !data ? (
          <p role="alert" className="text-sm text-danger">Insights could not be loaded. Refresh to try again.</p>
        ) : !data ? (
          <p className="text-sm text-muted" aria-busy="true">Loading insights…</p>
        ) : (
          <>
            <p className="text-xs text-muted">
              Trends and flags come from fixed rules applied to the approved figures above. Nothing here is guessed.
            </p>
            {!data.hasEnoughData ? (
              <p className="rounded-md bg-neutral-bg px-3 py-2 text-sm text-ink">
                There are fewer than 3 approved reports in this period, so trends are not compared. Flags still apply to any line with at least 100 units. Pick a longer period for a fuller picture.
              </p>
            ) : null}

            <section aria-label="Trends">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Trends</h4>
              <ul className="divide-y divide-line rounded-md border border-line">
                {data.trends.map((t) => (
                  <li key={t.metric} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 text-ink">{t.label}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums text-ink">{t.current ?? '—'}</span>
                      <span className="inline-flex items-center gap-1 text-muted" title={t.explanation}>
                        <DirectionIcon direction={t.direction} />
                        {t.change || 'no comparison'}
                      </span>
                      <Badge tone={ASSESSMENT_TONE[t.assessment]}>{ASSESSMENT_TEXT[t.assessment]}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Flags">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Flags</h4>
              {data.flags.length === 0 ? (
                <p className="text-sm text-muted">Nothing flagged for this period.</p>
              ) : (
                <ul className="space-y-2">
                  {data.flags.map((f) => (
                    <li key={f.id} className="rounded-md border border-line px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {f.severity === 'critical' ? (
                          <Badge tone="danger"><OctagonAlert className="h-3.5 w-3.5" aria-hidden="true" />Critical</Badge>
                        ) : (
                          <Badge tone="warning"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Warning</Badge>
                        )}
                        <span className="font-medium text-ink">{f.title}</span>
                      </div>
                      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                        {f.evidence.map((e) => (
                          <div key={e.label} className="flex gap-1">
                            <dt>{e.label}:</dt>
                            <dd className="tabular-nums text-ink">{e.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <details className="mt-1.5 text-xs text-muted">
                        <summary className="cursor-pointer text-primary">Why was this flagged?</summary>
                        <p className="mt-1">{f.why}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="AI summary" className="rounded-md border border-line bg-neutral-bg/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  AI summary <span className="text-xs font-normal text-muted">(optional)</span>
                </h4>
                <Button variant="secondary" disabled={!data.aiConfigured || narrative.isPending} onClick={() => narrative.mutate(range)}>
                  {narrative.isPending ? 'Writing…' : 'Generate AI summary'}
                </Button>
              </div>
              {!data.aiConfigured ? (
                <p className="mt-2 text-sm text-muted">AI summaries are not set up on this server. Everything above works without them.</p>
              ) : narrative.isError ? (
                <p role="alert" className="mt-2 text-sm text-danger">The request failed. Everything above is unaffected; try again later.</p>
              ) : narrative.data?.status === 'ok' ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-ink">{narrative.data.text}</p>
                  <p className="text-xs text-muted">{narrative.data.notice}</p>
                </div>
              ) : narrative.data ? (
                <p className="mt-2 text-sm text-muted" role="status">{narrative.data.message}</p>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Sends only the summary figures and flags (no names of people) to the AI service. Never needed for reporting or approvals.
                </p>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
