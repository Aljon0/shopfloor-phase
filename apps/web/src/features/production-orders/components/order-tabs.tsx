import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatMinutes, formatNumber, formatPercent } from '@/lib/format'
import { DOWNTIME_CATEGORY_LABELS, SHIFT_LABELS } from '@/lib/labels'
import type { OrderDetail } from '../types'

const numeric = 'text-right tabular-nums'

function ReportsTable({ reports }: { reports: OrderDetail['reports'] }) {
  if (reports.length === 0) {
    return <EmptyState title="No production reports" description="Reports filed against this order will appear here." />
  }
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Report</Th>
          <Th>Date</Th>
          <Th>Shift</Th>
          <Th>Machine</Th>
          <Th>Operator</Th>
          <Th className="text-right">Produced</Th>
          <Th className="text-right">Rejected</Th>
          <Th className="text-right">Good</Th>
          <Th className="text-right">Rejection rate</Th>
          <Th>Status</Th>
        </Tr>
      </THead>
      <TBody>
        {reports.map((r) => (
          <Tr key={r.id}>
            <Td>
              <Link to={`/production-reports/${r.id}`} className="font-medium text-primary hover:underline">
                {r.id}
              </Link>
            </Td>
            <Td>{formatDate(r.reportDate)}</Td>
            <Td>{SHIFT_LABELS[r.shift]}</Td>
            <Td>{r.machineName}</Td>
            <Td>{r.operatorName}</Td>
            <Td className={numeric}>{formatNumber(r.producedQuantity)}</Td>
            <Td className={numeric}>{formatNumber(r.rejectedQuantity)}</Td>
            <Td className={numeric}>{formatNumber(r.goodQuantity)}</Td>
            <Td className={numeric}>{formatPercent(r.rejectionRate)}</Td>
            <Td>
              <StatusBadge status={r.status} />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  )
}

function DowntimeTable({ downtime }: { downtime: OrderDetail['downtime'] }) {
  if (downtime.length === 0) {
    return <EmptyState title="No downtime recorded" description="Downtime events linked to this order will appear here." />
  }
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Event</Th>
          <Th>Machine</Th>
          <Th>Start</Th>
          <Th>End</Th>
          <Th className="text-right">Duration</Th>
          <Th>Category</Th>
          <Th>Notes</Th>
          <Th>Recorded by</Th>
        </Tr>
      </THead>
      <TBody>
        {downtime.map((d) => (
          <Tr key={d.id}>
            <Td className="font-medium">{d.id}</Td>
            <Td>{d.machineName}</Td>
            <Td>{formatFactoryDateTime(d.startTime)}</Td>
            <Td>{formatFactoryDateTime(d.endTime)}</Td>
            <Td className={numeric}>{formatMinutes(d.minutes)}</Td>
            <Td>{DOWNTIME_CATEGORY_LABELS[d.category]}</Td>
            <Td className="max-w-64 truncate" title={d.notes}>
              {d.notes}
            </Td>
            <Td>{d.recordedBy}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  )
}

function ActivityList({ timeline }: { timeline: OrderDetail['timeline'] }) {
  if (timeline.length === 0) return <EmptyState title="No activity yet" />
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

export function OrderTabs({ detail }: { detail: OrderDetail }) {
  return (
    <Tabs defaultValue="reports">
      <TabsList>
        <TabsTrigger value="reports">Reports ({detail.reports.length})</TabsTrigger>
        <TabsTrigger value="downtime">Downtime ({detail.downtime.length})</TabsTrigger>
        <TabsTrigger value="activity">Activity ({detail.timeline.length})</TabsTrigger>
      </TabsList>
      <Card className="mt-3">
        <TabsContent value="reports" className="pt-0">
          <ReportsTable reports={detail.reports} />
        </TabsContent>
        <TabsContent value="downtime" className="pt-0">
          <DowntimeTable downtime={detail.downtime} />
        </TabsContent>
        <TabsContent value="activity" className="pt-0">
          <CardContent>
            <ActivityList timeline={detail.timeline} />
          </CardContent>
        </TabsContent>
      </Card>
    </Tabs>
  )
}
