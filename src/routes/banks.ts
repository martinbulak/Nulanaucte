import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { createBank, listBanks, countTransactions } from '../db'
import type { BankSource } from '../types'

export const banksRoutes = new Hono()

banksRoutes.use('*', requireAuth)

banksRoutes.get('/', async (c) => {
  const user = c.get('user')
  const banks = listBanks(user.id).map((b) => ({
    ...b,
    transactionCount: countTransactions(user.id, b.id),
  }))
  return c.json({ ok: true, data: banks })
})

banksRoutes.post('/', async (c) => {
  const user = c.get('user')
  let body: { name?: unknown; type?: unknown; balance?: unknown; currency?: unknown; source?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ ok: false, error: 'Názov banky je povinný' }, 400)

  const validSources: BankSource[] = ['slsp', 'tatra', 'revolut', 'manual']
  const source: BankSource = validSources.includes(body.source as BankSource)
    ? (body.source as BankSource)
    : 'manual'

  const bank = createBank({
    userId: user.id,
    name,
    type: typeof body.type === 'string' ? body.type : 'bezny',
    balance: typeof body.balance === 'number' ? body.balance : 0,
    currency: typeof body.currency === 'string' ? body.currency : 'EUR',
    source,
  })

  return c.json({ ok: true, data: { ...bank, transactionCount: 0 } })
})
