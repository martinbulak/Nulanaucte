import { useEffect, useState } from 'react'
import { Card } from './Card'
import { apiFetch } from '../../utils/api'

interface InboundData {
  address: string
  slug: string
  token: string
  domain: string
  configured: boolean
}

const GUIDES: Array<{
  bank: string
  icon: string
  steps: string[]
}> = [
  {
    bank: 'Slovenská sporiteľňa (George)',
    icon: '⚖',
    steps: [
      'Prihlás sa do George (online.slsp.sk)',
      'Vpravo hore klikni na svoj profil → Nastavenia',
      'Sekcia "Mesačný výpis" alebo "Notifikácie"',
      'Zmeň notifikačný email na adresu nižšie a ulož',
      '(Voliteľné) Aktivuj "Mesačný výpis cez email"',
    ],
  },
  {
    bank: 'Tatra banka',
    icon: '⚱',
    steps: [
      'Prihlás sa do Internet bankingu Tatra banky',
      'Nastavenia → Komunikácia → Email pre výpisy',
      'Vlož adresu nižšie, potvrď SMS kódom',
      'Aktivuj zasielanie mesačných výpisov vo formáte PDF',
    ],
  },
  {
    bank: 'Revolut',
    icon: '◊',
    steps: [
      'Revolut nepodporuje zmenu emailu — použi Gmail filter',
      'V Gmaili: Settings → Filters → Create new filter',
      'From: no-reply@revolut.com',
      'Action: Forward to (adresa nižšie) + Skip Inbox',
      'Klik Create filter — hotovo',
    ],
  },
]

const SOURCE_TONE: Record<string, string> = {
  '⚖': 'text-gold-bright',
  '⚱': 'text-cobalt-bright',
  '◊': 'text-crimson-bright',
}

export function InboundEmailWidget() {
  const [data, setData] = useState<InboundData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [openGuide, setOpenGuide] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await apiFetch<InboundData>('/api/user/inbound')
    if (res.ok) setData(res.data)
    else setErr(res.error)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function copy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input
    }
  }

  async function regenerate() {
    setConfirmRegen(false)
    const res = await apiFetch<InboundData>('/api/user/inbound/regenerate', {
      method: 'POST',
    })
    if (res.ok) setData(res.data)
    else setErr(res.error)
  }

  if (loading) {
    return (
      <Card>
        <p className="font-heading text-sm uppercase tracking-widest text-gold flicker py-4 text-center">
          ✦ Načítavam adresu sovy ✦
        </p>
      </Card>
    )
  }

  if (err || !data) {
    return (
      <Card>
        <p className="font-body text-sm text-crimson-bright">{err ?? 'Nepodarilo sa načítať'}</p>
      </Card>
    )
  }

  // Audit L5 — defensive runtime regex on slug/token before render. The server
  // generates these from a fixed alphabet, but if anything ever lets a custom
  // string through, this trips before XSS becomes possible.
  if (!/^[a-z0-9-]{1,32}$/i.test(data.slug) || !/^[a-z0-9]{1,64}$/i.test(data.token)) {
    return (
      <Card>
        <p className="font-body text-sm text-crimson-bright">
          Neplatná štruktúra inbound adresy — odhlás sa a prihlás znova.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-heading text-[0.65rem] uppercase tracking-widest text-gold mb-1">
            ✦ Sova s výpismi ✦
          </p>
          <h2 className="font-heading text-xl text-text-primary tracking-wide">
            Automatický import cez email
          </h2>
          <p className="font-ui text-xs text-text-muted italic mt-1">
            Pošli výpis na túto adresu — appka ho zaparsuje sama.
          </p>
        </div>
        {!data.configured && (
          <span
            className="font-heading text-[0.6rem] uppercase tracking-widest text-crimson-bright bg-crimson/10 border border-crimson/30 px-2 py-1 rounded-[2px]"
            title="Doména ešte nie je naviazaná v Resend"
          >
            ⚠ Pred deployom
          </span>
        )}
      </div>

      {/* Address row */}
      <div className="flex items-stretch gap-2 mb-4">
        <div className="flex-1 min-w-0 bg-stone/60 border border-border-dim rounded-[3px] px-4 py-3 font-body text-text-primary text-sm overflow-hidden">
          <span className="block truncate select-all">{data.address}</span>
        </div>
        <button
          onClick={copy}
          className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-4 py-3 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 shrink-0"
        >
          {copied ? '✦ Skopírované' : '⎘ Kopírovať'}
        </button>
      </div>

      {!data.configured && (
        <div className="mb-4 bg-stone/50 border border-border-dim border-l-[3px] border-l-gold-dim rounded-[3px] px-4 py-3">
          <p className="font-heading text-[0.6rem] uppercase tracking-widest text-gold-dim mb-1">
            Dev režim
          </p>
          <p className="font-body text-sm text-text-secondary">
            Doména <code className="font-mono text-xs text-gold">{data.domain}</code> ešte nie je
            zaregistrovaná v Resend. Pri deploye nastav <code className="font-mono text-xs text-gold">INBOUND_DOMAIN</code> a MX recordy → adresa začne fungovať.
          </p>
        </div>
      )}

      {/* Setup guides */}
      <div className="space-y-2">
        <p className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted mb-2">
          Návod ako prepnúť email v banke
        </p>
        {GUIDES.map((g) => {
          const isOpen = openGuide === g.bank
          return (
            <div
              key={g.bank}
              className="border border-border-dim rounded-[3px] overflow-hidden"
            >
              <button
                onClick={() => setOpenGuide(isOpen ? null : g.bank)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gold/5 transition-colors text-left"
              >
                <span className="flex items-center gap-3">
                  <span className={`text-lg ${SOURCE_TONE[g.icon] ?? 'text-gold'}`}>{g.icon}</span>
                  <span className="font-heading text-sm text-text-primary tracking-wide">
                    {g.bank}
                  </span>
                </span>
                <span className="text-gold text-xs">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="px-4 py-3 bg-stone/40 border-t border-border-dim">
                  <ol className="space-y-1.5 list-decimal list-inside font-body text-sm text-text-secondary">
                    {g.steps.map((s, i) => (
                      <li key={i} className="leading-relaxed">
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Regenerate */}
      <div className="mt-5 flex items-center justify-between gap-4 pt-4 border-t border-border-dim">
        <p className="font-ui text-xs text-text-muted italic">
          Token: <code className="font-mono text-gold">{data.token}</code>
          {' · '}Ak sa adresa dostane k niekomu cudziemu, vygeneruj novú — stará prestane fungovať.
        </p>
        {!confirmRegen ? (
          <button
            onClick={() => setConfirmRegen(true)}
            className="font-heading text-[0.6rem] uppercase tracking-widest text-crimson-bright border border-crimson/30 px-3 py-1.5 rounded-[2px] hover:border-crimson-bright hover:bg-crimson/10 transition-colors shrink-0"
          >
            🔄 Nová adresa
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmRegen(false)}
              className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-3 py-1.5 hover:text-text-primary transition-colors"
            >
              Zrušiť
            </button>
            <button
              onClick={regenerate}
              className="font-heading text-[0.6rem] uppercase tracking-widest text-crimson-bright bg-crimson/10 border border-crimson-bright px-3 py-1.5 rounded-[2px] hover:bg-crimson/20 transition-colors"
            >
              ⚡ Potvrdiť
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
