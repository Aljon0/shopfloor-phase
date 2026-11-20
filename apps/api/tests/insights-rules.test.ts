import { describe, expect, it } from 'vitest'
import {
  buildInsights,
  buildNarrativeFacts,
  findUnverifiedNumbers,
  previousRange,
  type DashboardData,
  type DowntimeCategoryRow,
  type LinePerformanceRow,
  type PendingReportRow,
} from '@shopfloor/shared'

const range = { from: '2026-11-09', to: '2026-11-15' }
const prevRange = { from: '2026-11-02', to: '2026-11-08' }

function line(over: Partial<LinePerformanceRow> = {}): LinePerformanceRow {
  return { lineId: 'l1', lineName: 'Cutting Line 01', producedQuantity: 1000, goodQuantity: 970, rejectedQuantity: 30, rejectionRate: 3, plannedQuantity: 1000, targetAchievement: 97, downtimeMinutes: 0, ...over }
}
function cat(over: Partial<DowntimeCategoryRow> = {}): DowntimeCategoryRow {
  return { category: 'changeover', label: 'Changeover', minutes: 30, events: 1, ...over }
}
function data(over: { range?: typeof range; reports?: number; lines?: LinePerformanceRow[]; cats?: DowntimeCategoryRow[]; pending?: PendingReportRow[]; rej?: number | null; tgt?: number | null; good?: number; down?: number } = {}): DashboardData {
  return {
    range: over.range ?? range,
    approvedReportCount: over.reports ?? 6,
    kpis: { producedQuantity: 1000, goodQuantity: over.good ?? 970, rejectedQuantity: 30, plannedQuantity: 1000, rejectionRate: over.rej === undefined ? 3 : over.rej, targetAchievement: over.tgt === undefined ? 97 : over.tgt, downtimeMinutes: over.down ?? 30, downtimeEvents: 1, pendingApprovals: over.pending?.length ?? 0 },
    daily: [],
    lines: over.lines ?? [line()],
    downtimeByCategory: over.cats ?? [cat()],
    pendingApprovals: over.pending ?? [],
    recentActivity: [],
  } as DashboardData
}
const now = '2026-11-15T10:00:00Z'

describe('previousRange', () => {
  it('is the same number of days directly before', () => {
    expect(previousRange(range)).toEqual(prevRange)
    expect(previousRange({ from: '2026-11-15', to: '2026-11-15' })).toEqual({ from: '2026-11-14', to: '2026-11-14' })
  })
})

describe('trends', () => {
  it('labels direction and whether it is better or worse', () => {
    const r = buildInsights(data({ rej: 6, tgt: 90, down: 100, good: 800 }), data({ range: prevRange, rej: 3, tgt: 95, down: 40, good: 1000 }), now)
    const by = Object.fromEntries(r.trends.map((t) => [t.metric, t]))
    expect(by.rejectionRate).toMatchObject({ direction: 'up', assessment: 'worse', change: 'up 3.0 percentage points', current: '6.0%', previous: '3.0%' })
    expect(by.targetAchievement).toMatchObject({ direction: 'down', assessment: 'worse' })
    expect(by.downtimeMinutes).toMatchObject({ direction: 'up', assessment: 'worse', change: 'up 150%' })
    expect(by.goodOutput).toMatchObject({ direction: 'down', assessment: 'worse', change: 'down 20%' })
  })
  it('small changes are flat', () => {
    const r = buildInsights(data({ rej: 3.5 }), data({ range: prevRange, rej: 3 }), now)
    expect(r.trends.find((t) => t.metric === 'rejectionRate')).toMatchObject({ direction: 'flat', assessment: 'neutral' })
  })
  it('is unknown, not guessed, when a period has too few approved reports', () => {
    const r = buildInsights(data(), data({ range: prevRange, reports: 1 }), now)
    for (const t of r.trends.filter((t) => t.metric !== 'downtimeMinutes')) expect(t.direction).toBe('unknown')
    expect(r.trends.find((t) => t.metric === 'downtimeMinutes')?.direction).not.toBe('unknown')
  })
  it('handles null rates', () => {
    const r = buildInsights(data({ rej: null }), data({ range: prevRange }), now)
    expect(r.trends.find((t) => t.metric === 'rejectionRate')?.direction).toBe('unknown')
  })
})

