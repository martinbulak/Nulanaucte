import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js' // first import — fail at boot if envs missing
import { authRoutes } from './routes/auth.js'
import { banksRoutes } from './routes/banks.js'
import { importsRoutes } from './routes/imports.js'
import { mortgagesRoutes } from './routes/mortgages.js'
import { inboundRoutes } from './routes/inbound.js'
import { userRoutes } from './routes/user.js'
import { aiRoutes } from './routes/ai.js'
import { reportsRoutes } from './routes/reports.js'
import { adminRoutes } from './routes/admin.js'
import { requireAuth } from './middleware/auth.js'
import {
  deleteAllTransactions,
  ensureSeeded,
  listBanks,
  listIncomes,
  listMonthsWithData,
  listMortgages,
  listTransactions,
} from './db.js'

const app = new Hono()

// Audit M9 — explicit CORS. Same-origin in our deploy, but be explicit:
// only the configured PUBLIC_ORIGIN can hit /api/* with credentials.
app.use(
  '/api/*',
  cors({
    origin: env.PUBLIC_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  }),
)

app.use('*', async (c, next) => {
  await ensureSeeded()
  await next()
})

app.route('/api/auth', authRoutes)
app.route('/api/banks', banksRoutes)
app.route('/api/imports', importsRoutes)
app.route('/api/mortgages', mortgagesRoutes)
app.route('/api/user', userRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/admin', adminRoutes)
// Public webhook (no auth — verified via Svix HMAC at the route level)
app.route('/api/inbound', inboundRoutes)

function parseMonth(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return /^\d{4}-\d{2}$/.test(raw) ? raw : undefined
}

function pickDefaultMonth(months: string[]): string {
  if (months.length > 0) return months[0]
  return new Date().toISOString().slice(0, 7)
}

app.get('/api/months', requireAuth, async (c) => {
  const user = c.get('user')
  const months = await listMonthsWithData(user.id)
  return c.json({ ok: true, data: months })
})

app.get('/api/transactions', requireAuth, async (c) => {
  const user = c.get('user')
  const bankIdRaw = c.req.query('bankId')
  const limitRaw = c.req.query('limit')
  const month = parseMonth(c.req.query('month'))
  const typeRaw = c.req.query('type')
  const type = typeRaw === 'prijem' || typeRaw === 'vydavok' ? typeRaw : undefined
  const bankId = bankIdRaw ? Number(bankIdRaw) : undefined
  const limit = limitRaw ? Math.max(1, Math.min(2000, Number(limitRaw))) : 500
  const txs = (await listTransactions(user.id, { bankId, month, type })).slice(0, limit)
  return c.json({ ok: true, data: txs })
})

app.delete('/api/transactions', requireAuth, async (c) => {
  const user = c.get('user')
  const result = await deleteAllTransactions(user.id)
  return c.json({ ok: true, data: result })
})

app.get('/api/dashboard/summary', requireAuth, async (c) => {
  const user = c.get('user')
  const [banks, incomes, mortgages, allTxs, months] = await Promise.all([
    listBanks(user.id),
    listIncomes(user.id),
    listMortgages(user.id),
    listTransactions(user.id),
    listMonthsWithData(user.id),
  ])

  const month = parseMonth(c.req.query('month')) ?? pickDefaultMonth(months)
  const monthTxs = allTxs.filter((t) => t.date.startsWith(month))

  const zostatok = banks.reduce((sum, b) => sum + b.balance, 0)
  const prijmyManual = incomes
    .filter((i) => !i.date || i.date.startsWith(month))
    .reduce((sum, i) => sum + i.amount, 0)
  const prijmyImported = monthTxs
    .filter((t) => t.type === 'prijem')
    .reduce((sum, t) => sum + t.amount, 0)
  const vydavky = monthTxs
    .filter((t) => t.type === 'vydavok')
    .reduce((sum, t) => sum + t.amount, 0)
  const splatky = mortgages.reduce((sum, m) => sum + m.monthlyPayment, 0)

  const recent = monthTxs.slice(0, 10).map((t) => {
    const bank = banks.find((b) => b.id === t.bankId)
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      note: t.note,
      category: t.category,
      bankName: bank?.name ?? null,
    }
  })

  return c.json({
    ok: true,
    data: {
      month,
      months,
      zostatok,
      prijmy: prijmyManual + prijmyImported,
      vydavky,
      splatky,
      net: prijmyManual + prijmyImported - vydavky,
      recent,
      counts: {
        banks: banks.length,
        incomes: incomes.length,
        transactionsTotal: allTxs.length,
        transactionsMonth: monthTxs.length,
        mortgages: mortgages.length,
      },
    },
  })
})

app.get('/api/dashboard/trend', requireAuth, async (c) => {
  const user = c.get('user')
  const monthsRaw = Number(c.req.query('months'))
  const want = Number.isFinite(monthsRaw) ? Math.max(1, Math.min(24, monthsRaw)) : 6

  const [allTxs, dataMonthsDesc] = await Promise.all([
    listTransactions(user.id),
    listMonthsWithData(user.id),
  ])

  // Pick the most recent N months that have data, then fill towards current month
  // so the chart has a stable rolling window even if user only has 1-2 months.
  const dataMonthsAsc = [...dataMonthsDesc].sort()
  let useMonths: string[]
  if (dataMonthsAsc.length === 0) {
    // No data — return last N calendar months ending now, all zeros
    const now = new Date()
    useMonths = []
    for (let i = want - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      useMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  } else if (dataMonthsAsc.length >= want) {
    useMonths = dataMonthsAsc.slice(-want)
  } else {
    // Fill earlier months with zeros so chart shape is consistent
    const earliest = dataMonthsAsc[0]
    const [y, m] = earliest.split('-').map(Number)
    useMonths = []
    for (let i = want - dataMonthsAsc.length; i > 0; i--) {
      const d = new Date(y, m - 1 - i, 1)
      useMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    useMonths.push(...dataMonthsAsc)
  }

  const trend = useMonths.map((m) => {
    const monthTxs = allTxs.filter((t) => t.date.startsWith(m))
    const prijmy = monthTxs.filter((t) => t.type === 'prijem').reduce((s, t) => s + t.amount, 0)
    const vydavky = monthTxs.filter((t) => t.type === 'vydavok').reduce((s, t) => s + t.amount, 0)
    return {
      month: m,
      prijmy: Math.round(prijmy * 100) / 100,
      vydavky: Math.round(vydavky * 100) / 100,
      net: Math.round((prijmy - vydavky) * 100) / 100,
      count: monthTxs.length,
    }
  })

  return c.json({ ok: true, data: trend })
})

app.notFound((c) => c.json({ ok: false, error: 'Not found' }, 404))

app.onError((err, c) => {
  // Audit M11 — log only error name + message in prod (no full stack with PII).
  // Generate a correlation ID so users can report issues without exposing details.
  const correlationId = Math.random().toString(36).slice(2, 10)
  if (env.isProd) {
    console.error(`[server] [${correlationId}] ${err.name}: ${err.message}`)
  } else {
    console.error(`[server] [${correlationId}]`, err)
  }
  return c.json(
    { ok: false, error: 'Internal server error', ref: correlationId },
    500,
  )
})

export default app
