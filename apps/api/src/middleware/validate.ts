import type { Request } from 'express'
import type { z } from 'zod'
import { badRequest } from '../lib/errors'

/** Parses a request part with a zod schema; the error handler turns failures into field messages. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const details: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    details[key] ??= issue.message
  }
  throw badRequest('Some fields are not valid.', details)
}

export const parseBody = <S extends z.ZodType>(schema: S, req: Request): z.infer<S> => parse(schema, req.body)
