import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import {
  applyCategoryUpdates,
  applyRulesToTransactions,
  categorySummary,
  findLatestClippyPeriod,
  findTransactionById,
  getClippyTips,
  getLatestRecommendation,
  listMerchantRules,
  listReanalyzableTransactions,
  listTransactions,
  listUncategorizedTransactions,
  listUserCategories,
  merchantKey,
  saveClippyTips,
  saveRecommendation,
  upsertMerchantRule,
} from '../db.js'
import {
  CATEGORIES,
  categorizeBatch,
  generateClippyTips,
  generateRecommendations,
  type Category,
} from '../lib/ai.js'

export const aiRoutes = new Hono()

aiRoutes.use('*', requireAuth)

// Rate limits — splitting cheap reads from expensive AI calls so normal dashboard
// browsing doesn't burn through the same budget as OpenAI mutations.
//
//   /api/ai/categories         (GET)   — datalist source, called on every page load
//   /api/ai/recommendations    (GET)   — reads cached Raul rec, cheap
//   /api/ai/transactions/:id/category (PATCH) — single-row update, no OpenAI call
//   /api/ai/categorize         (POST)  — EXPENSIVE: chunked OpenAI calls (~$0.001/run)
//   /api/ai/recommendations    (POST)  — EXPENSIVE: one OpenAI call (~$0.001/run)
//
// Cheap operations get generous budget so dashboard works smoothly even on
// nervous-refresh browsing. Expensive ones stay tight to bound monthly OpenAI
// spend per user.

const aiReadLimit = rateLimit({
  name: 'ai-read',
  max: 300,
  windowMs: 60 * 60 * 1000,
  keyer: (c) => `u:${c.get('user').id}`,
  onLimit: (c, retryAfterSec) =>
    c.json(
      {
        ok: false,
        error: `Príliš veľa requestov za hodinu. Skús znovu o ${Math.ceil(retryAfterSec / 60)} min.`,
        code: 'RATE_LIMIT_READ',
      },
      429,
    ),
})

const aiEditLimit = rateLimit({
  name: 'ai-edit',
  max: 200,
  windowMs: 60 * 60 * 1000,
  keyer: (c) => `u:${c.get('user').id}`,
  onLimit: (c, retryAfterSec) =>
    c.json(
      {
        ok: false,
        error: `Príliš veľa úprav kategórií. Skús znovu o ${Math.ceil(retryAfterSec / 60)} min.`,
        code: 'RATE_LIMIT_EDIT',
      },
      429,
    ),
})

const aiExpensiveLimit = rateLimit({
  name: 'ai-expensive',
  max: 20,
  windowMs: 60 * 60 * 1000,
  keyer: (c) => `u:${c.get('user').id}`,
  onLimit: (c, retryAfterSec) =>
    c.json(
      {
        ok: false,
        error:
          retryAfterSec > 60
            ? `Limit AI volaní vyčerpaný. Maximálne 20 AI requestov za hodinu kvôli OpenAI nákladom — skús znovu o ${Math.ceil(retryAfterSec / 60)} min.`
            : `Limit AI volaní vyčerpaný. Skús znovu o ${retryAfterSec}s.`,
        code: 'RATE_LIMIT_AI',
      },
      429,
    ),
})

// ---------- META ----------

aiRoutes.get('/categories', aiReadLimit, async (c) => {
  const user = c.get('user')
  const userCats = await listUserCategories(user.id)
  const starter = [...CATEGORIES]
  // Merge: user's own first (sorted by use frequency), then starter examples not yet listed
  const seen = new Set<string>()
  const merged: string[] = []
  for (const c of [...userCats, ...starter]) {
    const k = c.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(c)
  }
  return c.json({
    ok: true,
    data: {
      categories: merged,
      userCategories: userCats,
      starter,
    },
  })
})

// ---------- CATEGORIZE ----------

