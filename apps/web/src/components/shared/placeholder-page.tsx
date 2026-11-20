import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

interface PlaceholderPageProps {
  title: string
  description: string
  phase: string
}

/** Temporary page body used until the owning phase implements the real screen. */
export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={Construction}
          title="Not built yet"
          description={`This screen is planned for ${phase} of the blueprint.`}
        />
      </Card>
    </>
  )
}
