import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatMinutes, formatNumber, formatPercent, NOT_APPLICABLE } from '@/lib/format'
import { SHIFT_LABELS } from '@/lib/labels'
import type { ApprovalItem, ApprovalTab } from '../types'

const numeric = 'text-right tabular-nums'

export function ApprovalsTable({ items, tab }: { items: ApprovalItem[]; tab: ApprovalTab }) {
  const pending = tab === 'pending'
  return (
    <Card>
      <Table>
        <THead>
          <Tr>
            <Th>Report</Th>
            <Th>Date</Th>
            <Th>Line</Th>
            <Th>Shift</Th>
            <Th>Operator</Th>
            <Th className="text-right">Produced</Th>
            <Th className="text-right">Rejected</Th>
            <Th className="text-right">Rejection rate</Th>
            <Th className="text-right">Downtime</Th>
            {pending ? <Th>Submitted</Th> : <Th>Decided</Th>}
            <Th>Status</Th>
            {pending ? null : <Th>Reviewer</Th>}
            {pending ? null : <Th>Reason</Th>}
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {items.map(({ report, lineName, metrics, downtimeMinutes }) => (
            <Tr key={report.id}>
              <Td>
                <Link to={`/approvals/${report.id}`} className="font-medium text-primary hover:underline">
                  {report.id}
                </Link>
              </Td>
              <Td>{formatDate(report.reportDate)}</Td>
              <Td>{lineName}</Td>
              <Td>{SHIFT_LABELS[report.shift]}</Td>
              <Td>{report.operatorName}</Td>
              <Td className={numeric}>{formatNumber(report.producedQuantity)}</Td>
              <Td className={numeric}>{formatNumber(report.rejectedQuantity)}</Td>
              <Td className={numeric}>{formatPercent(metrics.rejectionRate)}</Td>
              <Td className={numeric}>{downtimeMinutes > 0 ? formatMinutes(downtimeMinutes) : NOT_APPLICABLE}</Td>
              <Td>
                {pending
                  ? report.submittedAt
                    ? formatFactoryDateTime(report.submittedAt)
                    : NOT_APPLICABLE
                  : report.reviewedAt
                    ? formatFactoryDateTime(report.reviewedAt)
                    : NOT_APPLICABLE}
              </Td>
              <Td>
                <StatusBadge status={report.status} />
              </Td>
              {pending ? null : <Td>{report.reviewedBy ?? NOT_APPLICABLE}</Td>}
              {pending ? null : (
                <Td className="max-w-56 truncate" title={report.returnReason}>
                  {report.status === 'returned' ? (report.returnReason ?? NOT_APPLICABLE) : NOT_APPLICABLE}
                </Td>
              )}
              <Td>
                <Link to={`/approvals/${report.id}`} className="text-primary hover:underline" aria-label={`${pending ? 'Review' : 'Open'} ${report.id}`}>
                  {pending ? 'Review' : 'Open'}
                </Link>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}
