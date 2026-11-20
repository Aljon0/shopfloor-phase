import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatMinutes, formatNumber, formatPercent, NOT_APPLICABLE } from '@/lib/format'
import type { BreakdownRow, Dimension } from '../lib/analytics'
import { DIMENSION_LABELS } from '../lib/analytics-export'

const num = 'text-right tabular-nums'

export function BreakdownTable({ dimension, rows }: { dimension: Dimension; rows: BreakdownRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState title="No data in this period" description="No approved reports or downtime events fall in the selected period." />
      </Card>
    )
  }
  const maxProduced = Math.max(...rows.map((r) => r.producedQuantity), 1)
  const hasGroup = rows.some((r) => r.group)
  return (
    <Card>
      <Table>
        <THead>
          <Tr>
            <Th>{DIMENSION_LABELS[dimension]}</Th>
            {hasGroup ? <Th>Line</Th> : null}
            <Th className="text-right">Reports</Th>
            <Th className="min-w-40">Produced</Th>
            <Th className="text-right">Rejected</Th>
            <Th className="text-right">Rejection rate</Th>
            <Th className="text-right">Target achievement</Th>
            <Th className="text-right">Downtime</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={r.key}>
              <Td className="font-medium text-ink">{r.label}</Td>
              {hasGroup ? <Td>{r.group ?? NOT_APPLICABLE}</Td> : null}
              <Td className={num}>{r.reports}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-neutral-bg" aria-hidden="true">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.producedQuantity / maxProduced) * 100}%` }} />
                  </div>
                  <span className="w-14 text-right tabular-nums">{formatNumber(r.producedQuantity)}</span>
                </div>
              </Td>
              <Td className={num}>{formatNumber(r.rejectedQuantity)}</Td>
              <Td className={num}>{formatPercent(r.rejectionRate)}</Td>
              <Td className={num}>{formatPercent(r.targetAchievement)}</Td>
              <Td className={num}>{r.downtimeMinutes === null ? NOT_APPLICABLE : r.downtimeMinutes > 0 ? formatMinutes(r.downtimeMinutes) : NOT_APPLICABLE}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}
