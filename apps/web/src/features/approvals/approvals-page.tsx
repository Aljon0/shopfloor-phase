import { CheckCheck, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { ReportFiltersBar } from '@/features/production-reports/components/report-filters-bar'
import { useReportReference } from '@/features/production-reports/hooks/use-reports'
import {
  DEFAULT_REPORT_FILTERS,
  filterReports,
  hasActiveReportFilters,
  parseReportFilters,
  reportFiltersToParams,
} from '@/features/production-reports/lib/report-filters'
import type { ReportFilters } from '@/features/production-reports/types'
import { canReviewReports } from '@/lib/permissions'
import { RestrictedState } from '@/components/shared/restricted-state'
import { ApprovalsTable } from './components/approvals-table'
import { useApprovalItems } from './hooks/use-approvals'
import { sortDecided, sortQueue } from './lib/approval-rules'
import type { ApprovalTab } from './types'

const PENDING_STATUSES = [
  { value: 'pending_review' as const, label: 'Pending Review' },
  { value: 'revised' as const, label: 'Revised' },
]
const DECIDED_STATUSES = [
  { value: 'approved' as const, label: 'Approved' },
  { value: 'returned' as const, label: 'Returned for Correction' },
]

export function ApprovalsPage() {
  const { user } = useAuth()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [params, setParams] = useSearchParams()
  const tab: ApprovalTab = params.get('tab') === 'decided' ? 'decided' : 'pending'
  const filters = useMemo(() => parseReportFilters(params), [params])

  const update = (nextFilters: ReportFilters, nextTab: ApprovalTab) => {
    const next = reportFiltersToParams(nextFilters)
    if (nextTab === 'decided') next.set('tab', 'decided')
    setParams(next, { replace: true })
  }

  const approvals = useApprovalItems()
  const reference = useReportReference()

  const inTab = useMemo(() => {
    const wanted = tab === 'pending' ? new Set(['pending_review', 'revised']) : new Set(['approved', 'returned'])
    return (approvals.data ?? []).filter((i) => wanted.has(i.report.status))
  }, [approvals.data, tab])
  const visible = useMemo(() => {
    const filtered = filterReports(inTab, filters)
    return tab === 'pending' ? sortQueue(filtered) : sortDecided(filtered)
  }, [inTab, filters, tab])
  const pendingCount = useMemo(() => (approvals.data ?? []).filter((i) => i.report.status === 'pending_review' || i.report.status === 'revised').length, [approvals.data])

  if (!canReviewReports(user?.role)) {
    return <RestrictedState description="Only supervisors can review reports." />
  }

  return (
    <>
      <PageHeader title="Approvals" description="Review submitted reports, approve them or return them for correction." />

      {notice ? (
        <p role="status" className="mb-4 rounded-md border border-line bg-success-bg px-4 py-2.5 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => update(DEFAULT_REPORT_FILTERS, v === 'decided' ? 'decided' : 'pending')} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">Waiting for review{approvals.data ? ` (${pendingCount})` : ''}</TabsTrigger>
          <TabsTrigger value="decided">Decided</TabsTrigger>
        </TabsList>
      </Tabs>

      <ReportFiltersBar
        filters={filters}
        onChange={(f) => update(f, tab)}
        lines={reference.data?.lines ?? []}
        statuses={tab === 'pending' ? PENDING_STATUSES : DECIDED_STATUSES}
      />

      {approvals.isError ? (
        <Card>
          <ErrorState onRetry={() => void approvals.refetch()} />
        </Card>
      ) : approvals.isPending ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading reports">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      ) : inTab.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCheck}
            title={tab === 'pending' ? 'Nothing is waiting for review' : 'No decisions yet'}
            description={tab === 'pending' ? 'Reports operators submit will appear here.' : 'Approved and returned reports will appear here.'}
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
                <Button variant="secondary" onClick={() => update(DEFAULT_REPORT_FILTERS, tab)}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted" aria-live="polite">
            Showing {visible.length} of {inTab.length} {inTab.length === 1 ? 'report' : 'reports'}
          </p>
          <ApprovalsTable items={visible} tab={tab} />
        </>
      )}
    </>
  )
}
