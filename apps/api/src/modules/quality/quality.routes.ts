import type { InspectionInput } from '@shopfloor/shared'
import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps, AuthUser } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'
import * as svc from './quality.service'

const body = z.object({
  orderId: z.string({ error: 'Select a production order' }).max(50),
  reportId: z.string({ error: 'Select a valid production report.' }).max(50),
  inspectionDate: z.string({ error: 'Enter a valid date' }).max(10),
  inspectedQuantity: z.number({ error: 'Enter the inspected quantity as a whole number' }),
  failedQuantity: z.number({ error: 'Enter the failed quantity as a whole number' }),
  defectId: z.string({ error: 'Select a defect classification' }).max(100),
  notes: z.string({ error: 'Enter notes as text' }).max(5000),
})
const asInput = (b: z.infer<typeof body>): InspectionInput => b

export function qualityRouter(deps: AppDeps): Router {
  const { db } = deps
  const router = Router()
  router.use(authenticate(deps))
  const actor = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw unauthenticated()
    return req.user
  }
  // Reading: managers and supervisors. Writing: supervisors (acting as inspectors). Operators and administrators get 403.
  const canRead = requireRole('manager', 'supervisor')
  const canWrite = requireRole('supervisor')

  router.get('/', canRead, async (_req, res) => res.json(await svc.listInspectionItems(db)))
  router.get('/reference', canRead, async (_req, res) => res.json(await svc.getReference(db)))
  router.get('/:id', canRead, async (req, res) => res.json(await svc.getInspectionItem(db, String(req.params.id))))
  router.post('/', canWrite, async (req, res) => res.status(201).json(await svc.createInspection(db, actor(req), asInput(parseBody(body, req)))))
  router.patch('/:id', canWrite, async (req, res) => res.json(await svc.updateInspection(db, String(req.params.id), asInput(parseBody(body, req)))))
  return router
}
