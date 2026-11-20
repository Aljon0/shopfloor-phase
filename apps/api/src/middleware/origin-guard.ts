import type { NextFunction, Request, Response } from 'express'
import { forbidden } from '../lib/errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Cookie sessions need CSRF protection. The cookie is SameSite=Lax (not sent on cross-site POSTs);
 * this adds a second check: a state-changing request that names an Origin must come from an allowed one.
 */
export function originGuard(allowed: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const origin = req.headers.origin
    if (!SAFE_METHODS.has(req.method) && origin && !allowed.includes(origin)) throw forbidden('This request came from an origin that is not allowed.')
    next()
  }
}
