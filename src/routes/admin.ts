import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { findUserById, getAdminStats } from '../db.js'

export const adminRoutes = new Hono()

adminRoutes.use('*', requireAuth)
adminRoutes.use('*', async (c, next) => {
  // Defense-in-depth: require role=admin in DB (don't trust JWT alone)
  const session = c.get('user')
  const u = await findUserById(session.id)
  if (!u || u.role !== 'admin') {
    return c.json({ ok: false, error: 'Forbidden' }, 403)
  }
  await next()
})

/**
 * Returns ONLY aggregate counts and minimal per-user technical info
 * (id, email, verified, createdAt, locked status).
 *
 * Explicitly NOT included: any financial amounts, transaction descriptions,
 * bank names, mortgage details, AI recommendations, PDF metadata.
 */
adminRoutes.get('/stats', async (c) => {
  const stats = await getAdminStats()
  return c.json({ ok: true, data: stats })
})