aiRoutes.post('/categorize', aiExpensiveLimit, async (c) => {
  const user = c.get('user')
  // Parse optional { force: boolean } body.
  // force=false (default): only re-categorize uncategorized ("system") transactions
  // force=true: re-categorize ALL transactions EXCEPT those manually set by the user
  let force = false
  try {
    const body = (await c.req.json()) as { force?: unknown }
    if (body && typeof body.force === 'boolean') force = body.force
  } catch {
    /* no body or invalid JSON — keep default */
  }

  const txs = force
    ? await listReanalyzableTransactions(user.id, 500)
    : await listUncategorizedTransactions(user.id, 200)

  if (txs.length === 0) {
    return c.json({
      ok: true,
      data: {
        processed: 0,
        updated: 0,
        usedAI: false,
        ruleHits: 0,
        mode: force ? 'force' : 'uncategorized',
        note: force
          ? 'Žiadne transakcie na pretriedenie (všetky sú ručne upravené alebo neexistujú).'
          : 'Žiadne nezaradené transakcie.',
      },
    })
  }

  // STEP 1 — Apply learned merchant rules (IBAN / merchant identifier match).
  // Anything that hits a rule gets categorized for free, no AI tokens spent.
  const rules = await listMerchantRules(user.id)
  const ruleHitIds = await applyRulesToTransactions(user.id, txs, rules)
  const remaining = txs.filter((t) => !ruleHitIds.has(t.id))

  // STEP 2 — Anything still uncategorized goes through AI.
  let usedAI = false
  let tokens = 0
  let aiUpdated = 0
  if (remaining.length > 0) {
    const minimal = remaining.map((t) => ({
      id: t.id,
      date: t.date,
      note: t.note ?? '',
      amount: t.type === 'vydavok' ? -t.amount : t.amount,
      type: t.type,
    }))
    const result = await categorizeBatch(minimal)
    usedAI = result.usedAI
    tokens = result.tokens ?? 0
    // Persist category + AI-extracted merchant on each tx.
    const updates = result.items.map((it) => ({
      id: it.id,
      category: it.category,
      aiConfidence: it.confidence,
      source: 'ai' as const,
      // Empty merchant → null (clear any stale value); non-empty → save.
      merchant: it.merchant && it.merchant.length > 0 ? it.merchant : null,
    }))
    aiUpdated = await applyCategoryUpdates(user.id, updates)
    // STEP 3 — Persist high-confidence AI categorizations as rules so future
    // transactions skip AI on next run. We save TWO rule variants per item:
    //   - note-keyed (existing behaviour: matches near-identical note text)
    //   - merchant-keyed (NEW: matches by AI-extracted company name across
    //     different store locations / note phrasings)
    // Skip "Iné" and low-confidence — we don't want to memoize a fallback.
    for (const it of result.items) {
      if ((it.confidence ?? 0) < 0.7) continue
      if (it.category.toLowerCase() === 'iné') continue
      const sourceTx = remaining.find((t) => t.id === it.id)
      if (!sourceTx) continue
      const noteKey = merchantKey(sourceTx.note)
      if (noteKey) {
        await upsertMerchantRule({
          userId: user.id,
          key: noteKey,
          category: it.category,
          confidence: it.confidence,
          source: 'ai',
        })
      }
      if (it.merchant && it.merchant.length >= 2) {
        // merchant: prefix so we know it's the AI-extracted company name, not
        // a normalized-note key. Distinct namespace inside the same table.
        await upsertMerchantRule({
          userId: user.id,
          key: `merchant:${it.merchant.toLowerCase()}`,
          category: it.category,
          confidence: it.confidence,
          source: 'ai',
        })
      }
    }
  }

  return c.json({
    ok: true,
    data: {
      processed: txs.length,
      updated: ruleHitIds.size + aiUpdated,
      ruleHits: ruleHitIds.size,
      usedAI,
      tokens,
      mode: force ? 'force' : 'uncategorized',
    },
  })
})

// ---------- MANUAL OVERRIDE ----------

aiRoutes.patch('/transactions/:id/category', aiEditLimit, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  let body: { category?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný JSON' }, 400)
  }
  const raw = typeof body.category === 'string' ? body.category.trim() : ''
  if (!raw || raw.length < 2) return c.json({ ok: false, error: 'Kategória je príliš krátka' }, 400)
  if (raw.length > 60) return c.json({ ok: false, error: 'Kategória môže mať max 60 znakov' }, 400)
  // Normalize: collapse whitespace, capitalize first
  const cat = (raw.replace(/\s+/g, ' ')).replace(/^./, (c) => c.toUpperCase())
  const updated = await applyCategoryUpdates(user.id, [
    { id, category: cat as Category, aiConfidence: null, source: 'user' },
  ])
  if (updated === 0) return c.json({ ok: false, error: 'Transakcia nenájdená' }, 404)

  // Memorize the user's choice as one or two merchant rules so future imports
  // from the same merchant / IBAN are categorized automatically before AI
  // even sees them. We save both variants when available:
  //   - note-keyed: matches near-identical note text on future txs
  //   - merchant-keyed: matches across different store locations of the same
  //     chain (Tesco Petržalka == Tesco Bratislava). Requires AI to have
  //     previously extracted a merchant on this tx.
  try {
    const tx = await findTransactionById(user.id, id)
    const noteKey = merchantKey(tx?.note)
    if (noteKey) {
      await upsertMerchantRule({
        userId: user.id,
        key: noteKey,
        category: cat,
        confidence: null,
        source: 'user',
      })
    }
    if (tx?.merchant && tx.merchant.length >= 2) {
      await upsertMerchantRule({
        userId: user.id,
        key: `merchant:${tx.merchant.toLowerCase()}`,
        category: cat,
        confidence: null,
        source: 'user',
      })
    }
  } catch (e) {
    // Non-fatal — the user override was already saved; rule is "nice to have".
    console.warn('[ai] failed to upsert merchant rule:', e instanceof Error ? e.message : e)
  }

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

aiRoutes.get('/recommendations', aiReadLimit, async (c) => {
  const user = c.get('user')
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ ok: false, error: 'Neplatný formát mesiaca (YYYY-MM)' }, 400)
  }
  const rec = await getLatestRecommendation(user.id, month)
  return c.json({ ok: true, data: { period: month, recommendation: rec } })
})

