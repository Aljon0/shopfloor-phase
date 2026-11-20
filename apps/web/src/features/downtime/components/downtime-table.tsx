import { Lock, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatFactoryDateTime } from '@/lib/dates'
import { formatMinutes, NOT_APPLICABLE } from '@/lib/format'
import { DOWNTIME_CATEGORY_LABELS } from '@/lib/labels'
import { isEventLocked } from '../lib/downtime-rules'
import type { DowntimeListItem } from '../types'

export function DowntimeTable({ items, canEdit, canEditEvent }: { items: DowntimeListItem[]; canEdit: boolean; canEditEvent?: (event: DowntimeListItem['event']) => boolean }) {
  return (
    <Card>
      <Table>
        <THead>
          <Tr>
            <Th>Event</Th>
            <Th>Machine</Th>
            <Th>Line</Th>
            <Th>Order</Th>
            <Th>Start</Th>
            <Th>End</Th>
            <Th className="text-right">Duration</Th>
            <Th>Category</Th>
            <Th>Reason</Th>
            <Th>Recorded by</Th>
            {canEdit ? (
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            ) : null}
          </Tr>
        </THead>
        <TBody>
          {items.map(({ event, minutes, lineName, machineName, reportStatus }) => (
            <Tr key={event.id}>
              <Td className="font-medium">
                {event.reportId ? (
                  <Link to={`/production-reports/${event.reportId}`} className="text-primary hover:underline" title={`Report ${event.reportId}`}>
                    {event.id}
                  </Link>
                ) : (
                  event.id
                )}
              </Td>
              <Td>{machineName}</Td>
              <Td>{lineName}</Td>
              <Td>
                {event.orderId ? (
                  <Link to={`/production-orders/${event.orderId}`} className="text-primary hover:underline">
                    {event.orderId}
                  </Link>
                ) : (
                  NOT_APPLICABLE
                )}
              </Td>
              <Td>{formatFactoryDateTime(event.startTime)}</Td>
              <Td>{formatFactoryDateTime(event.endTime)}</Td>
              <Td className="text-right tabular-nums">{formatMinutes(minutes)}</Td>
              <Td>{DOWNTIME_CATEGORY_LABELS[event.category]}</Td>
              <Td className="max-w-64 truncate" title={event.notes}>
                {event.notes}
              </Td>
              <Td>{event.recordedBy}</Td>
              {canEdit ? (
                <Td>
                  {isEventLocked(reportStatus) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted" title="Linked to an approved report">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Locked
                    </span>
                  ) : canEditEvent && !canEditEvent(event) ? null : (
                    <Link
                      to={`/downtime/${event.id}/edit`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      aria-label={`Edit ${event.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Link>
                  )}
                </Td>
              ) : null}
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}
