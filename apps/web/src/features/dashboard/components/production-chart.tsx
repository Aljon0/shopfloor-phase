import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import { formatNumber, formatPercent } from '@/lib/format'
import type { DailyPoint } from '../lib/aggregate'

// Validated pair (blue / orange): passes lightness, chroma, CVD and contrast checks.
const ACTUAL_COLOR = '#2563EB'
const PLANNED_COLOR = '#EB6834'
const AXIS_COLOR = '#64748B'
const GRID_COLOR = '#E2E8F0'

interface TooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: DailyPoint }>
}

function DayTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{formatDate(point.date, true)}</p>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-muted">
        <dt className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: ACTUAL_COLOR }} aria-hidden="true" />
          Good output
        </dt>
        <dd className="text-right font-medium tabular-nums text-ink">{formatNumber(point.goodQuantity)}</dd>
        <dt className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: PLANNED_COLOR }} aria-hidden="true" />
          Planned
        </dt>
        <dd className="text-right font-medium tabular-nums text-ink">{formatNumber(point.plannedQuantity)}</dd>
        <dt>Produced</dt>
        <dd className="text-right tabular-nums text-ink">{formatNumber(point.producedQuantity)}</dd>
        <dt>Rejected</dt>
        <dd className="text-right tabular-nums text-ink">{formatNumber(point.rejectedQuantity)}</dd>
        <dt>Target achievement</dt>
        <dd className="text-right tabular-nums text-ink">{formatPercent(point.targetAchievement)}</dd>
      </dl>
      {point.pendingReports > 0 ? (
        <p className="mt-1.5 border-t border-line pt-1.5 text-warning">
          {point.pendingReports} {point.pendingReports === 1 ? 'report' : 'reports'} awaiting approval, not counted
        </p>
      ) : null}
    </div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Chart legend">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACTUAL_COLOR }} aria-hidden="true" />
        Good output
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4" style={{ background: PLANNED_COLOR }} aria-hidden="true" />
        Planned
      </li>
    </ul>
  )
}

export function ProductionChart({ daily }: { daily: DailyPoint[] }) {
  const [showTable, setShowTable] = useState(false)
  const first = daily[0]
  const last = daily[daily.length - 1]
  const hasPartialDays = daily.some((d) => d.pendingReports > 0)
  const summary =
    first && last
      ? `Good output compared with planned output for each day from ${formatDate(first.date)} to ${formatDate(last.date)}.`
      : 'No production data.'

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Actual vs planned output</CardTitle>
          <p className="mt-0.5 text-xs text-muted">Good units per day against shift targets</p>
        </div>
        {daily.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
            {showTable ? 'Show chart' : 'Show data table'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {daily.length === 0 ? (
          <EmptyState title="No production data" description="No reports were filed in the selected period." />
        ) : showTable ? (
          <Table>
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th className="text-right">Planned</Th>
                <Th className="text-right">Produced</Th>
                <Th className="text-right">Rejected</Th>
                <Th className="text-right">Good</Th>
                <Th className="text-right">Target achievement</Th>
              </Tr>
            </THead>
            <TBody>
              {daily.map((d) => (
                <Tr key={d.date}>
                  <Td>{formatDate(d.date, true)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(d.plannedQuantity)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(d.producedQuantity)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(d.rejectedQuantity)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(d.goodQuantity)}</Td>
                  <Td className="text-right tabular-nums">{formatPercent(d.targetAchievement)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <>
            <Legend />
            <div role="img" aria-label={summary} className="mt-3 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: GRID_COLOR }}
                    tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                    tickFormatter={(v: number) => formatNumber(v)}
                  />
                  <ChartTooltip content={<DayTooltip />} cursor={{ fill: '#F1F5F9' }} />
                  <Bar
                    dataKey="goodQuantity"
                    name="Good output"
                    fill={ACTUAL_COLOR}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="plannedQuantity"
                    name="Planned"
                    type="linear"
                    stroke={PLANNED_COLOR}
                    strokeWidth={2}
                    dot={{ r: 4, fill: PLANNED_COLOR, stroke: '#FFFFFF', strokeWidth: 2 }}
                    activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {hasPartialDays ? (
          <p className="mt-3 text-xs text-muted">
            Days with reports awaiting approval show partial totals. Only approved reports are counted.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
