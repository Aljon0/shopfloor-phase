import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatMinutes, formatNumber, NOT_APPLICABLE } from '@/lib/format'
import { DOWNTIME_CATEGORY_LABELS } from '@/lib/labels'
import type { ReportDetail } from '../types'

function DowntimeTable({ detail }: { detail: ReportDetail }) {
  if (detail.downtime.length === 0) {
    return <EmptyState title="No downtime recorded" description="Downtime events linked to this report will appear here." />
  }
  return (
    <>
      <Table>
        <THead>
          <Tr>
            <Th>Event</Th>
            <Th>Start</Th>
            <Th>End</Th>
            <Th className="text-right">Duration</Th>
            <Th>Category</Th>
            <Th>Notes</Th>
            <Th>Recorded by</Th>
          </Tr>
        </THead>
        <TBody>
          {detail.downtime.map((d) => (
            <Tr key={d.id}>
              <Td className="font-medium">{d.id}</Td>
              <Td>{formatFactoryDateTime(d.startTime)}</Td>
              <Td>{formatFactoryDateTime(d.endTime)}</Td>
              <Td className="text-right tabular-nums">{formatMinutes(d.minutes)}</Td>
              <Td>{DOWNTIME_CATEGORY_LABELS[d.category]}</Td>
              <Td className="max-w-64 truncate" title={d.notes}>
                {d.notes}
              </Td>
              <Td>{d.recordedBy}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <p className="border-t border-line px-3 py-2 text-sm text-muted">
        Total downtime: <span className="font-medium tabular-nums text-ink">{formatMinutes(detail.totalDowntimeMinutes)}</span>
      </p>
    </>
  )
}

function InspectionsTable({ detail }: { detail: ReportDetail }) {
  if (detail.inspections.length === 0) {
    return <EmptyState title="No inspections recorded" description="Quality inspections linked to this report will appear here." />
  }
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Inspection</Th>
          <Th>Date</Th>
          <Th className="text-right">Inspected</Th>
          <Th className="text-right">Passed</Th>
          <Th className="text-right">Failed</Th>
          <Th>Defect</Th>
          <Th>Inspector</Th>
        </Tr>
      </THead>
      <TBody>
        {detail.inspections.map((i) => (
          <Tr key={i.id}>
            <Td>
              <Link to={`/quality/${i.id}`} className="font-medium text-primary hover:underline">
                {i.id}
              </Link>
            </Td>
            <Td>{formatDate(i.inspectionDate)}</Td>
            <Td className="text-right tabular-nums">{formatNumber(i.inspectedQuantity)}</Td>
            <Td className="text-right tabular-nums">{formatNumber(i.passedQuantity)}</Td>
            <Td className="text-right tabular-nums">{formatNumber(i.failedQuantity)}</Td>
            <Td>{i.defectName ?? NOT_APPLICABLE}</Td>
            <Td>{i.inspector}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  )
}

function HistoryList({ timeline }: { timeline: ReportDetail['timeline'] }) {
  if (timeline.length === 0) return <EmptyState title="No history yet" />
  return (
    <ul className="divide-y divide-line">
      {timeline.map((t) => (
        <li key={t.id} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 text-sm">
            <p className="text-ink">
              <span className="font-medium">{t.actor}</span> {t.description}
            </p>
            {t.detail ? <p className="text-xs text-muted">{t.detail}</p> : null}
          </div>
          <time dateTime={t.timestamp} className="shrink-0 text-xs text-muted">
            {formatFactoryDateTime(t.timestamp)}
          </time>
        </li>
      ))}
    </ul>
  )
}

export function ReportTabs({ detail, defaultTab = 'history' }: { detail: ReportDetail; defaultTab?: 'history' | 'downtime' | 'inspections' }) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="history">History ({detail.timeline.length})</TabsTrigger>
        <TabsTrigger value="downtime">Downtime ({detail.downtime.length})</TabsTrigger>
        <TabsTrigger value="inspections">Inspections ({detail.inspections.length})</TabsTrigger>
      </TabsList>
      <Card className="mt-3">
        <TabsContent value="history" className="pt-0">
          <CardContent>
            <HistoryList timeline={detail.timeline} />
          </CardContent>
        </TabsContent>
        <TabsContent value="downtime" className="pt-0">
          <DowntimeTable detail={detail} />
        </TabsContent>
        <TabsContent value="inspections" className="pt-0">
          <InspectionsTable detail={detail} />
        </TabsContent>
      </Card>
    </Tabs>
  )
}
