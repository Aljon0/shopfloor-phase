import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import { formatNumber, formatPercent, NOT_APPLICABLE } from '@/lib/format'
import type { InspectionItem } from '../types'

const numeric = 'text-right tabular-nums'

export function InspectionsTable({ items }: { items: InspectionItem[] }) {
  return (
    <Card>
      <Table>
        <THead>
          <Tr>
            <Th>Inspection</Th>
            <Th>Date</Th>
            <Th>Order</Th>
            <Th>Report</Th>
            <Th>Product</Th>
            <Th className="text-right">Inspected</Th>
            <Th className="text-right">Passed</Th>
            <Th className="text-right">Failed</Th>
            <Th className="text-right">Pass rate</Th>
            <Th>Defect</Th>
            <Th>Inspector</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map(({ inspection, productName, defectName, passRate }) => (
            <Tr key={inspection.id}>
              <Td>
                <Link to={`/quality/${inspection.id}`} className="font-medium text-primary hover:underline">
                  {inspection.id}
                </Link>
              </Td>
              <Td>{formatDate(inspection.inspectionDate)}</Td>
              <Td>
                <Link to={`/production-orders/${inspection.orderId}`} className="text-primary hover:underline">
                  {inspection.orderId}
                </Link>
              </Td>
              <Td>
                {inspection.reportId ? (
                  <Link to={`/production-reports/${inspection.reportId}`} className="text-primary hover:underline">
                    {inspection.reportId}
                  </Link>
                ) : (
                  NOT_APPLICABLE
                )}
              </Td>
              <Td>{productName}</Td>
              <Td className={numeric}>{formatNumber(inspection.inspectedQuantity)}</Td>
              <Td className={numeric}>{formatNumber(inspection.passedQuantity)}</Td>
              <Td className={numeric}>{formatNumber(inspection.failedQuantity)}</Td>
              <Td className={numeric}>{formatPercent(passRate)}</Td>
              <Td>{defectName ?? NOT_APPLICABLE}</Td>
              <Td>{inspection.inspector}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}
