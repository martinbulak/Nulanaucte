import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import {
  applyCategoryUpdates,
  categorySummary,
  getLatestRecommendation,
  listTransactions,
  listUncategorizedTransactions,
  saveRecommendation,
} from '../db'
import {
  CATEGORIES,
  categorizeBatch,
  generateRecommendations,
  type Category,
} from '../lib/ai'

export const aiRoutes = new Hono()

aiRoutes.use('*', requireAuth)
// AI calls are pricey — limit per user
const aiLimit = rateLimit({
  name: 'ai-user',
  max: 30,
  windowMs: 60 * 60 * 1000,
  keyer: (c) => `u:${c.get('user').id}`,
})
aiRoutes.use('*', aiLimit)

// ---------- META ----------

aiRoutes.get('/categories', async (c) => {
  return c.json({ ok: true, data: { categories: CATEGORIES } })
})

// ---------- CATEGORIZE ----------

aiRoutes.post('/categorize', async (c) => {
  const user = c.get('user')
  // Default: process up to 200 uncategorized transactions
  const txs = await listUncategorizedTransactions(user.id, 200)
  if (txs.length === 0) {
    return c.json({
      ok: true,
      data: { processed: 0, updated: 0, usedAI: false, note: 'Žiadne nezaradené transakcie.' },
    })
  }
  const minimal = txs.map((t) => ({
    id: t.id,
    date: t.date,
    note: t.note ?? '',
    amount: t.type === 'vydavok' ? -t.amount : t.amount,
    type: t.type,
  }))
  const result = await categorizeBatch(minimal)
  const updates = result.items.map((it) => ({
    id: it.id,
    category: it.category,
    aiConfidence: it.confidence,
    source: 'ai' as const,
  }))
  const updated = await applyCategoryUpdates(user.id, updates)
  return c.json({
    ok: true,
    data: {
      processed: txs.length,
      updated,
      usedAI: result.usedAI,
      tokens: result.tokens,
    },
  })
})

// ---------- MANUAL OVERRIDE ----------

aiRoutes.patch('/transactions/:id/category', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  let body: { category?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný JSON' }, 400)
  }
  const cat = typeof body.category === 'string' ? body.category : ''
  const valid = (CATEGORIES as readonly string[]).includes(cat)
  if (!valid) return c.json({ ok: false, error: 'Neznáma kategória' }, 400)
  const updated = await applyCategoryUpdates(user.id, [
    { id, category: cat as Category, aiConfidence: null, source: 'user' },
  ])
  if (updated === 0) return c.json({ ok: false, error: 'Transakcia nenájdená' }, 404)
  return c.json({ ok: true, data: { id, category: cat } })
})

// ---------- RAUL RECOMMENDATIONS ----------

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const SK_MONTHS = [
  'Január',
  'Február',
  'Marec',
  'Apríl',
  'Máj',
  'Jún',
  'Júl',
  'August',
  'September',
  'Október',
  'November',
  'December',
]
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${SK_MONTHS[parseInt(m, 10) - 1] ?? m} ${y}`
}

aiRoutes.get('/recommendations', async (c) => {
  const user = c.get('user')
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ ok: false, error: 'Neplatný formát mesiaca (YYYY-MM)' }, 400)
  }
  const rec = await getLatestRecommendation(user.id, month)
  return c.json({ ok: true, data: { period: month, recommendation: rec } })
})

aiRoutes.post('/recommendations', async (c) => {
  const user = c.get('user')
  let body: { month?: unknown }
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }
  const month =
    typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
      ? body.month
      : new Date().toISOString().slice(0, 7)
  const prevMonth = shiftMonth(month, -1)

  // Gather data for the month + previous month
  const [monthTxs, byCategory, byCategoryPrev] = await Promise.all([
    listTransactions(user.id, { month }),
    categorySummary(user.id, month, 'vydavok'),
    categorySummary(user.id, prevMonth, 'vydavok'),
  ])

  if (monthTxs.length === 0) {
    return c.json({
      ok: false,
      error: `V ${monthLabel(month)} nemáme žiadne transakcie. Importuj výpis a Raul sa pozrie.`,
    }, 400)
  }

  const totalIncome = monthTxs
    .filter((t) => t.type === 'prijem')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = monthTxs
    .filter((t) => t.type === 'vydavok')
    .reduce((s, t) => s + t.amount, 0)

  const prevMap = new Map(byCategoryPrev.map((c) => [c.category, c.total]))
  const changeVsLast = byCategory
    .map((c) => {
      const prev = prevMap.get(c.category) ?? 0
      const delta = c.total - prev
      const pct = prev > 0 ? (delta / prev) * 100 : c.total > 0 ? 100 : 0
      return { category: c.category, delta, pct }
    })
    .filter((c) => Math.abs(c.pct) >= 20)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)

  const largestTransactions = monthTxs
    .filter((t) => t.type === 'vydavok')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4)
    .map((t) => ({
      note: t.note?.slice(0, 80) ?? '—',
      amount: t.amount,
      date: t.date,
      category: t.category,
    }))

  const result = await generateRecommendations({
    monthLabel: monthLabel(month),
    totalIncome,
    totalExpense,
    topCategories: byCategory.slice(0, 5),
    changeVsLast,
    largestTransactions,
  })

  await saveRecommendation(user.id, month, result.content)

  return c.json({
    ok: true,
    data: {
      period: month,
      content: result.content,
      usedAI: result.usedAI,
    },
  })
})
