import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps, AuthUser } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'
import * as svc from './approvals.service'

const reasonBody = z.object({ reason: z.string({ error: 'Enter a reason.' }).max(1000) })

export function approvalsRouter(deps: AppDeps): Router {
  const { db } = deps
  const router = Router()
  // Only supervisors review. This is the enforcement; the UI only hides the Approvals screen.
  router.use(authenticate(deps), requireRole('supervisor'))
  const actor = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw unauthenticated()
    return req.user
  }

  router.get('/', async (_req, res) => res.json(await svc.listApprovalItems(db)))
  router.post('/:reportId/approve', async (req, res) => res.json(await svc.approveReport(db, actor(req), String(req.params.reportId))))
  router.post('/:reportId/return', async (req, res) => res.json(await svc.returnReport(db, actor(req), String(req.params.reportId), parseBody(reasonBody, req).reason)))
  router.post('/:reportId/reopen', async (req, res) => res.json(await svc.reopenReport(db, actor(req), String(req.params.reportId), parseBody(reasonBody, req).reason)))
  return router
}
