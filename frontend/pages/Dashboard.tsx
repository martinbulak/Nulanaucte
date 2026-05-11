import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, StatCard } from '../components/ui/Card'
import { MonthPicker, formatMonth } from '../components/ui/MonthPicker'
import {
  IncomeExpenseBarChart,
  HorizontalBars,
  Sparkline,
  CategoryTrendChart,
  CategoryLegend,
  type TrendPoint,
  type HBarItem,
  type CategoryTrendPoint,
} from '../components/ui/Charts'
import { RaulPanel } from '../components/ui/AIButtons'
import { apiFetch } from '../utils/api'

interface CategoryRow {
  category: string
  total: number
  count: number
}

interface CategoryTrend {
  months: string[]
  categories: string[]
  points: CategoryTrendPoint[]
}

interface RecentTx {
  id: number
  date: string
  type: 'vydavok' | 'prijem'
  amount: number
  note: string | null
  category: string
  bankName: string | null
}

interface Summary {
  month: string
  months: string[]
  zostatok: number
  prijmy: number
  vydavky: number
  splatky: number
  net: number
  recent: RecentTx[]
  counts: {
    banks: number
    incomes: number
    transactionsTotal: number
    transactionsMonth: number
    mortgages: number
  }
}

const eur = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const eurExact = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
})

