/**
 * Explainable trends and anomaly flags (Phase 10). Pure functions, no AI, no I/O.
 *
 * Every trend and every flag carries the rule that produced it and the numbers behind it, so a reader can
 * see WHY it appeared. Official figures come from the dashboard builder; this only compares two periods of
 * those figures and applies the fixed thresholds below. The optional AI summary may only restate these
 * facts (see buildNarrativeFacts and findUnverifiedNumbers); it never calculates anything.
 *
 * Definitions:
 * - "Previous period" is the same number of days immediately before the selected range.
 * - Figures count APPROVED reports only (same as the dashboard).
 * - Not enough data (fewer than MIN_APPROVED_REPORTS approved reports in a period, or a line with fewer than
 *   MIN_LINE_UNITS units) gives "unknown" / no flag instead of a guess.
 */
import { addDays, eachDate } from './dates'
import type { DashboardData, DateRange } from './read-models'

export const INSIGHT_THRESHOLDS = {
  /** Approved reports needed in a period before it is compared at all. */
  MIN_APPROVED_REPORTS: 3,
  /** Units a line must have produced in the range before its rates are judged. */
  MIN_LINE_UNITS: 100,
  /** Rejection rate at or above these (percent, as on the dashboard) raises a warning / critical flag. */
  REJECTION_WARN: 5,
  REJECTION_CRITICAL: 10,
  /** Target achievement below these raises a warning / critical flag. */
  TARGET_WARN: 80,
  TARGET_CRITICAL: 60,
  /** A downtime category spikes when it is at least this many times the previous period AND at least MIN minutes. */
  DOWNTIME_SPIKE_RATIO: 1.5,
  DOWNTIME_SPIKE_CRITICAL_RATIO: 2,
  DOWNTIME_SPIKE_MIN_MINUTES: 60,
  /** With no previous downtime in the category, this many minutes counts as new and notable. */
  DOWNTIME_NEW_MIN_MINUTES: 120,
  /** Reports waiting for review longer than these many hours. */
  REVIEW_WARN_HOURS: 24,
  REVIEW_CRITICAL_HOURS: 72,
  /** A trend within these bounds is called flat: percentage points for rates, relative change for amounts. */
  FLAT_RATE_POINTS: 1,
  FLAT_RELATIVE: 0.1,
} as const

export type TrendMetric = 'rejectionRate' | 'targetAchievement' | 'downtimeMinutes' | 'goodOutput'
export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown'
export type TrendAssessment = 'better' | 'worse' | 'neutral' | 'unknown'

export interface Trend {
  metric: TrendMetric
  label: string
  /** Display strings, already formatted (for example "4.0%" or "45 min"). null when there is no value. */
  current: string | null
  previous: string | null
  /** For example "up 1.5 percentage points" or "down 12%". Empty when unknown. */
  change: string
  direction: TrendDirection
  assessment: TrendAssessment
  /** One plain sentence: what was compared and why the label was chosen. */
  explanation: string
}

export type FlagRule = 'high_rejection' | 'low_target' | 'downtime_spike' | 'review_backlog'
export type FlagSeverity = 'warning' | 'critical'

export interface InsightFlag {
  id: string
  rule: FlagRule
  severity: FlagSeverity
  title: string
  /** The line, downtime category or queue the flag is about. */
  subject: string
  evidence: { label: string; value: string }[]
  /** The rule and threshold in words, so the flag is explainable. */
  why: string
}

export interface Insights {
  range: DateRange
  previousRange: DateRange
  /** True when there was enough approved data in the selected range to judge it. */
  hasEnoughData: boolean
  trends: Trend[]
  flags: InsightFlag[]
}

/** Rates are percentages already (10 means 10%), the same as everywhere else in the app. */
const pct = (v: number): string => `${v.toFixed(1)}%`
const mins = (v: number): string => `${v} min`
const units = (v: number): string => String(v)

/** The same number of days directly before `range`. */
export function previousRange(range: DateRange): DateRange {
  const days = eachDate(range.from, range.to).length
  const to = addDays(range.from, -1)
  return { from: addDays(to, -(days - 1)), to }
}

function rateTrend(metric: 'rejectionRate' | 'targetAchievement', label: string, cur: number | null, prev: number | null, goodWhenUp: boolean, enough: boolean): Trend {
  const T = INSIGHT_THRESHOLDS
  if (!enough || cur === null || prev === null) {
    return { metric, label, current: cur === null ? null : pct(cur), previous: prev === null ? null : pct(prev), change: '', direction: 'unknown', assessment: 'unknown', explanation: `Not enough approved reports in one of the two periods to compare ${label.toLowerCase()}.` }
  }
  const delta = cur - prev
  const direction: TrendDirection = Math.abs(delta) <= T.FLAT_RATE_POINTS ? 'flat' : delta > 0 ? 'up' : 'down'
  const assessment: TrendAssessment = direction === 'flat' ? 'neutral' : (direction === 'up') === goodWhenUp ? 'better' : 'worse'
  const change = direction === 'flat' ? 'about the same' : `${direction} ${Math.abs(delta).toFixed(1)} percentage points`
  return {
    metric, label, current: pct(cur), previous: pct(prev), change, direction, assessment,
    explanation: `${label} was ${pct(cur)} against ${pct(prev)} in the previous period. A change of 1 percentage point or less counts as flat.`,
  }
}

