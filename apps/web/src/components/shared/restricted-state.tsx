import { ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

interface RestrictedStateProps {
  title?: string
  description?: string
}

/** UI-level "not for your role" screen. Not security: the backend must enforce access. */
export function RestrictedState({
  title = 'Access restricted',
  description = 'Use the navigation to open a screen available to your role.',
}: RestrictedStateProps) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState icon={ShieldAlert} title="Your role does not use this screen" description={description} />
      </Card>
    </>
  )
}
