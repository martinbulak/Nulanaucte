import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import {
  createBank,
  listBanks,
  countTransactions,
  findBankBySource,
  setBankEnabled,
} from '../db.js'
import { KNOWN_BANKS, findBankDef } from '../lib/banks.js'
import type { BankSource } from '../types.js'

export const banksRoutes = new Hono()

banksRoutes.use('*', requireAuth)

// Audit H9 / L2 — strict bounds & NaN guards on all numeric/string inputs.
const NAME_MAX = 80
const TYPE_MAX = 40
const BALANCE_MIN = -1e9
const BALANCE_MAX = 1e9

banksRoutes.get('/', async (c) => {
  const user = c.get('user')
  // By default only enabled banks. Pass ?all=1 from settings to get every row.
  const includeDisabled = c.req.query('all') === '1'
  const banks = await listBanks(user.id, { includeDisabled })
  const withCounts = await Promise.all(
    banks.map(async (b) => ({
      ...b,
      transactionCount: await countTransactions(user.id, b.id),
    })),
  )
  return c.json({ ok: true, data: withCounts })
})

/**
 * GET /api/banks/registry
 *
 * Returns the curated list of known SK + neobank issuers, annotated with the
 * user's current state (do they have a bank record? enabled?). Drives the
 * checkbox UI on /nastavenia.
 */
banksRoutes.get('/registry', async (c) => {
  const user = c.get('user')
  const myBanks = await listBanks(user.id, { includeDisabled: true })
  const bySource = new Map<string, (typeof myBanks)[number]>()
  for (const b of myBanks) bySource.set(b.source, b)

  const items = KNOWN_BANKS.map((def) => {
    const mine = bySource.get(def.source)
    return {
      ...def,
      bankId: mine?.id ?? null,
      enabled: mine?.enabled ?? false,
      hasAccount: !!mine,
    }
  })
  return c.json({ ok: true, data: items })
})

/**
 * POST /api/banks/registry/toggle
 *
 * Body: { source: string, enabled: boolean }
 *
 * If the user doesn't have a bank with this source yet, create it (using
 * the registry's display name). Otherwise just flip the enabled flag.
 * Disabled banks keep their transactions — flip back on to restore.
 */
banksRoutes.post('/registry/toggle', async (c) => {
  const user = c.get('user')
  let body: { source?: unknown; enabled?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const source = typeof body.source === 'string' ? body.source : ''
  const enabled = body.enabled === true
  const def = findBankDef(source)
  if (!def) return c.json({ ok: false, error: 'Neznáma banka' }, 400)

  const existing = await findBankBySource(user.id, def.source)
  if (existing) {
    const updated = await setBankEnabled(user.id, existing.id, enabled)
    return c.json({ ok: true, data: updated })
  }
  // Create on first toggle ON. Toggling OFF when there's no record is a no-op.
  if (!enabled) return c.json({ ok: true, data: null })
  const created = await createBank({
    userId: user.id,
    name: def.name,
    type: 'bezny',
    source: def.source,
  })
  return c.json({ ok: true, data: created })
})

banksRoutes.post('/', async (c) => {
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, NAME_MAX) : ''
  if (!name) return c.json({ ok: false, error: 'Názov banky je povinný' }, 400)

  const type =
    typeof body.type === 'string' ? body.type.trim().slice(0, TYPE_MAX) : 'bezny'

  const currency =
    typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency)
      ? body.currency
      : 'EUR'

  // Accept any source that exists in the registry, otherwise default to manual.
  const rawSource = typeof body.source === 'string' ? body.source : ''
  const source: BankSource = findBankDef(rawSource) ? rawSource : 'manual'

  let balance = 0
  if (typeof body.balance === 'number' && Number.isFinite(body.balance)) {
    if (body.balance < BALANCE_MIN || body.balance > BALANCE_MAX) {
      return c.json({ ok: false, error: 'Zostatok mimo povoleného rozsahu' }, 400)
    }
    balance = body.balance
  }

  const bank = await createBank({
    userId: user.id,
    name,
    type,
    balance,
    currency,
    source,
  })

  return c.json({ ok: true, data: { ...bank, transactionCount: 0 } })
})
