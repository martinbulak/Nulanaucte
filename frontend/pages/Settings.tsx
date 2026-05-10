import { useEffect, useState, FormEvent } from 'react'
import { Card } from '../components/ui/Card'
import { apiFetch } from '../utils/api'

interface Me {
  id: number
  email: string
  name: string | null
  role: 'user' | 'admin'
  emailVerified: boolean
  reportFrequency: 'weekly' | 'monthly' | 'off'
  emailNotifications: boolean
}

const INPUT_CLASS =
  'w-full font-body text-base text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim border-b-border rounded-t-[3px] px-4 py-3 outline-none focus:border-gold-dim focus:[box-shadow:0_2px_0_var(--color-gold),0_0_24px_rgba(201,151,42,0.1)] transition-all duration-300'

const PRIMARY_BTN =
  'font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 disabled:opacity-50'

const GHOST_BTN =
  'font-heading text-xs uppercase tracking-widest text-gold border border-border px-6 py-2.5 rounded-[3px] hover:border-gold hover:bg-gold/5 transition-all'

export function Settings() {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    const res = await apiFetch<Me>('/api/auth/me')
    if (res.ok) setMe(res.data)
    else setErr(res.error)
  }
  useEffect(() => {
    load()
  }, [])

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto">
        {err ? (
          <p className="font-body text-crimson-bright">{err}</p>
        ) : (
          <p className="font-heading text-sm uppercase tracking-widest text-gold flicker">
            ✦ Načítavam… ✦
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="reveal reveal-1">
        <p className="font-heading text-xs uppercase tracking-[0.3em] text-gold mb-2">
          ✦ Komnata nastavení ✦
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_40px_rgba(201,151,42,0.3)]">
          <span className="text-gold-bright">Nastavenia</span>
        </h1>
        <p className="font-body italic text-text-secondary mt-2">
          Tvoj profil, heslo a citlivé veci
        </p>
      </div>

      <ProfileSection me={me} onChange={load} />
      <PasswordSection />
      <DataSection />
      <DangerSection />
    </div>
  )
}

// ---------------- Profile ----------------

