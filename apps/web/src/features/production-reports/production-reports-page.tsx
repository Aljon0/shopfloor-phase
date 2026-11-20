import { FileText, Plus, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { canRecordReports } from '@/lib/permissions'
import { ReportFiltersBar } from './components/report-filters-bar'
import { ReportsTable } from './components/reports-table'
import { useReportItems, useReportReference } from './hooks/use-reports'
import {
  DEFAULT_REPORT_FILTERS,
  filterReports,
  hasActiveReportFilters,
  parseReportFilters,
  reportFiltersToParams,
  sortReports,
} from './lib/report-filters'
import type { ReportFilters } from './types'

export function ProductionReportsPage() {
  const { user } = useAuth()
  const canRecord = canRecordReports(user?.role)

  // Filters live in the URL so a filtered view can be bookmarked and survives going back.
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseReportFilters(params), [params])
  const setFilters = (next: ReportFilters) => setParams(reportFiltersToParams(next), { replace: true })

  const reports = useReportItems()
  const reference = useReportReference()

  const visible = useMemo(() => sortReports(filterReports(reports.data ?? [], filters)), [reports.data, filters])
  const total = reports.data?.length ?? 0

  const newReportButton = canRecord ? (
    <Button asChild>
      <Link to="/production-reports/new">
        <Plus className="h-4 w-4" aria-hidden="true" />
        New report
      </Link>
    </Button>
  ) : null

  return (
    <>
      <PageHeader
        title="Production Reports"
        description="Record shift output and rejected quantities, then submit for review."
        actions={newReportButton}
      />

      <ReportFiltersBar filters={filters} onChange={setFilters} lines={reference.data?.lines ?? []} />

      {reports.isError ? (
        <Card>
          <ErrorState onRetry={() => void reports.refetch()} />
        </Card>
      ) : reports.isPending ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading reports">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No production reports yet"
            description="Reports you file will appear here."
            action={newReportButton}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No reports match these filters"
            description="Try a different search or clear the filters."
            action={
              hasActiveReportFilters(filters) ? (
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_REPORT_FILTERS)}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted" aria-live="polite">
            Showing {visible.length} of {total} {total === 1 ? 'report' : 'reports'}
          </p>
          <ReportsTable items={visible} />
        </>
      )}
    </>
  )
}
