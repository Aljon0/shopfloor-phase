import { Router } from 'express'
import type { AppDeps } from '../../middleware/context'
import { toLine, toMachine, toProduct, toDefect, toShift } from '../settings/settings.mappers'

/** Reference data every signed-in role needs for forms and filters. */
export function referenceRouter({ db }: AppDeps): Router {
  const router = Router()
  router.get('/', async (_req, res) => {
    const [lines, products, machines, defectTypes, shifts] = await Promise.all([
      db.productionLine.findMany({ orderBy: { name: 'asc' } }),
      db.product.findMany({ orderBy: { name: 'asc' } }),
      db.machine.findMany({ orderBy: { name: 'asc' } }),
      db.defectType.findMany({ orderBy: { name: 'asc' } }),
      db.shift.findMany({ orderBy: { startTime: 'asc' } }),
    ])
    res.json({ lines: lines.map(toLine), products: products.map(toProduct), machines: machines.map(toMachine), defectTypes: defectTypes.map(toDefect), shifts: shifts.map(toShift) })
  })
  return router
}
