import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { MonthPicker, formatMonth } from '../components/ui/MonthPicker'
import { CategorizeButton } from '../components/ui/AIButtons'
import { CategorySelect } from '../components/ui/CategorySelect'
import { apiFetch } from '../utils/api'

type TxType = 'prijem' | 'vydavok'

interface Transaction {
  id: number
  date: string
  type: TxType
  category: string
  amount: number
  bankId: number | null
  note: string | null
  categorizedBy?: 'system' | 'ai' | 'user'
  aiConfidence?: number | null
  merchant?: string | null
}

// Categories are now dynamic — fetched from /api/ai/categories per user.
// This list is the static fallback if the API call fails.
const FALLBACK_CATEGORIES = ['Potraviny', 'Reštaurácie', 'Tankovanie', 'Iné', 'Nezaradené']

interface Bank {
  id: number
  name: string
}

const eur = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
})

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  type: TxType
}

const COPY: Record<
  TxType,
  {
    title: string
    accent: string
    eyebrow: string
    quote: string
    icon: string
    sumLabel: string
    emptyTitle: string
    emptyHint: string
    rowClass: string
    sign: string
  }
> = {
  prijem: {
    title: 'Príjmy',
    accent: 'text-emerald-bright',
    eyebrow: '✦ Prílevy do trezora ✦',
    quote: '„Galeóny prichádzajú — niekedy."',
    icon: '⚜',
    sumLabel: 'Spolu prijaté',
    emptyTitle: 'Žiadne príjmy v tomto mesiaci',
    emptyHint: 'Importuj výpis alebo skús iný mesiac',
    rowClass: 'text-emerald-bright',
    sign: '+',
  },
  vydavok: {
    title: 'Výdavky',
    accent: 'text-crimson-bright',
    eyebrow: '✦ Tu rozjebávaš lóve ✦',
    quote: '„Galeóny mizú rýchlejšie ako Houdini."',
    icon: '☥',
    sumLabel: 'Spolu minuté',
    emptyTitle: 'Žiadne výdavky v tomto mesiaci',
    emptyHint: 'Importuj výpis alebo skús iný mesiac',
    rowClass: 'text-crimson-bright',
    sign: '−',
  },
}

