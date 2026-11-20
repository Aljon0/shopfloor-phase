import { Plus, SearchX, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { isApiMode } from '@/lib/config'
import { canRecordDowntime } from '@/lib/permissions'
import { DowntimeFiltersBar } from './components/downtime-filters-bar'
import { DowntimeSummaryCards } from './components/downtime-summary-cards'
import { DowntimeTable } from './components/downtime-table'
import { useDowntimeItems, useDowntimeReference } from './hooks/use-downtime'
import {
  DEFAULT_DOWNTIME_FILTERS,
  downtimeFiltersToParams,
  filterDowntime,
  hasActiveDowntimeFilters,
  parseDowntimeFilters,
  sortDowntime,
} from './lib/downtime-filters'
import { summarizeDowntime } from './lib/downtime-rules'
import type { DowntimeFilters } from './types'

export function DowntimePage() {
  const { user } = useAuth()
  const canRecord = canRecordDowntime(user?.role)
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseDowntimeFilters(params), [params])
  const setFilters = (next: DowntimeFilters) => setParams(downtimeFiltersToParams(next), { replace: true })

  const events = useDowntimeItems()
  const reference = useDowntimeReference()
  const visible = useMemo(() => sortDowntime(filterDowntime(events.data ?? [], filters)), [events.data, filters])
  const summary = useMemo(() => summarizeDowntime(visible), [visible])
  const total = events.data?.length ?? 0

  const recordButton = canRecord ? (
    <Button asChild>
      <Link to="/downtime/new">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Record downtime
      </Link>
    </Button>
  ) : null

  return (
    <>
      <PageHeader title="Downtime" description="Machine stops, how long they lasted and why." actions={recordButton} />

      {notice ? (
        <p role="status" className="mb-4 rounded-md border border-line bg-success-bg px-4 py-2.5 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <DowntimeFiltersBar filters={filters} onChange={setFilters} reference={reference.data} />

      {events.isError ? (
        <Card>
          <ErrorState onRetry={() => void events.refetch()} />
        </Card>
      ) : events.isPending ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading downtime events">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState icon={Timer} title="No downtime recorded" description="Machine stops you record will appear here." action={recordButton} />
        </Card>
      ) : (
        <>
          <DowntimeSummaryCards summary={summary} />
          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="No events match these filters"
                description="Try a different search or clear the filters."
                action={
                  hasActiveDowntimeFilters(filters) ? (
                    <Button variant="secondary" onClick={() => setFilters(DEFAULT_DOWNTIME_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted" aria-live="polite">
                Showing {visible.length} of {total} {total === 1 ? 'event' : 'events'}
              </p>
              <DowntimeTable
                items={visible}
                canEdit={canRecord}
                canEditEvent={(e) => !isApiMode || user?.role === 'supervisor' || e.recordedById === user?.id}
              />
            </>
          )}
        </>
      )}
    </>
  )
}
