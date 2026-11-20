import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatFactoryDateTime } from '@/lib/dates'
import { formatNumber, formatPercent } from '@/lib/format'
import { SHIFT_LABELS } from '@/lib/labels'
import type { ReportDetail } from '../types'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

export function ReportSummaryCard({ detail }: { detail: ReportDetail }) {
  const { report, productName, lineName, machineName } = detail
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Production order">
            <Link to={`/production-orders/${report.orderId}`} className="font-medium text-primary hover:underline">
              {report.orderId}
            </Link>
          </Field>
          <Field label="Product">{productName}</Field>
          <Field label="Production line">{lineName}</Field>
          <Field label="Machine">{machineName}</Field>
          <Field label="Shift">{SHIFT_LABELS[report.shift]}</Field>
          <Field label="Report date">{formatDate(report.reportDate, true)}</Field>
          <Field label="Operator">{report.operatorName}</Field>
          <Field label="Submitted">{report.submittedAt ? formatFactoryDateTime(report.submittedAt) : 'Not submitted'}</Field>
          {report.reviewedAt && report.reviewedBy ? (
            <Field label="Last reviewed">
              {report.reviewedBy}, {formatFactoryDateTime(report.reviewedAt)}
            </Field>
          ) : null}
          <Field label="Last updated">{formatFactoryDateTime(report.updatedAt)}</Field>
        </dl>
        <div>
          <p className="text-xs font-medium text-muted">Notes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
            {report.notes || <span className="text-muted">No notes.</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportMetricsCard({ detail }: { detail: ReportDetail }) {
  const { report, metrics } = detail
  const rows: [string, string][] = [
    ['Produced', formatNumber(report.producedQuantity)],
    ['Rejected', formatNumber(report.rejectedQuantity)],
    ['Good (produced − rejected)', formatNumber(metrics.goodQuantity)],
    ['Rejection rate', formatPercent(metrics.rejectionRate)],
    ['Shift target', formatNumber(report.shiftTarget)],
    ['Target achievement', formatPercent(metrics.targetAchievement)],
  ]
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Calculations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-semibold tabular-nums text-ink">{formatNumber(metrics.goodQuantity)}</p>
        <p className="text-xs text-muted">good units</p>
        <dl className="space-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          {report.status === 'approved'
            ? 'Counted in official figures.'
            : 'Not counted in official figures until a supervisor approves it.'}
        </p>
      </CardContent>
    </Card>
  )
}
