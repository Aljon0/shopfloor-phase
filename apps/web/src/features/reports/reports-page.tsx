import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { FormField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DowntimeSummary } from '@/features/dashboard/components/downtime-summary'
import { KpiGrid } from '@/features/dashboard/components/kpi-grid'
import { LinePerformanceTable } from '@/features/dashboard/components/line-performance-table'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/cn'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatFactoryDateTime, isValidDateString } from '@/lib/dates'
import { formatMinutes, formatNumber, formatPercent, NOT_APPLICABLE } from '@/lib/format'
import { addDays } from '@/lib/dates'
import { getFactoryToday } from '@/services/factory-clock'
import { useSummary } from './hooks/use-summary'
import { periodFor, shiftAnchor, type SummaryKind } from './lib/summary'
import { buildSummaryCsv } from './lib/summary-export'

function describePeriod(kind: SummaryKind, from: string, to: string): string {
  return kind === 'daily' ? formatDate(from, true) : `${formatDate(from)} – ${formatDate(to, true)}`
}

export function ReportsPage() {
  const { user } = useAuth()
  const today = getFactoryToday()
  const [kind, setKind] = useState<SummaryKind>('daily')
  // The latest complete day / week is the useful default: today's figures are still coming in.
  const [anchor, setAnchor] = useState(addDays(today, -1))

  const valid = isValidDateString(anchor)
  const period = periodFor(kind, anchor)
  const query = useSummary(kind, anchor, user?.name ?? 'Unknown user')
  const summary = query.data

  return (
    <>
      <PageHeader
        title="Reports"
        description="Daily and weekly operational summaries you can export."
        actions={
          <Button
            variant="secondary"
            disabled={!summary}
            onClick={() => {
              if (!summary) return
              const { filename, csv } = buildSummaryCsv(summary)
              downloadCsv(filename, csv)
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v === 'weekly' ? 'weekly' : 'daily')
            }}
          >
            <TabsList className="border-b-0">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="w-full sm:w-48">
            <FormField label={kind === 'daily' ? 'Date' : 'Any date in the week'} htmlFor="summary-date">
              <DatePicker id="summary-date" value={anchor} invalid={!valid} onChange={setAnchor} />
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" aria-label={kind === 'daily' ? 'Previous day' : 'Previous week'} disabled={!valid} onClick={() => setAnchor((a) => shiftAnchor(kind, a, -1))}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="secondary" aria-label={kind === 'daily' ? 'Next day' : 'Next week'} disabled={!valid} onClick={() => setAnchor((a) => shiftAnchor(kind, a, 1))}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {period ? (
            <p className="min-w-0 flex-1 text-sm font-medium text-ink">
              {describePeriod(kind, period.from, period.to)}
              {kind === 'weekly' ? <span className="font-normal text-muted"> · Monday to Sunday</span> : null}
            </p>
          ) : null}
        </div>
        {!valid ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            Enter a valid date.
          </p>
        ) : null}
      </Card>

      {!valid ? (
        <Card>
          <EmptyState title="Choose a valid date" description="Fix the date above to build the summary." />
        </Card>
      ) : query.isError && !summary ? (
        <Card>
          <ErrorState onRetry={() => void query.refetch()} />
        </Card>
      ) : !summary ? (
        <div role="status" aria-label="Loading summary" className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className={cn('space-y-4', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isPlaceholderData}>
          <Card>
            <CardHeader>
              <CardTitle>{summary.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">Period</dt>
                  <dd className="text-ink">{describePeriod(summary.kind, summary.range.from, summary.range.to)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Status</dt>
                  <dd className={summary.inProgress ? 'text-warning' : 'text-ink'}>{summary.inProgress ? 'In progress, not final' : 'Complete'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Generated</dt>
                  <dd className="text-ink">
                    {formatFactoryDateTime(summary.meta.generatedAt)} by {summary.meta.generatedBy}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Basis</dt>
                  <dd className="text-ink">
                    {summary.approvedReportCount} approved {summary.approvedReportCount === 1 ? 'report' : 'reports'}
                  </dd>
                </div>
              </dl>
              {summary.excluded.awaitingReview + summary.excluded.returned + summary.excluded.draft > 0 ? (
                <p role="note" className="mt-4 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
                  Not counted in these figures: {summary.excluded.awaitingReview} awaiting review, {summary.excluded.returned} returned for correction, {summary.excluded.draft} draft.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <KpiGrid kpis={summary.kpis} />

          {summary.approvedReportCount === 0 && summary.kpis.downtimeEvents === 0 ? (
            <Card>
              <EmptyState title="Nothing to report for this period" description="There are no approved reports or downtime events in it. Sundays have no production." />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <LinePerformanceTable lines={summary.lines} totals={summary.kpis} />
                </div>
                <DowntimeSummary categories={summary.downtimeByCategory} totalMinutes={summary.kpis.downtimeMinutes} />
              </div>
              {summary.kind === 'weekly' && summary.daily.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Day by day</CardTitle>
                  </CardHeader>
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Date</Th>
                        <Th className="text-right">Produced</Th>
                        <Th className="text-right">Rejected</Th>
                        <Th className="text-right">Rejection rate</Th>
                        <Th className="text-right">Target achievement</Th>
                        <Th className="text-right">Downtime</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {summary.daily.map((d) => (
                        <Tr key={d.date}>
                          <Td>{formatDate(d.date, true)}</Td>
                          <Td className="text-right tabular-nums">{formatNumber(d.producedQuantity)}</Td>
                          <Td className="text-right tabular-nums">{formatNumber(d.rejectedQuantity)}</Td>
                          <Td className="text-right tabular-nums">{formatPercent(d.rejectionRate)}</Td>
                          <Td className="text-right tabular-nums">{formatPercent(d.targetAchievement)}</Td>
                          <Td className="text-right tabular-nums">{d.downtimeMinutes > 0 ? formatMinutes(d.downtimeMinutes) : NOT_APPLICABLE}</Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </Card>
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  )
}
