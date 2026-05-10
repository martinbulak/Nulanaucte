import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import {
  createMortgage,
  deleteMortgage,
  findMortgage,
  listMortgages,
  updateMortgage,
  type MortgageInput,
} from '../db.js'

export const mortgagesRoutes = new Hono()

mortgagesRoutes.use('*', requireAuth)

mortgagesRoutes.get('/', async (c) => {
  const user = c.get('user')
  return c.json({ ok: true, data: await listMortgages(user.id) })
})

// Audit H9 — strict bounds.
const PROPNAME_MAX = 120
const BANK_MAX = 80
const AMOUNT_MAX = 1e8 // 100 mil. EUR — sanity ceiling per audit M7
const RATE_MIN = 0
const RATE_MAX = 100
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function readInput(body: Record<string, unknown>): MortgageInput | string {
  const propertyName =
    typeof body.propertyName === 'string'
      ? body.propertyName.trim().slice(0, PROPNAME_MAX)
      : ''
  const bank = typeof body.bank === 'string' ? body.bank.trim().slice(0, BANK_MAX) : ''
  if (!propertyName) return 'Názov nehnuteľnosti / úveru je povinný'
  if (!bank) return 'Banka je povinná'

  const totalAmount = Number(body.totalAmount)
  const remaining = Number(body.remaining)
  const monthlyPayment = Number(body.monthlyPayment)
  if (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > AMOUNT_MAX)
    return 'Neplatná celková suma'
  if (!Number.isFinite(remaining) || remaining < 0 || remaining > AMOUNT_MAX)
    return 'Neplatný zostatok'
  if (!Number.isFinite(monthlyPayment) || monthlyPayment < 0 || monthlyPayment > AMOUNT_MAX)
    return 'Neplatná mesačná splátka'

  let interestRate: number | null = null
  if (body.interestRate !== undefined && body.interestRate !== null && body.interestRate !== '') {
    const ir = Number(body.interestRate)
    if (!Number.isFinite(ir) || ir < RATE_MIN || ir > RATE_MAX) return 'Neplatná úroková sadzba'
    interestRate = ir
  }

  let startDate: string | null = null
  if (typeof body.startDate === 'string' && body.startDate.trim()) {
    if (!DATE_RE.test(body.startDate)) return 'Neplatný začiatočný dátum (YYYY-MM-DD)'
    startDate = body.startDate
  }
  let endDate: string | null = null
  if (typeof body.endDate === 'string' && body.endDate.trim()) {
    if (!DATE_RE.test(body.endDate)) return 'Neplatný konečný dátum (YYYY-MM-DD)'
    endDate = body.endDate
  }

  return { propertyName, bank, totalAmount, remaining, monthlyPayment, interestRate, startDate, endDate }
}

mortgagesRoutes.post('/', async (c) => {
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný JSON' }, 400)
  }
  const parsed = readInput(body)
  if (typeof parsed === 'string') return c.json({ ok: false, error: parsed }, 400)
  return c.json({ ok: true, data: await createMortgage(user.id, parsed) })
})

mortgagesRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  const existing = await findMortgage(user.id, id)
  if (!existing) return c.json({ ok: false, error: 'Hypotéka nenájdená' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný JSON' }, 400)
  }
  const merged: Record<string, unknown> = {
    propertyName: existing.propertyName,
    bank: existing.bank,
    totalAmount: existing.totalAmount,
    remaining: existing.remaining,
    monthlyPayment: existing.monthlyPayment,
    interestRate: existing.interestRate,
    startDate: existing.startDate,
    endDate: existing.endDate,
    ...body,
  }
  const parsed = readInput(merged)
  if (typeof parsed === 'string') return c.json({ ok: false, error: parsed }, 400)
  const updated = await updateMortgage(user.id, id, parsed)
  return c.json({ ok: true, data: updated })
})

mortgagesRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  const ok = await deleteMortgage(user.id, id)
  if (!ok) return c.json({ ok: false, error: 'Hypotéka nenájdená' }, 404)
  return c.json({ ok: true, data: { id } })
})
