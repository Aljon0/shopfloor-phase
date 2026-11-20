export type ErrorCode = 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RULE' | 'RATE_LIMITED' | 'INTERNAL'

/** An error the client is allowed to see. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (message: string, details?: Record<string, string>) => new AppError(400, 'VALIDATION', message, details)
export const unauthenticated = (message = 'Sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message)
export const forbidden = (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message)
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message)
/** A business rule refused the request (duplicate name, last administrator, open orders...). */
export const ruleViolation = (message: string) => new AppError(422, 'RULE', message)
