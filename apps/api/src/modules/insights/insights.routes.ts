import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { badRequest } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps } from '../../middleware/context'
import { createNarrativeClient } from './narrative-client'
import * as svc from './insights.service'

const range = z.object({ from: z.string({ error: 'from is required' }).max(10), to: z.string({ error: 'to is required' }).max(10) })

function parse(input: unknown) {
  const r = range.safeParse(input)
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? 'Invalid request')
  return r.data
}

/** Insights: manager and supervisor. Trends and flags are rule-based; the AI summary is optional and never required. */
export function insightsRouter(deps: AppDeps): Router {
  const { db, env } = deps
  const client = deps.narrative === undefined ? createNarrativeClient(env) : deps.narrative
  const router = Router()
  router.use(authenticate(deps))
  router.use(requireRole('manager', 'supervisor'))
  router.get('/', async (req, res) => res.json(await svc.getInsights(db, parse(req.query), client !== null)))
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === 'test' ? 1000 : 6,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many AI summary requests. Wait a minute and try again.' } },
  })
  router.post('/narrative', limiter, async (req, res) => res.json(await svc.getNarrative(db, client, env.AI_MODEL, parse(req.body))))
  return router
}
