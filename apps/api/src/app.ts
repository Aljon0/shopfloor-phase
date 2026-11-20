import cookieParser from 'cookie-parser'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { authenticate } from './middleware/authenticate'
import type { AppDeps } from './middleware/context'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { originGuard } from './middleware/origin-guard'
import { authRouter } from './modules/auth/auth.routes'
import { referenceRouter } from './modules/reference/reference.routes'
import { settingsRouter } from './modules/settings/settings.routes'

/** Builds the Express app from its dependencies, so tests can run it against a test database. */
export function createApp(deps: AppDeps): Express {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', false)
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use('/api', originGuard(deps.env.ALLOWED_ORIGINS))

  app.get('/api/health', async (_req, res) => {
    try {
      await deps.db.$queryRaw`SELECT 1`
      res.json({ status: 'ok' })
    } catch {
      res.status(503).json({ status: 'database unavailable' })
    }
  })

  app.use('/api/auth', authRouter(deps))
  app.use('/api/reference', authenticate(deps), referenceRouter(deps))
  app.use('/api/settings', settingsRouter(deps))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