aiRoutes.post('/recommendations', aiExpensiveLimit, async (c) => {
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

  // Filter out "Iné" everywhere we feed Raul — it's an uninformative bucket
  // ("dunno, miscellany") and recommendations about it are useless to the user.
  const isOther = (cat: string) => cat.trim().toLowerCase() === 'iné'

  const byCategoryFiltered = byCategory.filter((c) => !isOther(c.category))
  const byCategoryPrevFiltered = byCategoryPrev.filter((c) => !isOther(c.category))

  const prevMap = new Map(byCategoryPrevFiltered.map((c) => [c.category, c.total]))
  const changeVsLast = byCategoryFiltered
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
    .filter((t) => t.type === 'vydavok' && !isOther(t.category))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4)
    .map((t) => ({
      note: t.note?.slice(0, 80) ?? '—',
      amount: t.amount,
      date: t.date,
      category: t.category,
    }))

  const summaryInput = {
    monthLabel: monthLabel(month),
    totalIncome,
    totalExpense,
    topCategories: byCategoryFiltered.slice(0, 5),
    changeVsLast,
    largestTransactions,
  }
  const result = await generateRecommendations(summaryInput)
  await saveRecommendation(user.id, month, result.content)

  // Side-effect: refresh the clippy tips for the SAME month using the SAME
  // dashboard input. Different prompt, separate OpenAI call (~$0.0005), but
  // happens in the same logical "user asked Raul for analysis" beat so the
  // cost is part of that explicit action. Mascot tips stay in sync with the
  // long-form Raul recommendation the user just regenerated.
  let clippyCount = 0
  try {
    const clippy = await generateClippyTips(summaryInput)
    if (clippy.tips.length > 0) {
      await saveClippyTips(user.id, month, clippy.tips)
      clippyCount = clippy.tips.length
    }
  } catch (e) {
    // Non-fatal — Raul rec already saved. Just log and move on.
    console.warn('[ai] clippy refresh failed:', e instanceof Error ? e.message : e)
  }

  return c.json({
    ok: true,
    data: {
      period: month,
      content: result.content,
      usedAI: result.usedAI,
      clippyTips: clippyCount,
    },
  })
})

/**
 * GET /api/ai/clippy-tips?month=YYYY-MM
 *
 * Returns the cached clippy tips for the given month. If none exist for the
 * requested month, falls back to the most recent month that DOES have cached
 * tips (so the mascot has something to show even if the user is browsing
 * older months). Empty tips array if nothing cached yet — widget hides.
 *
 * Does NOT auto-generate — generation happens as a side-effect of
 * POST /api/ai/recommendations to keep all OpenAI cost gated behind the
 * user's explicit "Spýtať sa Raula" click.
 */
aiRoutes.get('/clippy-tips', aiReadLimit, async (c) => {
  const user = c.get('user')
  const requested = c.req.query('month')
  let period = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : null
  let tips: string[] | null = period ? await getClippyTips(user.id, period) : null

  // Fallback — pick the most recent month with cached tips
  if (!tips || tips.length === 0) {
    const fallback = await findLatestClippyPeriod(user.id)
    if (fallback) {
      period = fallback
      tips = await getClippyTips(user.id, fallback)
    }
  }

  return c.json({
    ok: true,
    data: {
      period: period ?? null,
      tips: tips ?? [],
    },
  })
})
