import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import type { DailyPoint } from '@/features/dashboard/lib/aggregate'

const AXIS_COLOR = '#64748B'
const GRID_COLOR = '#E2E8F0'

type NumericKey = 'rejectionRate' | 'downtimeMinutes' | 'targetAchievement'

interface TrendChartProps {
  title: string
  subtitle: string
  daily: DailyPoint[]
  valueKey: NumericKey
  kind: 'line' | 'bar'
  color: string
  /** Formats one value for the axis, tooltip and table, e.g. '4.2%'. */
  format: (value: number | null) => string
  valueLabel: string
  emptyHint: string
}

export function TrendChart({ title, subtitle, daily, valueKey, kind, color, format, valueLabel, emptyHint }: TrendChartProps) {
  const [showTable, setShowTable] = useState(false)
  const first = daily[0]
  const last = daily[daily.length - 1]
  const summary = first && last ? `${valueLabel} for each day from ${formatDate(first.date)} to ${formatDate(last.date)}.` : 'No data.'
  const data = daily.map((d) => ({ label: d.label, date: d.date, value: d[valueKey] }))

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        {daily.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
            {showTable ? 'Show chart' : 'Show data table'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {daily.length === 0 ? (
          <EmptyState title="No data in this period" description={emptyHint} />
        ) : showTable ? (
          <Table>
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th className="text-right">{valueLabel}</Th>
              </Tr>
            </THead>
            <TBody>
              {data.map((d) => (
                <Tr key={d.date}>
                  <Td>{formatDate(d.date, true)}</Td>
                  <Td className="text-right tabular-nums">{format(d.value)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <div role="img" aria-label={summary} className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {kind === 'bar' ? (
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID_COLOR }} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
                  <YAxis width={44} tickLine={false} axisLine={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
                  <ChartTooltip formatter={(v) => [format(typeof v === 'number' ? v : null), valueLabel]} cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
              ) : (
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID_COLOR }} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
                  <YAxis width={44} tickLine={false} axisLine={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }} tickFormatter={(v: number) => format(v)} />
                  <ChartTooltip formatter={(v) => [format(typeof v === 'number' ? v : null), valueLabel]} />
                  <Line dataKey="value" type="linear" stroke={color} strokeWidth={2} dot={{ r: 4, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
