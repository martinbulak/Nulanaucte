import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env.js'
import type { SessionUser } from '../types.js'

const SECRET = new TextEncoder().encode(env.JWT_SECRET)

const ALG = 'HS256'
const TTL = '24h'

export const COOKIE_NAME = 'nu_session'

export async function signSession(
  user: SessionUser,
  tokenVersion: number,
): Promise<string> {
  return await new SignJWT({ uid: user.id, email: user.email, tv: tokenVersion })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(SECRET)
}

export async function verifySession(
  token: string,
): Promise<{ user: SessionUser; tokenVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (typeof payload.uid !== 'number' || typeof payload.email !== 'string') return null
    const tv = typeof payload.tv === 'number' ? payload.tv : 0
    return { user: { id: payload.uid, email: payload.email }, tokenVersion: tv }
  } catch {
    return null
  }
}