export function TransactionsPage({ type }: Props) {
  const copy = COPY[type]
  const [month, setMonth] = useState<string>(currentYearMonth())
  const [months, setMonths] = useState<string[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load type-scoped category list (combobox source). Refetch when the page
  // type changes so výdavky and príjmy each see their own číselník.
  useEffect(() => {
    apiFetch<{ categories: string[] }>(`/api/categories?type=${type}`).then((res) => {
      if (res.ok && res.data.categories.length > 0) setCategories(res.data.categories)
    })
  }, [type])

  const load = useCallback(
    async (m: string) => {
      setLoading(true)
      setError(null)
      const [monthsRes, banksRes, txRes] = await Promise.all([
        apiFetch<string[]>('/api/months'),
        apiFetch<Bank[]>('/api/banks'),
        apiFetch<Transaction[]>(
          `/api/transactions?type=${type}&month=${encodeURIComponent(m)}&limit=2000`,
        ),
      ])
      if (monthsRes.ok) setMonths(monthsRes.data)
      if (banksRes.ok) setBanks(banksRes.data)
      if (txRes.ok) setTxs(txRes.data)
      else setError(txRes.error)
      setLoading(false)
    },
    [type],
  )

  useEffect(() => {
    load(month)
  }, [month, load])

  // If the chosen month has no data and there ARE months with data, jump to the most recent
  useEffect(() => {
    if (!loading && txs.length === 0 && months.length > 0 && !months.includes(month)) {
      setMonth(months[0])
    }
  }, [loading, txs.length, months, month])

  const bankName = useMemo(() => {
    const map = new Map<number, string>()
    for (const b of banks) map.set(b.id, b.name)
    return (id: number | null) => (id != null ? map.get(id) ?? '—' : '—')
  }, [banks])

  const groupedByBank = useMemo(() => {
    const out = new Map<string, { name: string; total: number; count: number }>()
    for (const t of txs) {
      const name = bankName(t.bankId)
      const cur = out.get(name) ?? { name, total: 0, count: 0 }
      cur.total += t.amount
      cur.count += 1
      out.set(name, cur)
    }
    return [...out.values()].sort((a, b) => b.total - a.total)
  }, [txs, bankName])

  const total = txs.reduce((s, t) => s + t.amount, 0)
  const monthLabel = formatMonth(month)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 reveal reveal-1 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.3em] text-gold mb-2">
            {copy.eyebrow}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_40px_rgba(201,151,42,0.3)]">
            {copy.title} <span className="text-gold-bright">/ {monthLabel}</span>
          </h1>
          <p className="font-body italic text-text-secondary mt-2 text-base">{copy.quote}</p>
        </div>
        <MonthPicker month={month} months={months} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-6 bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-5 py-4 reveal">
          <p className="font-body text-sm text-text-secondary">{error}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="reveal reveal-2">
          <Card>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
              {copy.sumLabel}
            </p>
            <p
              className={`font-display text-3xl ${copy.accent} mt-2 [text-shadow:0_0_24px_rgba(201,151,42,0.25)]`}
            >
              {copy.sign}
              {eur.format(total)}
            </p>
            <p className="font-ui text-xs text-text-muted italic mt-2">{txs.length} pohybov</p>
          </Card>
        </div>
        <div className="md:col-span-2 reveal reveal-3">
          <Card>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-3">
              Podľa bánk
            </p>
            {groupedByBank.length === 0 ? (
              <p className="font-ui italic text-text-muted text-sm">—</p>
            ) : (
              <div className="space-y-2">
                {groupedByBank.map((g) => {
                  const pct = total > 0 ? Math.round((g.total / total) * 100) : 0
                  return (
                    <div key={g.name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-heading text-text-primary tracking-wide">
                          {g.name}
                          <span className="font-ui text-xs text-text-muted italic ml-2">
                            {g.count} pohybov
                          </span>
                        </span>
                        <span className={`font-heading ${copy.accent}`}>
                          {copy.sign}
                          {eur.format(g.total)}{' '}
                          <span className="text-text-muted text-xs">{pct}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-stone/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r from-gold-dim via-gold to-gold-bright`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* List */}
      <div className="reveal reveal-4">
        <Card>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-heading text-xl text-text-primary tracking-wide">
              Všetky pohyby
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {type === 'vydavok' && (
                <>
                  <CategorizeButton onDone={() => load(month)} />
                  <CategorizeButton
                    force
                    variant="secondary"
                    onDone={() => load(month)}
                  />
                </>
              )}
              <Link
                to="/banky"
                className="font-heading text-[0.6rem] uppercase tracking-widest text-gold border border-gold/30 bg-gold/10 px-2.5 py-1 rounded-[2px] hover:border-gold-bright hover:text-gold-bright transition-colors"
              >
                ⌬ Importovať
              </Link>
            </div>
          </div>

          {loading ? (
            <p className="font-heading text-sm uppercase tracking-widest text-gold flicker py-10 text-center">
              ✦ Listujem v pergamenoch ✦
            </p>
          ) : txs.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border-dim rounded-[3px]">
              <p className="text-3xl text-gold-dim mb-2">{copy.icon}</p>
              <p className="font-heading text-sm uppercase tracking-widest text-text-muted">
                {copy.emptyTitle}
              </p>
              <p className="font-ui text-xs text-text-muted italic mt-1">{copy.emptyHint}</p>
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
                      Kategória
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
                  {txs.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border-dim/50 hover:bg-gold/[0.02]"
                    >
                      <td className="px-4 py-2.5 text-text-secondary text-sm whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="px-4 py-2.5 text-text-primary text-sm max-w-xs">
                        {t.merchant ? (
                          <>
                            <span className="block font-heading text-text-primary truncate">
                              {t.merchant}
                            </span>
                            <span
                              className="block font-ui italic text-[10px] text-text-muted truncate mt-0.5"
                              title={t.note ?? ''}
                            >
                              {t.note || '—'}
                            </span>
                          </>
                        ) : (
                          <span className="block truncate">{t.note || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary text-sm">
                        <CategorySelect
                          tx={t}
                          options={categories}
                          onChange={(newCat) => {
                            // Optimistically add new category to suggestions
                            if (newCat && !categories.some((c) => c.toLowerCase() === newCat.toLowerCase())) {
                              setCategories([newCat, ...categories])
                            }
                            load(month)
                          }}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-xs italic">
                        {bankName(t.bankId)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-heading whitespace-nowrap ${copy.rowClass}`}
                      >
                        {copy.sign}
                        {eur.format(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