describe('flags', () => {
  it('flags a high rejection rate with its evidence, critical at 10%', () => {
    const warn = buildInsights(data({ lines: [line({ rejectionRate: 6, rejectedQuantity: 60 })] }), data({ range: prevRange }), now).flags
    expect(warn[0]).toMatchObject({ rule: 'high_rejection', severity: 'warning', subject: 'Cutting Line 01' })
    expect(warn[0]?.evidence).toContainEqual({ label: 'Rejection rate', value: '6.0%' })
    expect(warn[0]?.why).toContain('5.0%')
    const crit = buildInsights(data({ lines: [line({ rejectionRate: 10, rejectedQuantity: 100 })] }), data({ range: prevRange }), now).flags
    expect(crit[0]?.severity).toBe('critical')
  })
  it('flags low target achievement', () => {
    const f = buildInsights(data({ lines: [line({ targetAchievement: 70, goodQuantity: 700 })] }), data({ range: prevRange }), now).flags
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ rule: 'low_target', severity: 'warning' })
    expect(buildInsights(data({ lines: [line({ targetAchievement: 50 })] }), data({ range: prevRange }), now).flags[0]?.severity).toBe('critical')
  })
  it('does not judge a line with too little output', () => {
    const f = buildInsights(data({ lines: [line({ producedQuantity: 50, rejectionRate: 50, targetAchievement: 10 })] }), data({ range: prevRange }), now).flags
    expect(f).toEqual([])
  })
  it('flags a downtime spike against the previous period, and a notable new category', () => {
    const spike = buildInsights(data({ cats: [cat({ minutes: 120 })] }), data({ range: prevRange, cats: [cat({ minutes: 60 })] }), now).flags
    expect(spike[0]).toMatchObject({ rule: 'downtime_spike', severity: 'critical' })
    expect(buildInsights(data({ cats: [cat({ minutes: 100 })] }), data({ range: prevRange, cats: [cat({ minutes: 60 })] }), now).flags[0]?.severity).toBe('warning')
    expect(buildInsights(data({ cats: [cat({ minutes: 130 })] }), data({ range: prevRange, cats: [] }), now).flags).toHaveLength(1)
    expect(buildInsights(data({ cats: [cat({ minutes: 90 })] }), data({ range: prevRange, cats: [] }), now).flags).toHaveLength(0)
    expect(buildInsights(data({ cats: [cat({ minutes: 50 })] }), data({ range: prevRange, cats: [cat({ minutes: 10 })] }), now).flags).toHaveLength(0)
  })
  it('flags reports waiting too long for review', () => {
    const pending = (hoursAgo: number): PendingReportRow => ({ id: 'R', orderNumber: 'PO', productName: 'p', lineName: 'l', reportDate: '2026-11-14', operatorName: 'x', submittedAt: new Date(Date.parse(now) - hoursAgo * 3_600_000).toISOString(), producedQuantity: 1, goodQuantity: 1 })
    expect(buildInsights(data({ pending: [pending(5)] }), data({ range: prevRange }), now).flags).toEqual([])
    const warn = buildInsights(data({ pending: [pending(30), pending(5)] }), data({ range: prevRange }), now).flags
    expect(warn[0]).toMatchObject({ rule: 'review_backlog', severity: 'warning' })
    expect(warn[0]?.evidence).toContainEqual({ label: 'Reports waiting over 24 hours', value: '1' })
    expect(buildInsights(data({ pending: [pending(80)] }), data({ range: prevRange }), now).flags[0]?.severity).toBe('critical')
  })
  it('puts critical flags first, in a stable order', () => {
    const f = buildInsights(data({ lines: [line({ rejectionRate: 6 }), line({ lineId: 'l2', lineName: 'Bending Line 01', rejectionRate: 20 })] }), data({ range: prevRange }), now).flags
    expect(f.map((x) => x.severity)).toEqual(['critical', 'warning'])
  })
  it('says there is not enough data when the range has too few approved reports', () => {
    expect(buildInsights(data({ reports: 2 }), data({ range: prevRange }), now).hasEnoughData).toBe(false)
  })
})

describe('AI narrative guard', () => {
  const insights = buildInsights(data({ lines: [line({ rejectionRate: 6, rejectedQuantity: 60 })] }), data({ range: prevRange }), now)
  const facts = buildNarrativeFacts(insights, data())

  it('facts hold display strings and no personal names', () => {
    expect(facts.figures['Rejection rate']).toBe('3.0%')
    expect(JSON.stringify(facts)).not.toMatch(/operator/i)
  })
  it('accepts text that only repeats figures from the facts', () => {
    expect(findUnverifiedNumbers('Good output was 970 units and the rejection rate was 3.0%. The week ran 2026-11-09 to 2026-11-15.', facts)).toEqual([])
  })
  it('catches an invented figure', () => {
    expect(findUnverifiedNumbers('Rejections reached 7.5% and output was 970.', facts)).toEqual(['7.5'])
  })
  it('ignores list markers and handles thousands separators', () => {
    expect(findUnverifiedNumbers('1. Output fine\n2) Done', facts)).toEqual([])
    expect(findUnverifiedNumbers('Produced 1,000 units.', facts)).toEqual([])
  })
})
