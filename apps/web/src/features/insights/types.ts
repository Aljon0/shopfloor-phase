export type { InsightFlag, Insights, Trend } from '@shopfloor/shared'
import type { Insights } from '@shopfloor/shared'

export interface InsightsResult extends Insights {
  /** Whether the server has an AI provider key. Trends and flags never depend on it. */
  aiConfigured: boolean
}

export type NarrativeResult =
  | { status: 'ok'; text: string; model: string; generatedAt: string; basedOn: { from: string; to: string }; notice: string }
  | { status: 'unavailable'; reason: 'not_configured' | 'unreachable' | 'error'; message: string }
  | { status: 'unverified'; message: string }
