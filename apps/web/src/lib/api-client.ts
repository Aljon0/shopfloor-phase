/** Thin fetch wrapper for the ShopFloor API. The session lives in an httpOnly cookie, so no token handling here. */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>
  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toFields(details: unknown): Record<string, string> {
  if (!isRecord(details)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(details)) if (typeof v === 'string') out[k] = v
  return out
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = undefined
  }
  const err = isRecord(body) && isRecord(body.error) ? body.error : undefined
  const code = err && typeof err.code === 'string' ? err.code : 'UNKNOWN'
  const message = err && typeof err.message === 'string' ? err.message : 'Something went wrong. Try again.'
  return new ApiError(res.status, code, message, err ? toFields(err.details) : {})
}

export async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the ShopFloor server. Check that it is running and try again.')
  }
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => apiRequest<T>('GET', path),
  post: <T = void>(path: string, body?: unknown) => apiRequest<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, body),
}

/** The most specific message to show a person: field messages from the server, else the error message. */
export function describeApiError(error: unknown): Error {
  if (error instanceof ApiError) {
    const fieldMessages = Object.values(error.fields)
    return new Error(fieldMessages.length > 0 ? fieldMessages.join(' ') : error.message)
  }
  return error instanceof Error ? error : new Error('That did not work. Try again.')
}
