import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, verifySession } from '../lib/jwt'
import { findUserById } from '../db'
import type { SessionUser } from '../types'

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
  }
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }
  const verified = await verifySession(token)
  if (!verified) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }
  // Server-side revocation: tokenVersion must match current user state
  const dbUser = await findUserById(verified.user.id)
  if (!dbUser || dbUser.tokenVersion !== verified.tokenVersion) {
    return c.json({ ok: false, error: 'Unauthorized (revoked session)' }, 401)
  }
  c.set('user', verified.user)
  await next()
}
