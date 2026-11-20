import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps } from '../../middleware/context'
import { badRequest } from '../../lib/errors'
import * as svc from './read-models.service'

const rangeQuery = z.object({ from: z.string({ error: 'from is required' }).max(10), to: z.string({ error: 'to is required' }).max(10) })
const summaryQuery = z.object({ kind: z.enum(['daily', 'weekly']), date: z.string({ error: 'date is required' }).max(10) })

function parse<T>(schema: z.ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query)
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? 'Invalid query')
  return result.data
}

/**
 * Read models are computed on the server from the database. Same definitions as the browser mock
 * (both call the shared builders). Dashboard: administrator, manager, supervisor.
 * Analytics: manager. Report summaries: manager, supervisor.
 */
export function readModelsRouter(deps: AppDeps): { dashboard: Router; analytics: Router; summary: Router } {
  const { db } = deps
  const make = (...roles: Parameters<typeof requireRole>) => {
    const router = Router()
    router.use(authenticate(deps))
    router.use(requireRole(...roles))
    return router
  }
  const dashboard = make('administrator', 'manager', 'supervisor')
  dashboard.get('/', async (req, res) => res.json(await svc.dashboard(db, parse(rangeQuery, req.query))))
  const analytics = make('manager')
  analytics.get('/', async (req, res) => res.json(await svc.analytics(db, parse(rangeQuery, req.query))))
  const summary = make('manager', 'supervisor')
  summary.get('/', async (req, res) => {
    if (!req.user) throw unauthenticated()
    const q = parse(summaryQuery, req.query)
    res.json(await svc.summary(db, q.kind, q.date, req.user.name))
  })
  return { dashboard, analytics, summary }
}
