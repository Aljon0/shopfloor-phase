import { Router, type CookieOptions, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { badRequest, ruleViolation, unauthenticated } from '../../lib/errors'
import { newId } from '../../lib/ids'
import { hashPassword, passwordProblem, verifyPassword } from '../../lib/password'
import { signSession } from '../../lib/tokens'
import { SESSION_COOKIE, authenticate } from '../../middleware/authenticate'
import type { AppDeps } from '../../middleware/context'
import { parseBody } from '../../middleware/validate'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').max(120),
  password: z.string().min(1, 'Enter your password.').max(128),
})
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(128),
  newPassword: z.string().max(128),
})

// Verified against this when the email is unknown, so "no such user" costs the same time as "wrong password".
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '=='

export function authRouter(deps: AppDeps): Router {
  const { db, env } = deps
  const router = Router()

  const cookieOptions = (): CookieOptions => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: '/',
    maxAge: env.SESSION_HOURS * 60 * 60 * 1000,
  })
  const setSession = (res: Response, userId: string, tokenVersion: number) =>
    res.cookie(SESSION_COOKIE, signSession({ userId, tokenVersion }, env.JWT_SECRET, env.SESSION_HOURS), cookieOptions())

  const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === 'test' ? 1000 : 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Wait a minute and try again.' } },
  })

  router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = parseBody(loginSchema, req)
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !ok || !user.isActive) throw unauthenticated('Incorrect email or password.')
    setSession(res, user.id, user.tokenVersion)
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  })

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined })
    res.status(204).end()
  })

  router.get('/me', authenticate(deps), (req, res) => {
    res.json({ user: req.user })
  })

  router.post('/change-password', authenticate(deps), async (req, res) => {
    const { currentPassword, newPassword } = parseBody(changePasswordSchema, req)
    const me = req.user
    if (!me) throw unauthenticated()
    const problem = passwordProblem(newPassword, me.email)
    if (problem) throw badRequest('Some fields are not valid.', { newPassword: problem })
    const row = await db.user.findUnique({ where: { id: me.id } })
    if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) throw badRequest('Some fields are not valid.', { currentPassword: 'That is not your current password.' })
    if (currentPassword === newPassword) throw ruleViolation('Choose a password you have not just used.')
    const passwordHash = await hashPassword(newPassword)
    // Bumping tokenVersion signs out every other session; this one gets a fresh token below.
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: me.id }, data: { passwordHash, tokenVersion: { increment: 1 } } })
      await tx.auditLog.create({ data: { id: newId('aud'), actorId: me.id, entity: 'user', entityId: me.id, action: 'password_changed', detail: `${me.name} changed their own password` } })
      return u
    })
    setSession(res, updated.id, updated.tokenVersion)
    res.status(204).end()
  })

  return router
}
