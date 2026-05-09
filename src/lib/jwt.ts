import { SignJWT, jwtVerify } from 'jose'
import type { SessionUser } from '../types'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'koduvanica-dev-secret-change-me-in-production-please',
)

const ALG = 'HS256'
const TTL = '24h'

export async function signSession(user: SessionUser): Promise<string> {
  return await new SignJWT({ uid: user.id, email: user.email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (typeof payload.uid !== 'number' || typeof payload.email !== 'string') return null
    return { id: payload.uid, email: payload.email }
  } catch {
    return null
  }
}

export const COOKIE_NAME = 'nu_session'
