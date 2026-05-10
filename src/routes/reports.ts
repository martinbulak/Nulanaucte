import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db-client.js'
import { users } from '../schema.js'
import {
  categorySummary,
  listTransactions,
} from '../db.js'
import { sendEmail } from '../lib/email.js'
import { generateRecommendations } from '../lib/ai.js'
import { weeklyReportTemplate, monthlyReportTemplate } from '../lib/email-reports.js'
import { env } from '../env.js'

export const reportsRoutes = new Hono()

/**
 * Triggered by Vercel Cron (or manually with the right header).
 * Authorization: requires `CRON_SECRET` env var. If unset, only same-origin
 * dev requests succeed (Vercel sets x-vercel-cron header on cron jobs).
 */
function authorizedCron(c: { req: { header: (n: string) => string | undefined } }): boolean {
  // Vercel cron jobs always include this header
  if (c.req.header('x-vercel-cron')) return true
  // Or pass `Authorization: Bearer ${CRON_SECRET}`
  if (env.CRON_SECRET) {
    const auth = c.req.header('authorization') ?? ''
    return auth === `Bearer ${env.CRON_SECRET}`
  }
  // Dev fallback: allow when not in prod
  return !env.isProd
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

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface ReportPeriod {
  from: string // YYYY-MM-DD
  to: string
  label: string // "tento týždeň" / "Apríl 2026"
}

function lastWeekPeriod(): ReportPeriod {
  const now = new Date()
  const dow = now.getDay() // 0=Sun
  const lastSunday = new Date(now)
  lastSunday.setDate(now.getDate() - dow)
  const monday = new Date(lastSunday)
  monday.setDate(lastSunday.getDate() - 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(monday), to: fmt(lastSunday), label: `${fmt(monday)} – ${fmt(lastSunday)}` }
}

function lastMonthPeriod(): ReportPeriod {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ym = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
  const lastDay = new Date(last.getFullYear(), last.getMonth() + 1, 0)
  return {
    from: `${ym}-01`,
    to: lastDay.toISOString().slice(0, 10),
    label: monthLabel(ym),
  }
}

interface ReportData {
  period: ReportPeriod
  totalIncome: number
  totalExpense: number
  topCategories: Array<{ category: string; total: number; count: number }>
  changeVsLast: Array<{ category: string; delta: number; pct: number }>
  largestTransactions: Array<{ note: string; amount: number; date: string; category: string }>
  recommendations: string
}

async function buildReport(
  userId: number,
  period: ReportPeriod,
  isMonthly: boolean,
): Promise<ReportData> {
  // For weekly: filter by date range; for monthly: by ${ym} prefix
  const allTxs = await listTransactions(userId, {
    month: isMonthly ? period.from.slice(0, 7) : undefined,
  })
  const inRange = allTxs.filter((t) => t.date >= period.from && t.date <= period.to)

  const totalIncome = inRange
    .filter((t) => t.type === 'prijem')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = inRange
    .filter((t) => t.type === 'vydavok')
    .reduce((s, t) => s + t.amount, 0)

  const byCategory = new Map<string, { total: number; count: number }>()
  for (const t of inRange) {
    if (t.type !== 'vydavok') continue
    const key = t.category
    const cur = byCategory.get(key) ?? { total: 0, count: 0 }
    cur.total += t.amount
    cur.count += 1
    byCategory.set(key, cur)
  }
  const topCategories = [...byCategory.entries()]
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Compare vs previous period (same length)
  const prevPeriodEnd = new Date(period.from)
  prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1)
  const days = Math.ceil(
    (new Date(period.to).getTime() - new Date(period.from).getTime()) / (1000 * 60 * 60 * 24),
  )
  const prevPeriodStart = new Date(prevPeriodEnd)
  prevPeriodStart.setDate(prevPeriodEnd.getDate() - days)
  const prevTxs = allTxs.filter(
    (t) =>
      t.date >= prevPeriodStart.toISOString().slice(0, 10) &&
      t.date <= prevPeriodEnd.toISOString().slice(0, 10) &&
      t.type === 'vydavok',
  )
  const prevByCategory = new Map<string, number>()
  for (const t of prevTxs) {
    prevByCategory.set(t.category, (prevByCategory.get(t.category) ?? 0) + t.amount)
  }
  const changeVsLast = topCategories
    .map((c) => {
      const prev = prevByCategory.get(c.category) ?? 0
      const delta = c.total - prev
      const pct = prev > 0 ? (delta / prev) * 100 : c.total > 0 ? 100 : 0
      return { category: c.category, delta, pct }
    })
    .filter((c) => Math.abs(c.pct) >= 20)
    .slice(0, 4)

  const largestTransactions = inRange
    .filter((t) => t.type === 'vydavok')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4)
    .map((t) => ({
      note: t.note?.slice(0, 80) ?? '—',
      amount: t.amount,
      date: t.date,
      category: t.category,
    }))

  const aiResult = await generateRecommendations({
    monthLabel: period.label,
    totalIncome,
    totalExpense,
    topCategories,
    changeVsLast,
    largestTransactions,
  })

  return {
    period,
    totalIncome,
    totalExpense,
    topCategories,
    changeVsLast,
    largestTransactions,
    recommendations: aiResult.content,
  }
}

