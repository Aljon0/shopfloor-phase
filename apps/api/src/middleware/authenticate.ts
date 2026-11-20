import type { Role } from '@shopfloor/shared'
import type { NextFunction, Request, Response } from 'express'
import { forbidden, unauthenticated } from '../lib/errors'
import { verifySession } from '../lib/tokens'
import type { AppDeps } from './context'

export const SESSION_COOKIE = 'shopfloor_session'

/**
 * Every request is checked against the database, not just the token, so deactivating a user or
 * changing their role or password takes effect immediately instead of when the token expires.
 */
export function authenticate({ db, env }: AppDeps) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token: unknown = req.cookies?.[SESSION_COOKIE]
    const claims = typeof token === 'string' ? verifySession(token, env.JWT_SECRET) : null
    if (!claims) throw unauthenticated()
    const user = await db.user.findUnique({ where: { id: claims.userId }, select: { id: true, name: true, email: true, role: true, isActive: true, tokenVersion: true } })
    if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) throw unauthenticated('Your session has ended. Sign in again.')
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role }
    next()
  }
}

/** Authorisation lives here, on the server. The UI only hides controls. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw unauthenticated()
    if (!roles.includes(req.user.role)) throw forbidden()
    next()
  }
}
