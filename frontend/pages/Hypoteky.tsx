import { useEffect, useState, FormEvent } from 'react'
import { Card } from '../components/ui/Card'
import { apiFetch } from '../utils/api'

interface Mortgage {
  id: number
  propertyName: string
  bank: string
  totalAmount: number
  remaining: number
  monthlyPayment: number
  interestRate: number | null
  startDate: string | null
  endDate: string | null
}

interface MortgageFormState {
  propertyName: string
  bank: string
  totalAmount: string
  remaining: string
  monthlyPayment: string
  interestRate: string
  startDate: string
  endDate: string
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

const BANK_PRESETS = ['Tatra banka', 'Slovenská sporiteľňa', 'SLSP — kreditná karta', 'VÚB', 'mBank', 'Iné']

const BLANK: MortgageFormState = {
  propertyName: '',
  bank: '',
  totalAmount: '',
  remaining: '',
  monthlyPayment: '',
  interestRate: '',
  startDate: '',
  endDate: '',
}

function toForm(m: Mortgage): MortgageFormState {
  return {
    propertyName: m.propertyName,
    bank: m.bank,
    totalAmount: String(m.totalAmount),
    remaining: String(m.remaining),
    monthlyPayment: String(m.monthlyPayment),
    interestRate: m.interestRate != null ? String(m.interestRate) : '',
    startDate: m.startDate ?? '',
    endDate: m.endDate ?? '',
  }
}

function toPayload(f: MortgageFormState) {
  return {
    propertyName: f.propertyName.trim(),
    bank: f.bank.trim(),
    totalAmount: parseFloat(f.totalAmount.replace(',', '.')),
    remaining: parseFloat(f.remaining.replace(',', '.')),
    monthlyPayment: parseFloat(f.monthlyPayment.replace(',', '.')),
    interestRate: f.interestRate.trim()
      ? parseFloat(f.interestRate.replace(',', '.'))
      : null,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
  }
}

export function Hypoteky() {
  const [mortgages, setMortgages] = useState<Mortgage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Mortgage | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Mortgage | null>(null)

  async function load() {
    setLoading(true)
    const res = await apiFetch<Mortgage[]>('/api/mortgages')
    if (res.ok) setMortgages(res.data)
    else setError(res.error)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const totalRemaining = mortgages.reduce((s, m) => s + m.remaining, 0)
  const totalMonthly = mortgages.reduce((s, m) => s + m.monthlyPayment, 0)
  const totalAmountAll = mortgages.reduce((s, m) => s + m.totalAmount, 0)
  const paidAll = totalAmountAll - totalRemaining

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 reveal reveal-1 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.3em] text-gold mb-2">
            ✦ Bremená trezora ✦
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_40px_rgba(201,151,42,0.3)]">
            Hypotéky <span className="text-gold-bright">a úvery</span>
          </h1>
          <p className="font-body italic text-text-secondary mt-2 text-base">
            „Banka ti požičia dáždnik, len keď neprší."
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200"
        >
          ⚡ Pridať hypotéku
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-5 py-4 reveal">
          <p className="font-body text-sm text-text-secondary">{error}</p>
        </div>
      )}

      {/* Summary */}
      {mortgages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="reveal reveal-2">
            <Card>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
                Celkový zostatok
              </p>
              <p className="font-display text-3xl text-crimson-bright mt-2 [text-shadow:0_0_24px_rgba(192,57,43,0.25)]">
                {eur.format(totalRemaining)}
              </p>
              <p className="font-ui text-xs text-text-muted italic mt-2">
                z pôvodných {eur.format(totalAmountAll)}
              </p>
            </Card>
          </div>
          <div className="reveal reveal-3">
            <Card>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
                Splátky / mesiac
              </p>
              <p className="font-display text-3xl text-cobalt-bright mt-2 [text-shadow:0_0_24px_rgba(26,74,156,0.25)]">
                {eur.format(totalMonthly)}
              </p>
              <p className="font-ui text-xs text-text-muted italic mt-2">{mortgages.length} úverov</p>
            </Card>
          </div>
          <div className="reveal reveal-4">
            <Card>
              <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
                Splatené
              </p>
              <p className="font-display text-3xl text-emerald-bright mt-2 [text-shadow:0_0_24px_rgba(26,107,58,0.25)]">
                {eur.format(paidAll)}
              </p>
              <p className="font-ui text-xs text-text-muted italic mt-2">
                {totalAmountAll > 0 ? Math.round((paidAll / totalAmountAll) * 100) : 0}% dlhu preč
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="font-heading text-sm uppercase tracking-widest text-gold flicker py-10 text-center">
          ✦ Otváram knihu dlhov ✦
        </p>
      ) : mortgages.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-4xl text-gold-dim mb-3">⚱</p>
            <p className="font-heading text-sm uppercase tracking-widest text-text-muted mb-2">
              Žiadne hypotéky
            </p>
            <p className="font-ui text-sm italic text-text-muted mb-6">
              Pridaj svoju prvú a uvidíš koľko ti zostáva splatiť.
            </p>
            <button
              onClick={() => setEditing('new')}
              className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200"
            >
              ⚡ Pridať hypotéku
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {mortgages.map((m, i) => {
            const paid = m.totalAmount - m.remaining
            const pct = m.totalAmount > 0 ? Math.round((paid / m.totalAmount) * 100) : 0
            const monthsLeft =
              m.monthlyPayment > 0 ? Math.ceil(m.remaining / m.monthlyPayment) : null
            return (
              <div key={m.id} className={`reveal reveal-${Math.min(6, i + 2)}`}>
                <Card>
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                      <h3 className="font-heading text-xl text-text-primary tracking-wide truncate">
                        {m.propertyName}
                      </h3>
                      <p className="font-ui text-xs text-text-muted italic">{m.bank}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-3">
                      <button
                        onClick={() => setEditing(m)}
                        className="font-heading text-[0.6rem] uppercase tracking-widest text-gold border border-border px-2 py-1 rounded-[2px] hover:border-gold hover:bg-gold/5 transition-colors"
                      >
                        Upraviť
                      </button>
                      <button
                        onClick={() => setConfirmDelete(m)}
                        className="font-heading text-[0.6rem] uppercase tracking-widest text-crimson-bright border border-crimson/30 px-2 py-1 rounded-[2px] hover:border-crimson-bright hover:bg-crimson/5 transition-colors"
                      >
                        ⌫
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
                        Splatenie
                      </span>
                      <span className="font-heading text-sm text-gold-bright">{pct}%</span>
                    </div>
                    <div className="h-2 bg-stone/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald via-emerald-bright to-gold-bright transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-ui mt-1.5">
                      <span className="text-emerald-bright">
                        Splatené {eur.format(paid)}
                      </span>
                      <span className="text-crimson-bright">
                        Zostáva {eur.format(m.remaining)}
                      </span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-stone/40 border border-border-dim rounded-[3px] px-3 py-2">
                      <p className="font-heading text-[0.55rem] uppercase tracking-widest text-text-muted">
                        Mesačná splátka
                      </p>
                      <p className="font-heading text-text-primary mt-1">
                        {eurExact.format(m.monthlyPayment)}
                      </p>
                    </div>
                    <div className="bg-stone/40 border border-border-dim rounded-[3px] px-3 py-2">
                      <p className="font-heading text-[0.55rem] uppercase tracking-widest text-text-muted">
                        Úrok p. a.
                      </p>
                      <p className="font-heading text-text-primary mt-1">
                        {m.interestRate != null ? `${m.interestRate.toFixed(2)} %` : '—'}
                      </p>
                    </div>
                    <div className="bg-stone/40 border border-border-dim rounded-[3px] px-3 py-2">
                      <p className="font-heading text-[0.55rem] uppercase tracking-widest text-text-muted">
                        Pôvodná suma
                      </p>
                      <p className="font-heading text-text-primary mt-1">
                        {eur.format(m.totalAmount)}
                      </p>
                    </div>
                    <div className="bg-stone/40 border border-border-dim rounded-[3px] px-3 py-2">
                      <p className="font-heading text-[0.55rem] uppercase tracking-widest text-text-muted">
                        Zostáva mesiacov
                      </p>
                      <p className="font-heading text-text-primary mt-1">
                        {monthsLeft != null
                          ? `~${monthsLeft} (${(monthsLeft / 12).toFixed(1)} r.)`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {(m.startDate || m.endDate) && (
                    <p className="font-ui text-xs text-text-muted italic mt-3">
                      {m.startDate && `od ${m.startDate}`}
                      {m.startDate && m.endDate && ' · '}
                      {m.endDate && `do ${m.endDate}`}
                    </p>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit / new modal */}
      {editing && (
        <MortgageFormModal
          mortgage={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <DeleteConfirm
          mortgage={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onDone={() => {
            setConfirmDelete(null)
            load()
          }}
        />
      )}
    </div>
  )
}

interface FormModalProps {
  mortgage: Mortgage | null
  onClose: () => void
  onSaved: () => void
}

function MortgageFormModal({ mortgage, onClose, onSaved }: FormModalProps) {
  const [form, setForm] = useState<MortgageFormState>(
    mortgage ? toForm(mortgage) : BLANK,
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function update<K extends keyof MortgageFormState>(key: K, value: MortgageFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    const path = mortgage ? `/api/mortgages/${mortgage.id}` : '/api/mortgages'
    const method = mortgage ? 'PATCH' : 'POST'
    const res = await apiFetch(path, {
      method,
      body: JSON.stringify(toPayload(form)),
    })
    setSaving(false)
    if (res.ok) onSaved()
    else setErr(res.error)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-obsidian border border-border rounded-[4px] max-w-2xl w-full my-8 [box-shadow:0_8px_60px_rgba(0,0,0,0.8),0_0_60px_rgba(201,151,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-[6px] border border-gold/[0.06] rounded-[2px] pointer-events-none" />
        <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
        <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>

        <form onSubmit={onSubmit} className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-heading text-[0.65rem] uppercase tracking-[0.3em] text-gold mb-1">
                ✦ {mortgage ? 'Úprava bremena' : 'Nové bremeno'}
              </p>
              <h2 className="font-heading text-2xl text-text-primary tracking-wide">
                {mortgage ? mortgage.propertyName : 'Pridať hypotéku'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-heading text-xs uppercase tracking-widest text-text-muted hover:text-crimson-bright transition-colors px-2 py-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Názov nehnuteľnosti / úveru" required>
              <input
                type="text"
                required
                value={form.propertyName}
                onChange={(e) => update('propertyName', e.target.value)}
                placeholder="Byt Bratislava / Hypotéka I."
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Banka" required>
              <input
                type="text"
                required
                value={form.bank}
                onChange={(e) => update('bank', e.target.value)}
                list="bank-presets"
                placeholder="Tatra banka"
                className={INPUT_CLASS}
              />
              <datalist id="bank-presets">
                {BANK_PRESETS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>

            <Field label="Pôvodná suma (€)" required>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={form.totalAmount}
                onChange={(e) => update('totalAmount', e.target.value)}
                placeholder="120000"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Aktuálny zostatok (€)" required>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={form.remaining}
                onChange={(e) => update('remaining', e.target.value)}
                placeholder="98500"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Mesačná splátka (€)" required>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={form.monthlyPayment}
                onChange={(e) => update('monthlyPayment', e.target.value)}
                placeholder="450"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Úroková sadzba (% p.a.)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.interestRate}
                onChange={(e) => update('interestRate', e.target.value)}
                placeholder="3.5"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Začiatok">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Splatnosť">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          {err && (
            <div className="mt-5 bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3">
              <p className="font-body text-sm text-text-secondary">{err}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="font-heading text-xs uppercase tracking-widest text-gold border border-border px-6 py-2.5 rounded-[3px] hover:border-gold hover:bg-gold/5 transition-all"
            >
              Zrušiť
            </button>
            <button
              type="submit"
              disabled={saving}
              className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {saving ? '✦ Zapečaťujem… ✦' : mortgage ? '⚡ Uložiť zmeny' : '⚡ Pridať'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const INPUT_CLASS =
  'w-full font-body text-base text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim border-b-border rounded-t-[3px] px-3 py-2.5 outline-none focus:border-gold-dim focus:[box-shadow:0_2px_0_var(--color-gold),0_0_24px_rgba(201,151,42,0.1)] transition-all duration-300'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="font-ui text-sm uppercase tracking-widest text-text-muted block">
        {label} {required && <span className="text-crimson-bright">*</span>}
      </label>
      {children}
    </div>
  )
}

function DeleteConfirm({
  mortgage,
  onClose,
  onDone,
}: {
  mortgage: Mortgage
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function doDelete() {
    setBusy(true)
    const res = await apiFetch(`/api/mortgages/${mortgage.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) onDone()
    else setErr(res.error)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-obsidian border border-crimson/40 rounded-[4px] max-w-md w-full p-8 text-center [box-shadow:0_8px_60px_rgba(0,0,0,0.8),0_0_60px_rgba(192,57,43,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-5xl text-crimson-bright mb-4">⌫</p>
        <h2 className="font-heading text-xl text-crimson-bright tracking-wide uppercase mb-2">
          Vymazať bremeno?
        </h2>
        <p className="font-body text-text-secondary mb-1">
          Vymažem <span className="text-text-primary font-heading">{mortgage.propertyName}</span>{' '}
          ({mortgage.bank}).
        </p>
        <p className="font-ui italic text-sm text-text-muted mb-6">Toto sa nedá vrátiť.</p>
        {err && <p className="font-body text-sm text-crimson-bright mb-4">{err}</p>}
        <div className="flex justify-center gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="font-heading text-xs uppercase tracking-widest text-gold border border-border px-6 py-2.5 rounded-[3px] hover:border-gold hover:bg-gold/5 transition-all disabled:opacity-50"
          >
            Zrušiť
          </button>
          <button
            onClick={doDelete}
            disabled={busy}
            className="font-heading text-xs uppercase tracking-widest text-crimson-bright bg-crimson/10 border border-crimson-bright px-6 py-2.5 rounded-[3px] hover:bg-crimson/20 transition-all disabled:opacity-50"
          >
            {busy ? 'Mažem…' : '⚡ Vymazať'}
          </button>
        </div>
      </div>
    </div>
  )
}
