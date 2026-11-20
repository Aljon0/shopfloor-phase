import { CalendarX, Download, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { DowntimeSummary } from '@/features/dashboard/components/downtime-summary'
import { ProductionChart } from '@/features/dashboard/components/production-chart'
import type { DateRange } from '@/features/dashboard/lib/aggregate'
import { resolveRange, type RangePreset } from '@/features/dashboard/lib/date-range'
import { cn } from '@/lib/cn'
import { downloadCsv } from '@/lib/csv'
import { addDays, formatFactoryTime } from '@/lib/dates'
import { formatMinutes, formatPercent } from '@/lib/format'
import { getFactoryToday } from '@/services/factory-clock'
import { BreakdownTable } from './components/breakdown-table'
import { TrendChart } from './components/trend-chart'
import { useAnalytics } from './hooks/use-analytics'
import type { Dimension } from './lib/analytics'
import { DIMENSION_LABELS, buildBreakdownCsv, buildTrendCsv } from './lib/analytics-export'

type Section = 'trends' | Dimension
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'trends', label: 'Trends' },
  { value: 'line', label: 'By line' },
  { value: 'product', label: 'By product' },
  { value: 'machine', label: 'By machine' },
  { value: 'shift', label: 'By shift' },
]

export function AnalyticsPage() {
  const today = getFactoryToday()
  const [preset, setPreset] = useState<RangePreset>('last14')
  const [custom, setCustom] = useState<DateRange>({ from: addDays(today, -13), to: today })
  const [section, setSection] = useState<Section>('trends')

  const { range, error } = useMemo(() => resolveRange(preset, today, custom), [preset, today, custom])
  const query = useAnalytics(range)
  const data = query.data
  const updatedAt = query.dataUpdatedAt > 0 ? formatFactoryTime(query.dataUpdatedAt) : undefined

  const exportCurrent = () => {
    if (!data) return
    const { filename, csv } = section === 'trends' ? buildTrendCsv(data) : buildBreakdownCsv(data, section)
    downloadCsv(filename, csv)
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Production, rejection and downtime trends by line, product, machine and shift."
        actions={
          <>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={!range || query.isFetching}>
              <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />
              {query.isFetching ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button variant="secondary" onClick={exportCurrent} disabled={!data}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </>
        }
      />

      <DashboardFilters
        preset={preset}
        onPresetChange={(next) => {
          if (next === 'custom' && range) setCustom(range)
          setPreset(next)
        }}
        custom={custom}
        onCustomChange={setCustom}
        range={range}
        error={error}
        updatedAt={updatedAt}
      />

      {range === null ? (
        <Card>
          <EmptyState icon={CalendarX} title="Choose a valid date range" description="Fix the dates above to load analytics." />
        </Card>
      ) : query.isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void query.refetch()} />
        </Card>
      ) : !data ? (
        <div className="space-y-3" role="status" aria-label="Loading analytics">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
          <TabsList>
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className={cn(query.isPlaceholderData && 'opacity-60')} aria-busy={query.isPlaceholderData}>
            <TabsContent value="trends" className="space-y-4">
              <ProductionChart daily={data.daily} />
              <div className="grid gap-4 lg:grid-cols-2">
                <TrendChart
                  title="Rejection rate"
                  subtitle="Rejected units as a share of produced units, per day"
                  daily={data.daily}
                  valueKey="rejectionRate"
                  kind="line"
                  color="#C2410C"
                  format={(v) => formatPercent(v)}
                  valueLabel="Rejection rate"
                  emptyHint="No approved reports in the selected period."
                />
                <TrendChart
                  title="Downtime"
                  subtitle="Minutes of recorded downtime per day"
                  daily={data.daily}
                  valueKey="downtimeMinutes"
                  kind="bar"
                  color="#64748B"
                  format={(v) => (v === null ? '—' : formatMinutes(v))}
                  valueLabel="Downtime"
                  emptyHint="No reports or downtime in the selected period."
                />
              </div>
              <DowntimeSummary categories={data.downtimeByCategory} totalMinutes={data.totals.downtimeMinutes} />
            </TabsContent>
            {(['line', 'product', 'machine', 'shift'] as const).map((d) => (
              <TabsContent key={d} value={d} className="space-y-2">
                <BreakdownTable dimension={d} rows={data.breakdowns[d]} />
                <p className="text-xs text-muted">
                  {d === 'product' || d === 'shift'
                    ? `Downtime is recorded per machine, so it is not shown by ${DIMENSION_LABELS[d].toLowerCase()}. `
                    : ''}
                  Based on {data.approvedReportCount} approved {data.approvedReportCount === 1 ? 'report' : 'reports'}. Reports awaiting approval are not counted.
                </p>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
    </>
  )
}
