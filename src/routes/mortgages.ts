import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import {
  createMortgage,
  deleteMortgage,
  findMortgage,
  listMortgages,
  updateMortgage,
  type MortgageInput,
} from '../db'

export const mortgagesRoutes = new Hono()

mortgagesRoutes.use('*', requireAuth)

mortgagesRoutes.get('/', async (c) => {
  const user = c.get('user')
  return c.json({ ok: true, data: listMortgages(user.id) })
})

function readInput(body: Record<string, unknown>): MortgageInput | string {
  const propertyName = typeof body.propertyName === 'string' ? body.propertyName.trim() : ''
  const bank = typeof body.bank === 'string' ? body.bank.trim() : ''
  if (!propertyName) return 'Názov nehnuteľnosti / úveru je povinný'
  if (!bank) return 'Banka je povinná'

  const totalAmount = Number(body.totalAmount)
  const remaining = Number(body.remaining)
  const monthlyPayment = Number(body.monthlyPayment)
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return 'Neplatná celková suma'
  if (!Number.isFinite(remaining) || remaining < 0) return 'Neplatný zostatok'
  if (!Number.isFinite(monthlyPayment) || monthlyPayment < 0) return 'Neplatná mesačná splátka'

  let interestRate: number | null = null
  if (body.interestRate !== undefined && body.interestRate !== null && body.interestRate !== '') {
    const ir = Number(body.interestRate)
    if (!Number.isFinite(ir)) return 'Neplatná úroková sadzba'
    interestRate = ir
  }

  const startDate =
    typeof body.startDate === 'string' && body.startDate.trim() ? body.startDate : null
  const endDate =
    typeof body.endDate === 'string' && body.endDate.trim() ? body.endDate : null

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
  return c.json({ ok: true, data: createMortgage(user.id, parsed) })
})

mortgagesRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  const existing = findMortgage(user.id, id)
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
  const updated = updateMortgage(user.id, id, parsed)
  return c.json({ ok: true, data: updated })
})

mortgagesRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  const ok = deleteMortgage(user.id, id)
  if (!ok) return c.json({ ok: false, error: 'Hypotéka nenájdená' }, 404)
  return c.json({ ok: true, data: { id } })
})
