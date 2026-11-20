import { CalendarX, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { addDays, formatFactoryTime } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { DashboardFilters } from './components/dashboard-filters'
import { DashboardSkeleton } from './components/dashboard-skeleton'
import { DowntimeSummary } from './components/downtime-summary'
import { ExportMenu } from './components/export-menu'
import { KpiGrid } from './components/kpi-grid'
import { LinePerformanceTable } from './components/line-performance-table'
import { PendingApprovalsCard } from './components/pending-approvals-card'
import { ProductionChart } from './components/production-chart'
import { RecentActivityCard } from './components/recent-activity-card'
import { InsightsCard } from '@/features/insights/components/insights-card'
import { useDashboard } from './hooks/use-dashboard'
import type { DateRange } from './lib/aggregate'
import { resolveRange, type RangePreset } from './lib/date-range'
import { getFactoryToday } from '@/services/factory-clock'

export function DashboardPage() {
  const { user } = useAuth()
  const today = getFactoryToday()

  const [preset, setPreset] = useState<RangePreset>('last7')
  const [custom, setCustom] = useState<DateRange>({ from: addDays(today, -6), to: today })

  const { range, error } = useMemo(() => resolveRange(preset, today, custom), [preset, today, custom])
  const query = useDashboard(range)
  const data = query.data

  const handlePresetChange = (next: RangePreset) => {
    // Start the custom range from the period currently on screen.
    if (next === 'custom' && range) setCustom(range)
    setPreset(next)
  }

  const updatedAt = query.dataUpdatedAt > 0 ? formatFactoryTime(query.dataUpdatedAt) : undefined

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Production KPIs, output against target, downtime and pending approvals."
        actions={
          <>
            <Button variant="secondary" onClick={() => void query.refetch()} disabled={!range || query.isFetching}>
              <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />
              {query.isFetching ? 'Refreshing' : 'Refresh'}
            </Button>
            <ExportMenu data={data} />
          </>
        }
      />

      <DashboardFilters
        preset={preset}
        onPresetChange={handlePresetChange}
        custom={custom}
        onCustomChange={setCustom}
        range={range}
        error={error}
        updatedAt={updatedAt}
      />

      {range === null ? (
        <Card>
          <EmptyState
            icon={CalendarX}
            title="Choose a valid date range"
            description="Fix the dates above to load the dashboard."
          />
        </Card>
      ) : query.isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void query.refetch()} />
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn('space-y-4', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isPlaceholderData}>
          <KpiGrid kpis={data.kpis} />
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ProductionChart daily={data.daily} />
            </div>
            <PendingApprovalsCard reports={data.pendingApprovals} canReview={user?.role === 'supervisor'} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <LinePerformanceTable lines={data.lines} totals={data.kpis} />
            </div>
            <DowntimeSummary categories={data.downtimeByCategory} totalMinutes={data.kpis.downtimeMinutes} />
          </div>
          {user?.role === 'manager' || user?.role === 'supervisor' ? <InsightsCard range={data.range} /> : null}
          <RecentActivityCard items={data.recentActivity} />
        </div>
      )}
    </>
  )
}
