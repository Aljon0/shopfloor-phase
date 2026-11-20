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
import { canRecordDowntime } from '@/lib/permissions'
import { DowntimeForm } from './components/downtime-form'
import { useCreateDowntime, useDowntimeItem, useDowntimeReference, useUpdateDowntime } from './hooks/use-downtime'
import { isEventLocked } from './lib/downtime-rules'
import { DowntimeRuleError } from './services/downtime-service'
import type { DowntimeInput } from './types'

function messageFor(error: unknown): string {
  return error instanceof DowntimeRuleError ? error.message : 'The event could not be saved. Check the connection and try again.'
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
  const reference = useDowntimeReference()
  const create = useCreateDowntime()
  const [error, setError] = useState<string>()

  const save = async (input: DowntimeInput) => {
    setError(undefined)
    try {
      const event = await create.mutateAsync(input)
      navigate('/downtime', { replace: true, state: { notice: `${event.id} was recorded.` } })
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <>
      <PageHeader title="Record downtime" description="Log a machine stop. Duration is calculated from the start and end times." />
      {reference.isError ? (
        <Card>
          <ErrorState onRetry={() => void reference.refetch()} />
        </Card>
      ) : !reference.data ? (
        <FormSkeleton />
      ) : (
        <DowntimeForm reference={reference.data} submitting={create.isPending} submitError={error} onSave={(i) => void save(i)} onCancel={() => navigate('/downtime')} />
      )}
    </>
  )
}

function EditView({ eventId }: { eventId: string }) {
  const navigate = useNavigate()
  const item = useDowntimeItem(eventId)
  const reference = useDowntimeReference()
  const update = useUpdateDowntime(eventId)
  const [error, setError] = useState<string>()

  const save = async (input: DowntimeInput) => {
    setError(undefined)
    try {
      await update.mutateAsync(input)
      navigate('/downtime', { replace: true, state: { notice: `${eventId} was updated.` } })
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
        <PageHeader title={`Edit ${eventId}`} />
        <FormSkeleton />
      </>
    )
  }
  const back = (
    <Button asChild variant="secondary">
      <Link to="/downtime">Back to downtime</Link>
    </Button>
  )
  if (!item.data) {
    return (
      <>
        <PageHeader title="Event not found" />
        <Card>
          <EmptyState title={`${eventId} does not exist`} description="Check the event number, or go back to the list." action={back} />
        </Card>
      </>
    )
  }
  if (isEventLocked(item.data.reportStatus)) {
    return (
      <>
        <PageHeader title={`Edit ${eventId}`} />
        <Card>
          <EmptyState title="This event is locked" description="It belongs to an approved report, so it can no longer be edited." action={back} />
        </Card>
      </>
    )
  }
  return (
    <>
      <PageHeader title={`Edit ${eventId}`} />
      <DowntimeForm reference={reference.data} existing={item.data} submitting={update.isPending} submitError={error} onSave={(i) => void save(i)} onCancel={() => navigate('/downtime')} />
    </>
  )
}

/** Serves /downtime/new and /downtime/:eventId/edit. */
export function DowntimeFormPage() {
  const { user } = useAuth()
  const { eventId } = useParams<{ eventId: string }>()
  if (!canRecordDowntime(user?.role)) {
    return <RestrictedState description="Only operators and supervisors can record or edit downtime." />
  }
  return eventId ? <EditView eventId={eventId} /> : <CreateView />
}
