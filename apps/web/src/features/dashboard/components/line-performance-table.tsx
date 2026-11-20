import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatMinutes, formatNumber, formatPercent } from '@/lib/format'
import type { DashboardKpis, LinePerformanceRow } from '../lib/aggregate'

interface LinePerformanceTableProps {
  lines: LinePerformanceRow[]
  totals: DashboardKpis
}

const numeric = 'text-right tabular-nums'

export function LinePerformanceTable({ lines, totals }: LinePerformanceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Production line performance</CardTitle>
      </CardHeader>
      <Table>
        <THead>
          <Tr>
            <Th>Line</Th>
            <Th className="text-right">Produced</Th>
            <Th className="text-right">Good</Th>
            <Th className="text-right">Rejected</Th>
            <Th className="text-right">Rejection rate</Th>
            <Th className="text-right">Planned</Th>
            <Th className="text-right">Target achievement</Th>
            <Th className="text-right">Downtime</Th>
          </Tr>
        </THead>
        <TBody>
          {lines.map((l) => (
            <Tr key={l.lineId}>
              <Td className="font-medium">{l.lineName}</Td>
              <Td className={numeric}>{formatNumber(l.producedQuantity)}</Td>
              <Td className={numeric}>{formatNumber(l.goodQuantity)}</Td>
              <Td className={numeric}>{formatNumber(l.rejectedQuantity)}</Td>
              <Td className={numeric}>{formatPercent(l.rejectionRate)}</Td>
              <Td className={numeric}>{formatNumber(l.plannedQuantity)}</Td>
              <Td className={numeric}>{formatPercent(l.targetAchievement)}</Td>
              <Td className={numeric}>{formatMinutes(l.downtimeMinutes)}</Td>
            </Tr>
          ))}
          <Tr className="bg-app font-semibold">
            <Td>All lines</Td>
            <Td className={numeric}>{formatNumber(totals.producedQuantity)}</Td>
            <Td className={numeric}>{formatNumber(totals.goodQuantity)}</Td>
            <Td className={numeric}>{formatNumber(totals.rejectedQuantity)}</Td>
            <Td className={numeric}>{formatPercent(totals.rejectionRate)}</Td>
            <Td className={numeric}>{formatNumber(totals.plannedQuantity)}</Td>
            <Td className={numeric}>{formatPercent(totals.targetAchievement)}</Td>
            <Td className={numeric}>{formatMinutes(totals.downtimeMinutes)}</Td>
          </Tr>
        </TBody>
      </Table>
    </Card>
  )
}
