import type { OrderInput } from '@shopfloor/shared'
import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps, AuthUser } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'
import * as svc from './orders.service'

const inputShape = {
  productId: z.string({ error: 'Select a product' }).max(100),
  lineId: z.string({ error: 'Select a production line' }).max(100),
  plannedQuantity: z.number({ error: 'Enter a whole number' }),
  plannedStart: z.string({ error: 'Enter a valid date' }).max(10),
  dueDate: z.string({ error: 'Enter a valid date' }).max(10),
  priority: z.string({ error: 'Select a priority' }).max(20),
  instructions: z.string({ error: 'Enter instructions as text' }).max(5000),
}
const editBody = z.object(inputShape)
const createBody = z.object({ ...inputShape, status: z.enum(['draft', 'planned'], { error: 'Orders can only be created as Draft or Planned.' }) })
const statusBody = z.object({
  to: z.enum(['draft', 'planned', 'in_progress', 'completed', 'cancelled'], { error: 'Select a valid status.' }),
  reason: z.string().max(500).optional(),
})

// The shared validator re-checks priority against the allowed list, so the cast only narrows the type.
const asInput = (b: z.infer<typeof editBody>): OrderInput => ({ ...b, priority: b.priority as OrderInput['priority'] })

export function ordersRouter(deps: AppDeps): Router {
  const { db } = deps
  const router = Router()
  router.use(authenticate(deps))
  const actor = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw unauthenticated()
    return req.user
  }

  // Reading: managers, supervisors and operators. Writing: supervisors only. This is the enforcement; the UI only hides buttons.
  const canRead = requireRole('manager', 'supervisor', 'operator')
  const canWrite = requireRole('supervisor')

  router.get('/', canRead, async (_req, res) => res.json(await svc.listOrders(db)))
  router.get('/:orderNumber', canRead, async (req, res) => res.json(await svc.getOrderDetail(db, String(req.params.orderNumber))))

  router.post('/', canWrite, async (req, res) => {
    const { status, ...input } = parseBody(createBody, req)
    res.status(201).json(await svc.createOrder(db, actor(req), asInput(input), status))
  })
  router.patch('/:orderNumber', canWrite, async (req, res) =>
    res.json(await svc.updateOrder(db, actor(req), String(req.params.orderNumber), asInput(parseBody(editBody, req)))),
  )
  router.post('/:orderNumber/status', canWrite, async (req, res) => {
    const { to, reason } = parseBody(statusBody, req)
    res.json(await svc.changeOrderStatus(db, actor(req), String(req.params.orderNumber), to, reason))
  })
  return router
}