function amountTrend(metric: 'downtimeMinutes' | 'goodOutput', label: string, cur: number, prev: number, fmt: (v: number) => string, goodWhenUp: boolean, enough: boolean): Trend {
  const T = INSIGHT_THRESHOLDS
  if (!enough) {
    return { metric, label, current: fmt(cur), previous: fmt(prev), change: '', direction: 'unknown', assessment: 'unknown', explanation: `Not enough approved reports in one of the two periods to compare ${label.toLowerCase()}.` }
  }
  if (prev === 0 && cur === 0) {
    return { metric, label, current: fmt(cur), previous: fmt(prev), change: 'about the same', direction: 'flat', assessment: 'neutral', explanation: `${label} was zero in both periods.` }
  }
  const rel = prev === 0 ? Infinity : (cur - prev) / prev
  const direction: TrendDirection = Math.abs(rel) <= T.FLAT_RELATIVE ? 'flat' : rel > 0 ? 'up' : 'down'
  const assessment: TrendAssessment = direction === 'flat' ? 'neutral' : (direction === 'up') === goodWhenUp ? 'better' : 'worse'
  const change = direction === 'flat' ? 'about the same' : prev === 0 ? `up from none` : `${direction} ${Math.abs(rel * 100).toFixed(0)}%`
  return {
    metric, label, current: fmt(cur), previous: fmt(prev), change, direction, assessment,
    explanation: `${label} was ${fmt(cur)} against ${fmt(prev)} in the previous period. A change of 10% or less counts as flat.`,
  }
}

export function buildInsights(current: DashboardData, previous: DashboardData, now: string): Insights {
  const T = INSIGHT_THRESHOLDS
  const enough = current.approvedReportCount >= T.MIN_APPROVED_REPORTS && previous.approvedReportCount >= T.MIN_APPROVED_REPORTS
  const hasEnoughData = current.approvedReportCount >= T.MIN_APPROVED_REPORTS

  const trends: Trend[] = [
    rateTrend('rejectionRate', 'Rejection rate', current.kpis.rejectionRate, previous.kpis.rejectionRate, false, enough),
    rateTrend('targetAchievement', 'Target achievement', current.kpis.targetAchievement, previous.kpis.targetAchievement, true, enough),
    amountTrend('goodOutput', 'Good output', current.kpis.goodQuantity, previous.kpis.goodQuantity, units, true, enough),
    // Downtime is recorded independently of reports, so it is compared whenever the ranges themselves are valid.
    amountTrend('downtimeMinutes', 'Total downtime', current.kpis.downtimeMinutes, previous.kpis.downtimeMinutes, mins, false, true),
  ]

  const flags: InsightFlag[] = []

  for (const line of current.lines) {
    if (line.producedQuantity < T.MIN_LINE_UNITS) continue
    if (line.rejectionRate !== null && line.rejectionRate >= T.REJECTION_WARN) {
      const critical = line.rejectionRate >= T.REJECTION_CRITICAL
      flags.push({
        id: `high_rejection:${line.lineId}`, rule: 'high_rejection', severity: critical ? 'critical' : 'warning',
        title: `High rejection rate on ${line.lineName}`, subject: line.lineName,
        evidence: [
          { label: 'Rejection rate', value: pct(line.rejectionRate) },
          { label: 'Rejected of produced', value: `${line.rejectedQuantity} of ${line.producedQuantity}` },
        ],
        why: `Raised because the line's rejection rate is at or above ${pct(T.REJECTION_WARN)} (critical at ${pct(T.REJECTION_CRITICAL)}), with at least ${T.MIN_LINE_UNITS} units produced.`,
      })
    }
    if (line.targetAchievement !== null && line.targetAchievement < T.TARGET_WARN) {
      const critical = line.targetAchievement < T.TARGET_CRITICAL
      flags.push({
        id: `low_target:${line.lineId}`, rule: 'low_target', severity: critical ? 'critical' : 'warning',
        title: `Low target achievement on ${line.lineName}`, subject: line.lineName,
        evidence: [
          { label: 'Target achievement', value: pct(line.targetAchievement) },
          { label: 'Good of planned', value: `${line.goodQuantity} of ${line.plannedQuantity}` },
        ],
        why: `Raised because good output is below ${pct(T.TARGET_WARN)} of the planned quantity (critical below ${pct(T.TARGET_CRITICAL)}), with at least ${T.MIN_LINE_UNITS} units produced.`,
      })
    }
  }

  const prevByCategory = new Map(previous.downtimeByCategory.map((c) => [c.category, c.minutes]))
  for (const cat of current.downtimeByCategory) {
    const before = prevByCategory.get(cat.category) ?? 0
    const isNew = before === 0 && cat.minutes >= T.DOWNTIME_NEW_MIN_MINUTES
    const isSpike = before > 0 && cat.minutes >= T.DOWNTIME_SPIKE_MIN_MINUTES && cat.minutes >= before * T.DOWNTIME_SPIKE_RATIO
    if (!isNew && !isSpike) continue
    const critical = before > 0 && cat.minutes >= before * T.DOWNTIME_SPIKE_CRITICAL_RATIO
    flags.push({
      id: `downtime_spike:${cat.category}`, rule: 'downtime_spike', severity: critical ? 'critical' : 'warning',
      title: `${cat.label} downtime increased`, subject: cat.label,
      evidence: [
        { label: 'This period', value: mins(cat.minutes) },
        { label: 'Previous period', value: mins(before) },
        { label: 'Events', value: String(cat.events) },
      ],
      why: `Raised because this category reached at least ${T.DOWNTIME_SPIKE_MIN_MINUTES} minutes and at least ${T.DOWNTIME_SPIKE_RATIO} times the previous period (or ${T.DOWNTIME_NEW_MIN_MINUTES} minutes when there was none). Critical at ${T.DOWNTIME_SPIKE_CRITICAL_RATIO} times.`,
    })
  }

  const nowMs = Date.parse(now)
  const ageHours = current.pendingApprovals
    .map((r) => (r.submittedAt ? (nowMs - Date.parse(r.submittedAt)) / 3_600_000 : 0))
    .filter((h) => h >= T.REVIEW_WARN_HOURS)
  if (ageHours.length > 0) {
    const oldest = Math.floor(Math.max(...ageHours))
    flags.push({
      id: 'review_backlog:queue', rule: 'review_backlog', severity: oldest >= T.REVIEW_CRITICAL_HOURS ? 'critical' : 'warning',
      title: 'Reports waiting a long time for review', subject: 'Approval queue',
      evidence: [
        { label: 'Reports waiting over 24 hours', value: String(ageHours.length) },
        { label: 'Longest wait', value: `${oldest} hours` },
      ],
      why: `Raised because at least one submitted report has waited ${T.REVIEW_WARN_HOURS} hours or more for review (critical at ${T.REVIEW_CRITICAL_HOURS}). This counts the whole queue, whatever the selected dates.`,
    })
  }

  const order = { critical: 0, warning: 1 } as const
  flags.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id))
  return { range: current.range, previousRange: previous.range, hasEnoughData, trends, flags }
}

