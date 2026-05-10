import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { requireAuth } from '../middleware/auth'
import {
  bumpTokenVersion,
  deleteUser,
  findUserById,
  regenerateInboundToken,
  setUserPassword,
  updateProfile,
} from '../db'
import { verifyPassword } from '../lib/password'
import { COOKIE_NAME } from '../lib/jwt'
import { env } from '../env'
import type { ReportFrequency } from '../types'

export const userRoutes = new Hono()

userRoutes.use('*', requireAuth)

const PASSWORD_MIN = 12

function buildAddress(slug: string, token: string): string {
  return `${slug}-${token}@${env.INBOUND_DOMAIN}`
}

// ---------------- Inbound email widget ----------------

userRoutes.get('/inbound', async (c) => {
  const session = c.get('user')
  const user = await findUserById(session.id)
  if (!user) return c.json({ ok: false, error: 'User not found' }, 404)
  return c.json({
    ok: true,
    data: {
      address: buildAddress(user.inboundSlug, user.inboundToken),
      slug: user.inboundSlug,
      token: user.inboundToken,
      domain: env.INBOUND_DOMAIN,
      configured: env.INBOUND_DOMAIN !== 'inbox.local',
    },
  })
})

userRoutes.post('/inbound/regenerate', async (c) => {
  const session = c.get('user')
  const newToken = await regenerateInboundToken(session.id)
  if (!newToken) return c.json({ ok: false, error: 'User not found' }, 404)
  const user = (await findUserById(session.id))!
  return c.json({
    ok: true,
    data: {
      address: buildAddress(user.inboundSlug, newToken),
      slug: user.inboundSlug,
      token: newToken,
      domain: env.INBOUND_DOMAIN,
    },
  })
})

// ---------------- Profile ----------------

userRoutes.patch('/profile', async (c) => {
  const session = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }

  const patch: {
    name?: string | null
    reportFrequency?: ReportFrequency
    emailNotifications?: boolean
  } = {}

  if (body.name !== undefined) {
    if (body.name === null || body.name === '') {
      patch.name = null
    } else if (typeof body.name === 'string') {
      patch.name = body.name.trim().slice(0, 80)
    } else {
      return c.json({ ok: false, error: 'Neplatné meno' }, 400)
    }
  }
  if (body.reportFrequency !== undefined) {
    if (body.reportFrequency !== 'weekly' && body.reportFrequency !== 'monthly' && body.reportFrequency !== 'off') {
      return c.json({ ok: false, error: 'Neplatná frekvencia reportov' }, 400)
    }
    patch.reportFrequency = body.reportFrequency
  }
  if (body.emailNotifications !== undefined) {
    if (typeof body.emailNotifications !== 'boolean') {
      return c.json({ ok: false, error: 'Neplatná hodnota' }, 400)
    }
    patch.emailNotifications = body.emailNotifications
  }

  const updated = await updateProfile(session.id, patch)
  if (!updated) return c.json({ ok: false, error: 'User not found' }, 404)
  return c.json({
    ok: true,
    data: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      reportFrequency: updated.reportFrequency,
      emailNotifications: updated.emailNotifications,
    },
  })
})

userRoutes.post('/change-password', async (c) => {
  const session = c.get('user')
  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!current || !next) return c.json({ ok: false, error: 'Súčasné a nové heslo sú povinné' }, 400)
  if (next.length < PASSWORD_MIN) return c.json({ ok: false, error: `Heslo musí mať aspoň ${PASSWORD_MIN} znakov` }, 400)
  if (!/[\d\W_]/.test(next)) return c.json({ ok: false, error: 'Heslo musí obsahovať aspoň jednu číslicu alebo symbol' }, 400)

  const user = await findUserById(session.id)
  if (!user) return c.json({ ok: false, error: 'User not found' }, 404)
  const ok = await verifyPassword(current, user.salt, user.passwordHash)
  if (!ok) return c.json({ ok: false, error: 'Súčasné heslo nesedí' }, 401)

  await setUserPassword(user.id, next)
  // setUserPassword bumps tokenVersion → all sessions die. Clear our cookie too.
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ ok: true, data: { changed: true, mustReLogin: true } })
})

// ---------------- Account deletion (GDPR) ----------------

userRoutes.delete('/', async (c) => {
  const session = c.get('user')
  let body: { confirm?: unknown; password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }
  if (body.confirm !== 'VYMAZAT') {
    return c.json({ ok: false, error: 'Pre potvrdenie pošli confirm: "VYMAZAT"' }, 400)
  }
  // Require current password to delete
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) return c.json({ ok: false, error: 'Heslo je povinné na potvrdenie' }, 400)
  const user = await findUserById(session.id)
  if (!user) return c.json({ ok: false, error: 'User not found' }, 404)
  const ok = await verifyPassword(password, user.salt, user.passwordHash)
  if (!ok) return c.json({ ok: false, error: 'Heslo nesedí' }, 401)

  await deleteUser(user.id)
  // Bump version pre-emptively in case JWT was already issued
  await bumpTokenVersion(user.id) // no-op if user is gone; harmless
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ ok: true, data: { deleted: true } })
})

// ---------------- GDPR — data export ----------------

userRoutes.get('/export', async (c) => {
  const session = c.get('user')
  const { default: app } = await import('./_export-helper')
  return app(session.id, c)
})
