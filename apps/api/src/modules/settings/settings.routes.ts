import { ROLES } from '@shopfloor/shared'
import { Router } from 'express'
import { z } from 'zod'
import { unauthenticated } from '../../lib/errors'
import { MAX_PASSWORD_LENGTH } from '../../lib/password'
import { authenticate, requireRole } from '../../middleware/authenticate'
import type { AppDeps, AuthUser } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'
import * as svc from './settings.service'

const text = (label: string) => z.string({ error: `${label} is required.` }).max(200)
const nameBody = z.object({ name: text('Name') })
const userBody = z.object({ name: text('Name'), email: z.string().max(120), role: z.enum(ROLES as [string, ...string[]], { error: 'Select a valid role.' }) })
const newUserBody = userBody.extend({ password: z.string().max(MAX_PASSWORD_LENGTH + 1) })
const lineBody = z.object({ name: text('Name'), code: z.string().max(10) })
const machineBody = z.object({ name: text('Name'), lineId: z.string().max(100), shiftTarget: z.number({ error: 'Enter a whole number.' }) })
const machineEditBody = z.object({ name: text('Name'), shiftTarget: z.number({ error: 'Enter a whole number.' }) })
const shiftBody = z.object({ startTime: z.string().max(5), endTime: z.string().max(5) })
const passwordBody = z.object({ password: z.string().max(MAX_PASSWORD_LENGTH + 1) })

type UserBody = z.infer<typeof userBody>

export function settingsRouter(deps: AppDeps): Router {
  const { db } = deps
  const router = Router()
  // Every settings route needs a signed-in administrator. This is the enforcement; the UI only hides links.
  router.use(authenticate(deps), requireRole('administrator'))

  const actor = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw unauthenticated()
    return req.user
  }
  const asUserInput = (b: UserBody) => ({ name: b.name, email: b.email, role: b.role as (typeof ROLES)[number] })

  router.get('/', async (_req, res) => res.json(await svc.getOverview(db)))

  // users
  router.post('/users', async (req, res) => {
    const b = parseBody(newUserBody, req)
    res.status(201).json(await svc.createUser(db, actor(req), { ...asUserInput(b), password: b.password }))
  })
  router.patch('/users/:id', async (req, res) => res.json(await svc.updateUser(db, actor(req), String(req.params.id), asUserInput(parseBody(userBody, req)))))
  router.post('/users/:id/activate', async (req, res) => res.json(await svc.setUserActive(db, actor(req), String(req.params.id), true)))
  router.post('/users/:id/deactivate', async (req, res) => res.json(await svc.setUserActive(db, actor(req), String(req.params.id), false)))
  router.post('/users/:id/reset-password', async (req, res) => {
    await svc.resetUserPassword(db, actor(req), String(req.params.id), parseBody(passwordBody, req).password)
    res.status(204).end()
  })

  // products
  router.post('/products', async (req, res) => res.status(201).json(await svc.createProduct(db, actor(req), parseBody(nameBody, req))))
  router.patch('/products/:id', async (req, res) => res.json(await svc.updateProduct(db, actor(req), String(req.params.id), parseBody(nameBody, req))))
  router.post('/products/:id/activate', async (req, res) => res.json(await svc.setProductActive(db, actor(req), String(req.params.id), true)))
  router.post('/products/:id/deactivate', async (req, res) => res.json(await svc.setProductActive(db, actor(req), String(req.params.id), false)))

  // lines
  router.post('/lines', async (req, res) => res.status(201).json(await svc.createLine(db, actor(req), parseBody(lineBody, req))))
  router.patch('/lines/:id', async (req, res) => res.json(await svc.updateLine(db, actor(req), String(req.params.id), parseBody(nameBody, req))))
  router.post('/lines/:id/activate', async (req, res) => res.json(await svc.setLineActive(db, actor(req), String(req.params.id), true)))
  router.post('/lines/:id/deactivate', async (req, res) => res.json(await svc.setLineActive(db, actor(req), String(req.params.id), false)))

  // machines
  router.post('/machines', async (req, res) => res.status(201).json(await svc.createMachine(db, actor(req), parseBody(machineBody, req))))
  router.patch('/machines/:id', async (req, res) => res.json(await svc.updateMachine(db, actor(req), String(req.params.id), parseBody(machineEditBody, req))))
  router.post('/machines/:id/activate', async (req, res) => res.json(await svc.setMachineActive(db, actor(req), String(req.params.id), true)))
  router.post('/machines/:id/deactivate', async (req, res) => res.json(await svc.setMachineActive(db, actor(req), String(req.params.id), false)))

  // defect types
  router.post('/defect-types', async (req, res) => res.status(201).json(await svc.createDefectType(db, actor(req), parseBody(nameBody, req))))
  router.patch('/defect-types/:id', async (req, res) => res.json(await svc.updateDefectType(db, actor(req), String(req.params.id), parseBody(nameBody, req))))
  router.post('/defect-types/:id/activate', async (req, res) => res.json(await svc.setDefectTypeActive(db, actor(req), String(req.params.id), true)))
  router.post('/defect-types/:id/deactivate', async (req, res) => res.json(await svc.setDefectTypeActive(db, actor(req), String(req.params.id), false)))

  // shifts
  router.patch('/shifts/:id', async (req, res) => res.json(await svc.updateShift(db, actor(req), String(req.params.id), parseBody(shiftBody, req))))

  return router
}