function ProfileSection({ me, onChange }: { me: Me; onChange: () => void }) {
  const [name, setName] = useState(me.name ?? '')
  const [reportFrequency, setReportFrequency] = useState(me.reportFrequency)
  const [emailNotifications, setEmailNotifications] = useState(me.emailNotifications)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    const res = await apiFetch('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name: name || null, reportFrequency, emailNotifications }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg('✓ Uložené')
      onChange()
    } else {
      setMsg(res.error)
    }
  }

  return (
    <div className="reveal reveal-2">
      <Card>
        <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
          ✦ Profil
        </p>
        <h2 className="font-heading text-xl text-text-primary tracking-wide mb-4">
          Tvoje údaje
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              disabled
              value={me.email}
              className={`${INPUT_CLASS} opacity-60 cursor-not-allowed`}
            />
            <p className="font-ui text-xs text-text-muted italic mt-1">
              {me.emailVerified ? '✓ overený' : '⚠ neoverený — skontroluj schránku'}
            </p>
          </Field>

          <Field label="Meno (zobrazované)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tvoje meno alebo prezývka"
              className={INPUT_CLASS}
              maxLength={80}
            />
          </Field>

          <Field label="Frekvencia email reportov">
            <div className="flex gap-2 flex-wrap">
              {(['weekly', 'monthly', 'off'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setReportFrequency(opt)}
                  className={[
                    'font-heading text-xs uppercase tracking-widest px-4 py-2 rounded-[3px] border transition-all',
                    reportFrequency === opt
                      ? 'bg-gold/15 border-gold text-gold-bright'
                      : 'bg-stone/50 border-border-dim text-text-secondary hover:border-gold-dim',
                  ].join(' ')}
                >
                  {opt === 'weekly' ? 'Týždenne' : opt === 'monthly' ? 'Mesačne' : 'Vypnuté'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Email notifikácie">
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 accent-gold"
              />
              <span className="font-body text-sm text-text-secondary">
                Posielať mi notifikácie (verifikácia, reset hesla, reporty)
              </span>
            </label>
          </Field>

          <div className="flex items-center justify-between gap-4 pt-2">
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>
              {saving ? '✦ Ukladám… ✦' : '⚡ Uložiť'}
            </button>
            {msg && (
              <span className={`font-ui text-sm italic ${msg.startsWith('✓') ? 'text-emerald-bright' : 'text-crimson-bright'}`}>
                {msg}
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

// ---------------- Password ----------------

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next !== confirm) {
      setMsg('Heslá sa nezhodujú')
      return
    }
    setSaving(true)
    const res = await apiFetch<{ mustReLogin: boolean }>('/api/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    setSaving(false)
    if (res.ok) {
      // Sessions invalidated — redirect to login
      window.location.href = '/login'
    } else {
      setMsg(res.error)
    }
  }

  return (
    <div className="reveal reveal-3">
      <Card>
        <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
          ✦ Bezpečnosť
        </p>
        <h2 className="font-heading text-xl text-text-primary tracking-wide mb-4">
          Zmena hesla
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Súčasné heslo">
            <input
              type="password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={INPUT_CLASS}
              autoComplete="current-password"
            />
          </Field>
          <Field label="Nové heslo">
            <input
              type="password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={INPUT_CLASS}
              autoComplete="new-password"
              minLength={12}
              placeholder="aspoň 12 znakov + číslica/symbol"
            />
          </Field>
          <Field label="Zopakuj nové heslo">
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT_CLASS}
              autoComplete="new-password"
            />
          </Field>
          <p className="font-ui text-xs text-text-muted italic">
            Po zmene budeš automaticky odhlásený zo všetkých zariadení.
          </p>
          <div className="flex items-center justify-between gap-4 pt-2">
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>
              {saving ? '✦ Mením heslo… ✦' : '🔑 Zmeniť heslo'}
            </button>
            {msg && (
              <span className="font-ui text-sm italic text-crimson-bright">{msg}</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

// ---------------- Data export ----------------

function DataSection() {
  return (
    <div className="reveal reveal-4">
      <Card>
        <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
          ✦ Tvoje dáta
        </p>
        <h2 className="font-heading text-xl text-text-primary tracking-wide mb-4">
          Export (GDPR)
        </h2>
        <p className="font-body text-sm text-text-secondary mb-4">
          Stiahni si JSON s úplnou kópiou tvojich dát: profil, banky, transakcie,
          hypotéky a príjmy. Bez šifrovania, takže súbor uchovávaj opatrne.
        </p>
        <a
          href="/api/user/export"
          download
          className={`${GHOST_BTN} inline-block`}
        >
          📦 Stiahnuť moje dáta
        </a>
      </Card>
    </div>
  )
}

// ---------------- Danger zone ----------------

function DangerSection() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onDelete(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const res = await apiFetch('/api/user', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: confirmText, password }),
    })
    setBusy(false)
    if (res.ok) {
      window.location.href = '/login'
    } else {
      setErr(res.error)
    }
  }

  return (
    <div className="reveal reveal-5">
      <Card className="border-crimson/40">
        <p className="font-heading text-[0.65rem] uppercase tracking-widest text-crimson-bright mb-1">
          ⌫ Nebezpečná zóna
        </p>
        <h2 className="font-heading text-xl text-text-primary tracking-wide mb-2">
          Vymazať účet
        </h2>
        <p className="font-body text-sm text-text-secondary mb-4">
          Vymaže <strong>všetko</strong> — profil, banky, transakcie, hypotéky.
          Toto sa <strong>nedá vrátiť</strong>. Pred zmazaním si stiahni export.
        </p>

        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="font-heading text-xs uppercase tracking-widest text-crimson-bright border border-crimson/40 bg-crimson/5 px-6 py-2.5 rounded-[3px] hover:border-crimson-bright hover:bg-crimson/15 transition-all"
          >
            ⌫ Chcem zmazať svoj účet
          </button>
        ) : (
          <form onSubmit={onDelete} className="space-y-4 mt-4 pt-4 border-t border-crimson/20">
            <Field label='Napíš "VYMAZAT" pre potvrdenie'>
              <input
                type="text"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="VYMAZAT"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Tvoje súčasné heslo">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_CLASS}
                autoComplete="current-password"
              />
            </Field>
            {err && (
              <p className="font-body text-sm text-crimson-bright">{err}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy || confirmText !== 'VYMAZAT'}
                className="font-heading text-xs uppercase tracking-widest text-crimson-bright bg-crimson/10 border border-crimson-bright px-6 py-2.5 rounded-[3px] hover:bg-crimson/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? '✦ Mažem… ✦' : '⚡ Definitívne vymazať'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={GHOST_BTN}>
                Zrušiť
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

// ---------------- helpers ----------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-ui text-sm uppercase tracking-widest text-text-muted block">
        {label}
      </label>
      {children}
    </div>
  )
}
