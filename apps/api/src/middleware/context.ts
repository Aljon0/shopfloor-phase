import type { Role } from '@shopfloor/shared'
import type { Env } from '../config/env'
import type { Db } from '../db/client'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export interface AppDeps {
  db: Db
  env: Env
}
