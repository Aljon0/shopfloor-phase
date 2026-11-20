import type { ReportInput } from '@shopfloor/shared'
import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps, AuthUser } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'
import * as svc from './reports.service'

const inputShape = {
  orderId: z.string({ error: 'Select a production order' }).max(50),
  machineId: z.string({ error: 'Select a machine' }).max(100),
  shift: z.string({ error: 'Select a shift' }).max(20),
  reportDate: z.string({ error: 'Enter a valid date' }).max(10),
  producedQuantity: z.number({ error: 'Enter the produced quantity as a whole number' }),
  rejectedQuantity: z.number({ error: 'Enter the rejected quantity as a whole number' }),
  notes: z.string({ error: 'Enter notes as text' }).max(5000),
}
const saveBody = z.object({ ...inputShape, mode: z.enum(['draft', 'submit'], { error: 'Choose draft or submit.' }) })

// The shared validator re-checks the shift against the allowed values, so the cast only narrows the type.
const asInput = (b: Omit<z.infer<typeof saveBody>, 'mode'>): ReportInput => ({ ...b, shift: b.shift as ReportInput['shift'] })

export function reportsRouter(deps: AppDeps): Router {
  const { db } = deps
  const router = Router()
  router.use(authenticate(deps))
  const actor = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw unauthenticated()
    return req.user
  }

  // Reading: managers, supervisors and operators. Writing: operators, and only on their own reports.
  const canRead = requireRole('manager', 'supervisor', 'operator')
  const canWrite = requireRole('operator')

  router.get('/', canRead, async (_req, res) => res.json(await svc.listReports(db)))
  router.get('/reference', canRead, async (_req, res) => res.json(await svc.getReference(db)))
  router.get('/:reportId', canRead, async (req, res) => res.json(await svc.getReportDetail(db, String(req.params.reportId))))

  router.post('/', canWrite, async (req, res) => {
    const { mode, ...input } = parseBody(saveBody, req)
    res.status(201).json(await svc.createReport(db, actor(req), asInput(input), mode))
  })
  router.patch('/:reportId', canWrite, async (req, res) => {
    const { mode, ...input } = parseBody(saveBody, req)
    res.json(await svc.updateReport(db, actor(req), String(req.params.reportId), asInput(input), mode))
  })
  router.post('/:reportId/submit', canWrite, async (req, res) => res.json(await svc.submitReport(db, actor(req), String(req.params.reportId))))
  router.delete('/:reportId', canWrite, async (req, res) => {
    await svc.deleteReport(db, actor(req), String(req.params.reportId))
    res.status(204).end()
  })
  return router
}
