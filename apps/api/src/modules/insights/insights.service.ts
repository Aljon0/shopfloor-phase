import {
  buildInsights,
  buildNarrativeFacts,
  findUnverifiedNumbers,
  previousRange,
  type DateRange,
  type Insights,
} from '@shopfloor/shared'
import type { Db } from '../../db/client'
import type { NarrativeClient } from '../../middleware/context'
import { assertRange, dashboard } from '../read-models/read-models.service'
import { NarrativeError } from './narrative-client'

const MAX_TEXT = 1200

export const SYSTEM_PROMPT = [
  'You write a short plain-English operations summary for a manager at a metal fabrication factory.',
  'Use ONLY the facts in the JSON the user sends. Copy every figure exactly as written there.',
  'Do not calculate, add, round, convert, estimate or predict anything, and do not introduce any number that is not in the facts.',
  'Do not blame people and do not give orders. Mention the flags, if any, and say whether things look better or worse than the previous period.',
  'If hasEnoughData is false, say there is not enough approved data to draw conclusions.',
  'Write 3 to 5 sentences of plain text. No lists, no markdown, no headings.',
].join(' ')

export interface InsightsResponse extends Insights {
  /** Whether an AI provider key is set on the server. The trends and flags never depend on it. */
  aiConfigured: boolean
}

async function compute(db: Db, range: DateRange, now: string): Promise<Insights> {
  assertRange(range) // before previousRange(), which assumes valid dates
  const [current, previous] = await Promise.all([dashboard(db, range, false), dashboard(db, previousRange(range), false)])
  return buildInsights(current, previous, now)
}

export async function getInsights(db: Db, range: DateRange, aiConfigured: boolean, now = new Date().toISOString()): Promise<InsightsResponse> {
  return { ...(await compute(db, range, now)), aiConfigured }
}

export type NarrativeResult =
  | { status: 'ok'; text: string; model: string; generatedAt: string; basedOn: DateRange; notice: string }
  | { status: 'unavailable'; reason: 'not_configured' | 'unreachable' | 'error'; message: string }
  | { status: 'unverified'; message: string }

const NOTICE = 'Written by an AI from the verified figures above. The official numbers are the ones on the dashboard.'

/**
 * Always resolves: a missing, slow or failing AI service gives status "unavailable", never an error,
 * so nothing else in the app is affected. Text that contains a figure not present in the facts is withheld.
 */
export async function getNarrative(db: Db, client: NarrativeClient | null, model: string, range: DateRange, now = new Date().toISOString()): Promise<NarrativeResult> {
  assertRange(range)
  if (!client) return { status: 'unavailable', reason: 'not_configured', message: 'AI summaries are not set up on this server. The trends and flags above are unaffected.' }
  const [current, previous] = await Promise.all([dashboard(db, range, false), dashboard(db, previousRange(range), false)])
  const insights = buildInsights(current, previous, now)
  const facts = buildNarrativeFacts(insights, current)
  let text: string
  try {
    text = (await client(SYSTEM_PROMPT, JSON.stringify(facts))).slice(0, MAX_TEXT)
  } catch (error) {
    if (error instanceof NarrativeError) return { status: 'unavailable', reason: error.reason, message: `${error.message} Try again later; the trends and flags above are unaffected.` }
    return { status: 'unavailable', reason: 'error', message: 'The AI summary could not be produced. The trends and flags above are unaffected.' }
  }
  const invented = findUnverifiedNumbers(text, facts)
  if (invented.length > 0) {
    return { status: 'unverified', message: 'The AI text contained figures that are not in the verified data, so it was withheld. Use the trends and flags above.' }
  }
  return { status: 'ok', text, model, generatedAt: now, basedOn: range, notice: NOTICE }
}
