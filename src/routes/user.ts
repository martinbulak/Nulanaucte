import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { findUserById, regenerateInboundToken } from '../db'

export const userRoutes = new Hono()

userRoutes.use('*', requireAuth)

function inboundDomain(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.INBOUND_DOMAIN || 'inbox.local'
}

function buildAddress(slug: string, token: string): string {
  return `${slug}-${token}@${inboundDomain()}`
}

userRoutes.get('/inbound', async (c) => {
  const session = c.get('user')
  const user = findUserById(session.id)
  if (!user) return c.json({ ok: false, error: 'User not found' }, 404)
  return c.json({
    ok: true,
    data: {
      address: buildAddress(user.inboundSlug, user.inboundToken),
      slug: user.inboundSlug,
      token: user.inboundToken,
      domain: inboundDomain(),
      configured: inboundDomain() !== 'inbox.local',
    },
  })
})

userRoutes.post('/inbound/regenerate', async (c) => {
  const session = c.get('user')
  const newToken = regenerateInboundToken(session.id)
  if (!newToken) return c.json({ ok: false, error: 'User not found' }, 404)
  const user = findUserById(session.id)!
  return c.json({
    ok: true,
    data: {
      address: buildAddress(user.inboundSlug, newToken),
      slug: user.inboundSlug,
      token: newToken,
      domain: inboundDomain(),
    },
  })
})
