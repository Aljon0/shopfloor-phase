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

/** Sends the prompt to a language model and returns its text. Injected so tests never need the internet. */
export type NarrativeClient = (system: string, user: string) => Promise<string>

export interface AppDeps {
  db: Db
  env: Env
  /** Omit to build one from the environment (null when no AI key is configured). */
  narrative?: NarrativeClient | null
}
