import { ClipboardCheck, Plus, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { canManageInspections } from '@/lib/permissions'
import { InspectionsTable } from './components/inspections-table'
import { QualityFiltersBar } from './components/quality-filters-bar'
import { QualitySummaryCards } from './components/quality-summary-cards'
import { useInspectionItems, useQualityReference } from './hooks/use-quality'
import {
  DEFAULT_QUALITY_FILTERS,
  filterInspections,
  hasActiveQualityFilters,
  parseQualityFilters,
  qualityFiltersToParams,
  sortInspections,
} from './lib/quality-filters'
import { summarizeInspections } from './lib/quality-rules'
import type { QualityFilters } from './types'

export function QualityPage() {
  const { user } = useAuth()
  const canManage = canManageInspections(user?.role)
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseQualityFilters(params), [params])
  const setFilters = (next: QualityFilters) => setParams(qualityFiltersToParams(next), { replace: true })

  const inspections = useInspectionItems()
  const reference = useQualityReference()
  const visible = useMemo(() => sortInspections(filterInspections(inspections.data ?? [], filters)), [inspections.data, filters])
  const summary = useMemo(() => summarizeInspections(visible), [visible])
  const total = inspections.data?.length ?? 0

  const products = useMemo(() => {
    const seen = new Map<string, string>()
    for (const i of inspections.data ?? []) seen.set(i.inspection.productId, i.productName)
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [inspections.data])

  const newButton = canManage ? (
    <Button asChild>
      <Link to="/quality/new">
        <Plus className="h-4 w-4" aria-hidden="true" />
        New inspection
      </Link>
    </Button>
  ) : null

  return (
    <>
      <PageHeader
        title="Quality Control"
        description="Basic inspection records and defect classifications. Not a certified quality-management system."
        actions={newButton}
      />

      {notice ? (
        <p role="status" className="mb-4 rounded-md border border-line bg-success-bg px-4 py-2.5 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <QualityFiltersBar filters={filters} onChange={setFilters} products={products} defects={reference.data?.defects ?? []} />

      {inspections.isError ? (
        <Card>
          <ErrorState onRetry={() => void inspections.refetch()} />
        </Card>
      ) : inspections.isPending ? (
        <Card className="space-y-3 p-4" role="status" aria-label="Loading inspections">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck} title="No inspections yet" description="Inspections you record will appear here." action={newButton} />
        </Card>
      ) : (
        <>
          <QualitySummaryCards summary={summary} />
          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="No inspections match these filters"
                description="Try a different search or clear the filters."
                action={
                  hasActiveQualityFilters(filters) ? (
                    <Button variant="secondary" onClick={() => setFilters(DEFAULT_QUALITY_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted" aria-live="polite">
                Showing {visible.length} of {total} {total === 1 ? 'inspection' : 'inspections'}
              </p>
              <InspectionsTable items={visible} />
            </>
          )}
        </>
      )}
    </>
  )
}