const BANKS = ['Slovenská sporiteľňa', 'Tatra banka', 'Revolut']

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [catTrend, setCatTrend] = useState<CategoryTrend | null>(null)
  const [catRows, setCatRows] = useState<CategoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string>(currentYearMonth())

  const load = useCallback(async (m: string) => {
    const [sumRes, trendRes, catTrendRes, catRowsRes] = await Promise.all([
      apiFetch<Summary>(`/api/dashboard/summary?month=${encodeURIComponent(m)}`),
      apiFetch<TrendPoint[]>('/api/dashboard/trend?months=6'),
      apiFetch<CategoryTrend>('/api/dashboard/category-trend?months=6'),
      apiFetch<{ month: string; vydavky: CategoryRow[]; prijmy: CategoryRow[] }>(
        `/api/dashboard/categories?month=${encodeURIComponent(m)}`,
      ),
    ])
    if (sumRes.ok) {
      setSummary(sumRes.data)
      if (sumRes.data.month !== m) setMonth(sumRes.data.month)
    } else {
      setError(sumRes.error)
    }
    if (trendRes.ok) setTrend(trendRes.data)
    if (catTrendRes.ok) setCatTrend(catTrendRes.data)
    if (catRowsRes.ok) setCatRows(catRowsRes.data.vydavky)
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  // Compute current-month bank breakdown from recent transactions
  // (fast — for full breakdown user goes to /vydavky)

  const z = summary?.zostatok ?? 0
  const p = summary?.prijmy ?? 0
  const v = summary?.vydavky ?? 0
  const s = summary?.splatky ?? 0
  const net = summary?.net ?? 0
  const months = summary?.months ?? []
  const monthLabel = formatMonth(summary?.month ?? month)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 reveal reveal-1 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.3em] text-gold mb-2">
            ✦ Komnata zlatých záznamov ✦
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_40px_rgba(201,151,42,0.3)]">
            <span className="text-gold-bright">{monthLabel}</span>
          </h1>
          <p className="font-body italic text-text-secondary mt-2 text-base">
            „Nie je dôležité, koľko galeónov máš — ale koľko ich utečie do Apparátora."
          </p>
        </div>
        <MonthPicker month={summary?.month ?? month} months={months} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-6 bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-5 py-4 reveal">
          <p className="font-heading text-xs uppercase tracking-widest text-crimson-bright">
            ⚠ Trezor mlčí
          </p>
          <p className="font-body text-sm text-text-secondary mt-0.5">{error}</p>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <div className="reveal reveal-2">
          <StatCard
            label="Zostatok v trezoroch"
            value={eur.format(z)}
            hint={`${summary?.counts.banks ?? 0} bánk · aktuálny`}
            tone="gold"
            icon="⚖"
          />
        </div>
        <div className="reveal reveal-3">
          <StatCard
            label={`Príjmy (${monthLabel})`}
            value={eur.format(p)}
            hint={`${summary?.counts.transactionsMonth ?? 0} pohybov v mesiaci`}
            tone="emerald"
            icon="⚜"
          />
        </div>
        <div className="reveal reveal-4">
          <StatCard
            label={`Výdavky (${monthLabel})`}
            value={eur.format(v)}
            hint={`bilancia ${eur.format(net)}`}
            tone={net < 0 ? 'crimson' : 'emerald'}
            icon="☥"
          />
        </div>
        <div className="reveal reveal-5">
          <StatCard
            label="Splátky / mesiac"
            value={eur.format(s)}
            hint={`${summary?.counts.mortgages ?? 0} úverov`}
            tone="cobalt"
            icon="⚱"
          />
        </div>
      </div>

      {/* Trend chart + bank breakdown */}
      {trend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
          <div className="lg:col-span-2 reveal reveal-6">
            <Card>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
                    ✦ Posledných 6 mesiacov
                  </p>
                  <h2 className="font-heading text-xl text-text-primary tracking-wide">
                    Príjmy vs výdavky
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-[0.6rem] uppercase tracking-widest font-heading">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-emerald-bright rounded-sm inline-block opacity-85" />
                    <span className="text-text-secondary">Príjmy</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-crimson-bright rounded-sm inline-block opacity-85" />
                    <span className="text-text-secondary">Výdavky</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-gold-bright inline-block" />
                    <span className="text-text-secondary">Net</span>
                  </span>
                </div>
              </div>
              <IncomeExpenseBarChart data={trend} highlightMonth={summary?.month} />
            </Card>
          </div>

          <div className="reveal reveal-6 space-y-5">
            <Card>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
                ✦ Trend bilancie
              </p>
              <h3 className="font-heading text-base text-text-primary tracking-wide mb-3">
                Net cash-flow
              </h3>
              <div className="text-text-secondary">
                <Sparkline
                  values={trend.map((t) => t.net)}
                  width={300}
                  height={60}
                  color="var(--color-gold-bright)"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted">
                  Posledný mesiac
                </span>
                <span
                  className={`font-heading ${
                    (trend[trend.length - 1]?.net ?? 0) >= 0
                      ? 'text-emerald-bright'
                      : 'text-crimson-bright'
                  }`}
                >
                  {(trend[trend.length - 1]?.net ?? 0) >= 0 ? '+' : ''}
                  {eur.format(trend[trend.length - 1]?.net ?? 0)}
                </span>
              </div>
            </Card>

            <Card>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
                ✦ Top výdavky podľa banky
              </p>
              <h3 className="font-heading text-base text-text-primary tracking-wide mb-3">
                {monthLabel}
              </h3>
              <BankBreakdown summary={summary} />
            </Card>
          </div>
        </div>
      )}

      {/* Raul — Veštba z Komnaty galeónov (top of fold once user has data) */}
      {summary?.month && summary.counts.transactionsMonth > 0 && (
        <div className="mb-12 reveal reveal-6">
          <Card>
            <RaulPanel month={summary.month} />
          </Card>
        </div>
      )}

      {/* Category breakdown (current month) + Category trend (last 6 months) */}
      <CategoryDashboardSection
        monthLabel={monthLabel}
        currentMonth={summary?.month}
        catRows={catRows}
        catTrend={catTrend}
      />

      {/* Recent transactions — under the analysis sections */}
      <div className="mb-12 reveal reveal-6">
        <Card>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
                ✦ Pergamen z trezorov
              </p>
              <h2 className="font-heading text-xl text-text-primary tracking-wide">
                Posledné transakcie — {monthLabel}
              </h2>
            </div>
            <Link
              to="/banky"
              className="font-heading text-[0.6rem] uppercase tracking-widest text-gold border border-gold/30 bg-gold/10 px-2.5 py-1 rounded-[2px] hover:border-gold-bright hover:text-gold-bright transition-colors"
            >
              ⌬ Importovať
            </Link>
          </div>
          {!summary || summary.recent.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border-dim rounded-[3px]">
              <p className="text-3xl text-gold-dim mb-2">⌬</p>
              <p className="font-heading text-sm uppercase tracking-widest text-text-muted">
                {summary?.counts.transactionsTotal === 0
                  ? 'Trezor je ešte prázdny'
                  : `Žiadne transakcie v ${monthLabel}`}
              </p>
              <p className="font-ui text-xs text-text-muted italic mt-1 mb-4">
                {summary?.counts.transactionsTotal === 0
                  ? 'Naimportuj CSV/PDF výpis zo SLSP, Tatra banky alebo Revolutu'
                  : 'Skús prepnúť na iný mesiac alebo importnúť ďalší výpis'}
              </p>
              <Link
                to="/banky"
                className="inline-block font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-5 py-2 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all"
              >
                ⚡ Importovať teraz
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[3px] border border-border-dim">
              <table className="w-full font-body">
                <thead className="bg-stone/50">
                  <tr className="border-b border-border-dim">
                    <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-4 py-2.5 text-left font-normal">
                      Dátum
                    </th>
                    <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-4 py-2.5 text-left font-normal">
                      Popis
                    </th>
                    <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-4 py-2.5 text-left font-normal">
                      Banka
                    </th>
                    <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-4 py-2.5 text-right font-normal">
                      Suma
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent.map((t) => (
                    <tr key={t.id} className="border-b border-border-dim/50 hover:bg-gold/[0.02]">
                      <td className="px-4 py-2.5 text-text-secondary text-sm whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="px-4 py-2.5 text-text-primary text-sm truncate max-w-md">
                        {t.note || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-xs italic">
                        {t.bankName || '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-heading whitespace-nowrap ${
                          t.type === 'vydavok' ? 'text-crimson-bright' : 'text-emerald-bright'
                        }`}
                      >
                        {t.type === 'vydavok' ? '−' : '+'}
                        {eurExact.format(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Banks list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="reveal reveal-6 lg:col-span-1">
          <Card>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
              ✦ Trezory
            </p>
            <h2 className="font-heading text-xl text-text-primary tracking-wide mb-4">
              Tvoje banky
            </h2>
            <ul className="space-y-2">
              {BANKS.map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-3 px-3 py-2 bg-stone/50 border border-border-dim rounded-[3px]"
                >
                  <span className="text-gold/70">⚖</span>
                  <span className="font-body text-sm text-text-primary">{b}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-4 text-gold-dim font-heading text-[0.6rem] uppercase tracking-widest reveal reveal-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold-dim to-transparent" />
        <span>✦ {summary?.counts.transactionsTotal ?? 0} transakcií celkovo v trezore ✦</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold-dim to-transparent" />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// BankBreakdown — derives top spending banks from the recent tx list
// included in the dashboard summary (no extra fetch needed).
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// CategoryDashboardSection — category breakdown (current month) +
// long-term stacked category trend (last 6 months). Used on Dashboard.
// ----------------------------------------------------------------

interface CategoryDashboardProps {
  monthLabel: string
  currentMonth: string | undefined
  catRows: CategoryRow[]
  catTrend: CategoryTrend | null
}

function CategoryDashboardSection({
  monthLabel,
  currentMonth,
  catRows,
  catTrend,
}: CategoryDashboardProps) {
  // Sort + slice to top 8 for the breakdown card; rest collapses into "Iné" row
  const breakdownItems = useMemo<HBarItem[]>(() => {
    if (catRows.length === 0) return []
    const sorted = [...catRows].sort((a, b) => b.total - a.total)
    const top = sorted.slice(0, 8)
    const rest = sorted.slice(8)
    const items: HBarItem[] = top.map((c) => ({
      label: c.category,
      value: c.total,
      hint: `${c.count}×`,
    }))
    if (rest.length > 0) {
      const restTotal = rest.reduce((s, r) => s + r.total, 0)
      const restCount = rest.reduce((s, r) => s + r.count, 0)
      items.push({
        label: `+${rest.length} ďalších`,
        value: restTotal,
        hint: `${restCount}×`,
      })
    }
    return items
  }, [catRows])

  const totalSpend = catRows.reduce((s, c) => s + c.total, 0)

  return (
    <div className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Long-term stacked trend */}
      <div className="lg:col-span-2 reveal reveal-6">
        <Card>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
                ✦ Posledných 6 mesiacov · podľa kategórií
              </p>
              <h2 className="font-heading text-xl text-text-primary tracking-wide">
                Kam tečú galeóny
              </h2>
            </div>
            {catTrend && catTrend.categories.length > 0 && (
              <CategoryLegend categories={catTrend.categories} />
            )}
          </div>
          {catTrend && catTrend.points.length > 0 ? (
            <CategoryTrendChart
              data={catTrend.points}
              categories={catTrend.categories}
              highlightMonth={currentMonth}
            />
          ) : (
            <p className="font-ui italic text-text-muted text-sm py-6 text-center">
              Naimportuj viac mesiacov a uvidíš dlhodobý trend.
            </p>
          )}
        </Card>
      </div>

      {/* Current-month category breakdown */}
      <div className="reveal reveal-6">
        <Card>
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <div>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
                ✦ Kniha výdavkov
              </p>
              <h3 className="font-heading text-base text-text-primary tracking-wide">
                Kategórie · {monthLabel}
              </h3>
            </div>
            {totalSpend > 0 && (
              <span className="font-heading text-[0.6rem] uppercase tracking-widest text-crimson-bright whitespace-nowrap">
                −{eur.format(totalSpend)}
              </span>
            )}
          </div>
          {breakdownItems.length === 0 ? (
            <p className="font-ui italic text-text-muted text-sm py-3">
              Žiadne výdavky v {monthLabel}.
            </p>
          ) : (
            <HorizontalBars items={breakdownItems} tone="crimson" />
          )}
          <p className="mt-4 font-ui text-[0.7rem] italic text-text-muted">
            Top 8 kategórií. Ostatné sa zlejú do „+ N ďalších".
          </p>
        </Card>
      </div>
    </div>
  )
}

function BankBreakdown({ summary }: { summary: Summary | null }) {
  if (!summary) return null
  const map = new Map<string, number>()
  for (const t of summary.recent) {
    if (t.type !== 'vydavok') continue
    const key = t.bankName ?? 'Iné'
    map.set(key, (map.get(key) ?? 0) + t.amount)
  }
  const items: HBarItem[] = [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  if (items.length === 0) {
    return (
      <p className="font-ui italic text-text-muted text-sm py-3">
        Žiadne výdavky v {formatMonth(summary.month)}.
      </p>
    )
  }
  return <HorizontalBars items={items} tone="crimson" />
}
