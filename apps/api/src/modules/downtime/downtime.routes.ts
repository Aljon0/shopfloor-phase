import type { DowntimeInput } from '@shopfloor/shared'
import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps, AuthUser } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'
import * as svc from './downtime.service'

const body = z.object({
  machineId: z.string({ error: 'Select a machine' }).max(100),
  orderId: z.string({ error: 'Select a valid production order.' }).max(50),
  reportId: z.string({ error: 'Select a valid production report.' }).max(50),
  startTime: z.string({ error: 'Enter a valid start date and time' }).max(20),
  endTime: z.string({ error: 'Enter a valid end date and time' }).max(20),
  category: z.string({ error: 'Select a category' }).max(40),
  notes: z.string({ error: 'Describe the reason (at least 3 characters)' }).max(5000),
})
// The shared validator re-checks the category against the allowed values, so the cast only narrows the type.
const asInput = (b: z.infer<typeof body>): DowntimeInput => ({ ...b, category: b.category as DowntimeInput['category'] })

export function downtimeRouter(deps: AppDeps): Router {
  const { db } = deps
  const router = Router()
  router.use(authenticate(deps))
  const actor = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw unauthenticated()
    return req.user
  }
  // Reading: managers, supervisors, operators. Writing: operators (their own events) and supervisors.
  const canRead = requireRole('manager', 'supervisor', 'operator')
  const canWrite = requireRole('operator', 'supervisor')

  router.get('/', canRead, async (_req, res) => res.json(await svc.listDowntimeItems(db)))
  router.get('/reference', canRead, async (_req, res) => res.json(await svc.getReference(db)))
  router.get('/:id', canRead, async (req, res) => res.json(await svc.getDowntimeItem(db, String(req.params.id))))
  router.post('/', canWrite, async (req, res) => res.status(201).json(await svc.createDowntimeEvent(db, actor(req), asInput(parseBody(body, req)))))
  router.patch('/:id', canWrite, async (req, res) => res.json(await svc.updateDowntimeEvent(db, actor(req), String(req.params.id), asInput(parseBody(body, req)))))
  return router
}