// ------------------------------------------------------------------ AI narrative guard

/** The only facts the AI is given: display strings and text, no raw calculations to redo. */
export interface NarrativeFacts {
  period: string
  previousPeriod: string
  approvedReports: number
  hasEnoughData: boolean
  figures: Record<string, string>
  trends: { metric: string; current: string | null; previous: string | null; change: string; assessment: string }[]
  flags: { severity: string; title: string; detail: string }[]
}

export function buildNarrativeFacts(insights: Insights, data: DashboardData): NarrativeFacts {
  const k = data.kpis
  const figures: Record<string, string> = {
    'Total produced': units(k.producedQuantity),
    'Good output': units(k.goodQuantity),
    'Rejected': units(k.rejectedQuantity),
    'Planned': units(k.plannedQuantity),
    'Rejection rate': k.rejectionRate === null ? 'not available' : pct(k.rejectionRate),
    'Target achievement': k.targetAchievement === null ? 'not available' : pct(k.targetAchievement),
    'Total downtime': mins(k.downtimeMinutes),
    'Downtime events': String(k.downtimeEvents),
    'Reports pending approval': String(k.pendingApprovals),
  }
  return {
    period: `${insights.range.from} to ${insights.range.to}`,
    previousPeriod: `${insights.previousRange.from} to ${insights.previousRange.to}`,
    approvedReports: data.approvedReportCount,
    hasEnoughData: insights.hasEnoughData,
    figures,
    trends: insights.trends.map((t) => ({ metric: t.label, current: t.current, previous: t.previous, change: t.change, assessment: t.assessment })),
    flags: insights.flags.map((f) => ({ severity: f.severity, title: f.title, detail: f.evidence.map((e) => `${e.label}: ${e.value}`).join('; ') })),
  }
}

const NUMBER = /\d+(?:[.,]\d+)*/g
const numbersIn = (text: string): number[] => (text.match(NUMBER) ?? []).map((n) => Number(n.replace(/,/g, ''))).filter((n) => Number.isFinite(n))

/**
 * Returns every number in `text` that does not appear in `facts`. An empty list means the text introduced
 * no figure of its own. List markers at the start of a line ("1.") are ignored.
 */
export function findUnverifiedNumbers(text: string, facts: unknown): string[] {
  const allowed = new Set(numbersIn(JSON.stringify(facts)))
  const cleaned = text.replace(/^\s*\d+[.)]\s+/gm, '')
  const bad = new Set<string>()
  for (const token of cleaned.match(NUMBER) ?? []) {
    if (!allowed.has(Number(token.replace(/,/g, '')))) bad.add(token)
  }
  return [...bad]
}
