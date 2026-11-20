import jwt from 'jsonwebtoken'

export interface SessionClaims {
  userId: string
  tokenVersion: number
}

/** HS256 is pinned on both sides so a token can never choose its own algorithm. */
export function signSession(claims: SessionClaims, secret: string, hours: number): string {
  return jwt.sign({ tv: claims.tokenVersion }, secret, { algorithm: 'HS256', subject: claims.userId, expiresIn: `${hours}h` })
}

export function verifySession(token: string, secret: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.tv !== 'number') return null
    return { userId: payload.sub, tokenVersion: payload.tv }
  } catch {
    return null
  }
}
