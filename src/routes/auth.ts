import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { ensureSeeded, findUserByEmail } from '../db'
import { verifyPassword } from '../lib/password'
import { COOKIE_NAME, signSession } from '../lib/jwt'
import { requireAuth } from '../middleware/auth'

export const authRoutes = new Hono()

authRoutes.post('/login', async (c) => {
  await ensureSeeded()
  let body: { email?: unknown; password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return c.json({ ok: false, error: 'Email a heslo sú povinné' }, 400)
  }

  const user = findUserByEmail(email)
  if (!user) {
    return c.json({ ok: false, error: 'Nesprávne prihlasovacie údaje' }, 401)
  }
  const ok = await verifyPassword(password, user.salt, user.passwordHash)
  if (!ok) {
    return c.json({ ok: false, error: 'Nesprávne prihlasovacie údaje' }, 401)
  }

  const token = await signSession({ id: user.id, email: user.email })
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return c.json({ ok: true, data: { id: user.id, email: user.email } })
})

authRoutes.post('/logout', async (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ ok: true, data: null })
})

authRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user')
  return c.json({ ok: true, data: user })
})
