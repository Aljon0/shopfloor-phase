import { CircleCheck, Send, Timer, Undo2, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatFactoryDateTime } from '@/lib/dates'
import type { ActivityItem, ActivityKind } from '@/types/domain'

const KIND_CONFIG: Record<ActivityKind, { icon: LucideIcon; verb: string }> = {
  report_submitted: { icon: Send, verb: 'submitted' },
  report_approved: { icon: CircleCheck, verb: 'approved' },
  report_returned: { icon: Undo2, verb: 'returned for correction:' },
  downtime_recorded: { icon: Timer, verb: 'recorded downtime' },
}

export function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const { icon: Icon, verb } = KIND_CONFIG[item.kind]
              return (
                <li key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-ink">
                      <span className="font-medium">{item.actor}</span> {verb} {item.subject}
                    </p>
                    {item.detail ? <p className="text-xs text-muted">{item.detail}</p> : null}
                  </div>
                  <time dateTime={item.timestamp} className="shrink-0 text-xs text-muted">
                    {formatFactoryDateTime(item.timestamp)}
                  </time>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
