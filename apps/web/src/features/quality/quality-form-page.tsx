import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { RestrictedState } from '@/components/shared/restricted-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { canManageInspections } from '@/lib/permissions'
import { InspectionForm } from './components/inspection-form'
import { useCreateInspection, useInspectionItem, useQualityReference, useUpdateInspection } from './hooks/use-quality'
import { QualityRuleError } from './services/quality-service'
import type { InspectionInput } from './types'

function messageFor(error: unknown): string {
  return error instanceof QualityRuleError ? error.message : 'The inspection could not be saved. Check the connection and try again.'
}

function FormSkeleton() {
  return (
    <Card className="space-y-4 p-5" role="status" aria-label="Loading form">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </Card>
  )
}

function CreateView() {
  const navigate = useNavigate()
  const reference = useQualityReference()
  const create = useCreateInspection()
  const [error, setError] = useState<string>()

  const handleSave = async (input: InspectionInput) => {
    setError(undefined)
    try {
      const saved = await create.mutateAsync(input)
      navigate(`/quality/${saved.id}`, { replace: true, state: { notice: `${saved.id} was recorded.` } })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <>
      <PageHeader title="New inspection" description="Record what was inspected and what failed." />
      {reference.isError ? (
        <Card>
          <ErrorState onRetry={() => void reference.refetch()} />
        </Card>
      ) : !reference.data ? (
        <FormSkeleton />
      ) : (
        <InspectionForm reference={reference.data} submitting={create.isPending} submitError={error} onSave={(i) => void handleSave(i)} onCancel={() => navigate('/quality')} />
      )}
    </>
  )
}

function EditView({ inspectionId }: { inspectionId: string }) {
  const navigate = useNavigate()
  const item = useInspectionItem(inspectionId)
  const reference = useQualityReference()
  const update = useUpdateInspection(inspectionId)
  const [error, setError] = useState<string>()
  const backTo = `/quality/${inspectionId}`

  const handleSave = async (input: InspectionInput) => {
    setError(undefined)
    try {
      await update.mutateAsync(input)
      navigate(backTo, { replace: true, state: { notice: `${inspectionId} was updated.` } })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  if (item.isError || reference.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void Promise.all([item.refetch(), reference.refetch()])} />
      </Card>
    )
  }
  if (item.isPending || !reference.data) {
    return (
      <>
        <PageHeader title={`Edit ${inspectionId}`} />
        <FormSkeleton />
      </>
    )
  }
  if (!item.data) {
    return (
      <>
        <PageHeader title="Inspection not found" />
        <Card>
          <EmptyState
            title={`${inspectionId} does not exist`}
            description="Check the inspection number, or go back to the list."
            action={
              <Button asChild variant="secondary">
                <Link to="/quality">Back to inspections</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }
  return (
    <>
      <PageHeader title={`Edit ${inspectionId}`} />
      <InspectionForm reference={reference.data} existing={item.data} submitting={update.isPending} submitError={error} onSave={(i) => void handleSave(i)} onCancel={() => navigate(backTo)} />
    </>
  )
}

/** Serves both /quality/new and /quality/:inspectionId/edit. */
export function QualityFormPage() {
  const { user } = useAuth()
  const { inspectionId } = useParams<{ inspectionId: string }>()
  if (!canManageInspections(user?.role)) {
    return <RestrictedState description="Only supervisors can record or edit inspections." />
  }
  return inspectionId ? <EditView inspectionId={inspectionId} /> : <CreateView />
}
