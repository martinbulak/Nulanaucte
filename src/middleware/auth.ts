import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, verifySession } from '../lib/jwt'
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
  const user = await verifySession(token)
  if (!user) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }
  c.set('user', user)
  await next()
}