async function sendReportToUser(
  user: { id: number; email: string; name: string | null; emailNotifications: boolean },
  kind: 'weekly' | 'monthly',
): Promise<{ ok: boolean; reason?: string }> {
  if (!user.emailNotifications) return { ok: false, reason: 'notifications-off' }
  const period = kind === 'weekly' ? lastWeekPeriod() : lastMonthPeriod()
  const data = await buildReport(user.id, period, kind === 'monthly')
  if (data.totalIncome === 0 && data.totalExpense === 0) {
    return { ok: false, reason: 'no-activity' }
  }
  const tpl =
    kind === 'weekly'
      ? weeklyReportTemplate(user.name, data, env.PUBLIC_ORIGIN)
      : monthlyReportTemplate(user.name, data, env.PUBLIC_ORIGIN)
  const r = await sendEmail({ ...tpl, to: user.email, tag: `report-${kind}` })
  if (!r.ok) return { ok: false, reason: r.error }
  return { ok: true }
}

// ---------------- CRON ENDPOINTS ----------------

reportsRoutes.post('/run/:kind', async (c) => {
  if (!authorizedCron(c)) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  const kind = c.req.param('kind')
  if (kind !== 'weekly' && kind !== 'monthly') {
    return c.json({ ok: false, error: 'Neznámy report (weekly | monthly)' }, 400)
  }

  // Find users opted-in to this frequency
  const recipients = await db.select().from(users).where(eq(users.reportFrequency, kind))
  let sent = 0
  let skipped = 0
  const errors: Array<{ userId: number; reason: string }> = []
  for (const u of recipients) {
    const r = await sendReportToUser(
      {
        id: u.id,
        email: u.email,
        name: u.name,
        emailNotifications: u.emailNotifications,
      },
      kind,
    )
    if (r.ok) sent++
    else if (r.reason === 'no-activity' || r.reason === 'notifications-off') skipped++
    else errors.push({ userId: u.id, reason: r.reason ?? 'unknown' })
  }
  return c.json({
    ok: true,
    data: {
      kind,
      total: recipients.length,
      sent,
      skipped,
      errors,
    },
  })
})

// On-demand preview (auth-required separately) — returns the generated email HTML.
// This is convenient for QA without spamming inboxes.
reportsRoutes.get('/preview/:kind', async (c) => {
  // No auth here — but show only for koduvanica seed in dev. In prod, treat as 404.
  if (env.isProd) return c.json({ ok: false, error: 'Not found' }, 404)
  const kind = c.req.param('kind')
  if (kind !== 'weekly' && kind !== 'monthly') {
    return c.json({ ok: false, error: 'Neznámy report' }, 400)
  }
  const userIdRaw = c.req.query('userId') ?? '1'
  const userId = Number(userIdRaw)
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) return c.json({ ok: false, error: 'User not found' }, 404)
  const period = kind === 'weekly' ? lastWeekPeriod() : lastMonthPeriod()
  const data = await buildReport(u.id, period, kind === 'monthly')
  const tpl =
    kind === 'weekly'
      ? weeklyReportTemplate(u.name, data, env.PUBLIC_ORIGIN)
      : monthlyReportTemplate(u.name, data, env.PUBLIC_ORIGIN)
  c.header('Content-Type', 'text/html; charset=utf-8')
  return c.body(tpl.html)
})
