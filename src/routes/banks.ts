import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { createBank, listBanks, countTransactions } from '../db.js'
import type { BankSource } from '../types.js'

export const banksRoutes = new Hono()

banksRoutes.use('*', requireAuth)

// Audit H9 / L2 — strict bounds & NaN guards on all numeric/string inputs.
const NAME_MAX = 80
const TYPE_MAX = 40
const CURRENCY_MAX = 8
const BALANCE_MIN = -1e9
const BALANCE_MAX = 1e9
const VALID_SOURCES: readonly BankSource[] = ['slsp', 'tatra', 'revolut', 'manual']

banksRoutes.get('/', async (c) => {
  const user = c.get('user')
  const banks = await listBanks(user.id)
  const withCounts = await Promise.all(
    banks.map(async (b) => ({
      ...b,
      transactionCount: await countTransactions(user.id, b.id),
    })),
  )
  return c.json({ ok: true, data: withCounts })
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

  const source: BankSource = VALID_SOURCES.includes(body.source as BankSource)
    ? (body.source as BankSource)
    : 'manual'

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
