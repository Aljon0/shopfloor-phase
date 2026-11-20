import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatNumber, formatPercent, NOT_APPLICABLE } from '@/lib/format'
import { SHIFT_LABELS } from '@/lib/labels'
import type { ReportListItem } from '../types'

const numeric = 'text-right tabular-nums'

export function ReportsTable({ items }: { items: ReportListItem[] }) {
  return (
    <Card>
      <Table>
        <THead>
          <Tr>
            <Th>Report</Th>
            <Th>Date</Th>
            <Th>Order</Th>
            <Th>Line</Th>
            <Th>Machine</Th>
            <Th>Shift</Th>
            <Th>Operator</Th>
            <Th className="text-right">Produced</Th>
            <Th className="text-right">Rejected</Th>
            <Th className="text-right">Rejection rate</Th>
            <Th>Submitted</Th>
            <Th>Status</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map(({ report, lineName, machineName, metrics }) => (
            <Tr key={report.id}>
              <Td>
                <Link to={`/production-reports/${report.id}`} className="font-medium text-primary hover:underline">
                  {report.id}
                </Link>
              </Td>
              <Td>{formatDate(report.reportDate)}</Td>
              <Td>
                <Link to={`/production-orders/${report.orderId}`} className="text-primary hover:underline">
                  {report.orderId}
                </Link>
              </Td>
              <Td>{lineName}</Td>
              <Td>{machineName}</Td>
              <Td>{SHIFT_LABELS[report.shift]}</Td>
              <Td>{report.operatorName}</Td>
              <Td className={numeric}>{formatNumber(report.producedQuantity)}</Td>
              <Td className={numeric}>{formatNumber(report.rejectedQuantity)}</Td>
              <Td className={numeric}>{formatPercent(metrics.rejectionRate)}</Td>
              <Td>{report.submittedAt ? formatFactoryDateTime(report.submittedAt) : NOT_APPLICABLE}</Td>
              <Td>
                <StatusBadge status={report.status} />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}
