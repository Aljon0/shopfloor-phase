import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../lib/errors'

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No such endpoint: ${req.method} ${req.path}` } })
}

function isPrismaError(error: unknown): error is { code: string; meta?: { target?: unknown } } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string' && /^P\d{4}$/.test((error as { code: string }).code)
}

/** Known errors keep their message; anything unexpected is logged and reported as a generic 500. */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } })
    return
  }
  if (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'The request body is not valid JSON.' } })
    return
  }
  if (isPrismaError(error) && error.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'That value is already in use.' } })
    return
  }
  console.error('Unhandled error:', error)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } })
}
