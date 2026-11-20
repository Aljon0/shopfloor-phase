import type { Env } from '../../config/env'
import type { NarrativeClient } from '../../middleware/context'

/** Why the AI text could not be produced. Never contains the key or the provider's response body. */
export class NarrativeError extends Error {
  constructor(public readonly reason: 'unreachable' | 'error', message: string) {
    super(message)
  }
}

/**
 * Calls an OpenAI-compatible /chat/completions endpoint (Groq by default). Returns null when no key is
 * configured. The key stays on the server; the browser never sees it or talks to the provider.
 */
export function createNarrativeClient(env: Env, fetchImpl: typeof fetch = fetch): NarrativeClient | null {
  const key = env.AI_API_KEY
  if (!key) return null
  const url = `${env.AI_BASE_URL.replace(/\/+$/, '')}/chat/completions`
  return async (system, user) => {
    let res: Response
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 0.2,
          max_tokens: 400,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      })
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error'
      throw new NarrativeError('unreachable', name === 'TimeoutError' ? 'The AI service took too long to answer.' : 'The AI service could not be reached.')
    }
    if (!res.ok) throw new NarrativeError('error', `The AI service refused the request (status ${res.status}).`)
    let content: unknown
    try {
      const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
      content = json.choices?.[0]?.message?.content
    } catch {
      throw new NarrativeError('error', 'The AI service sent an answer that could not be read.')
    }
    if (typeof content !== 'string' || !content.trim()) throw new NarrativeError('error', 'The AI service sent an empty answer.')
    return content.trim()
  }
}
