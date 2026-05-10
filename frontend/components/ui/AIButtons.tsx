import { useState } from 'react'
import { apiFetch } from '../../utils/api'

const PRIMARY =
  'font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-5 py-2 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

interface CategorizeResult {
  processed: number
  updated: number
  usedAI: boolean
  note?: string
  tokens?: number
}

export function CategorizeButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    const res = await apiFetch<CategorizeResult>('/api/ai/categorize', { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      setMsg(res.error)
      return
    }
    if (res.data.processed === 0) {
      setMsg('✓ Všetko už zaradené.')
    } else {
      setMsg(
        `✓ Roztriedil som ${res.data.updated} transakcií ${
          res.data.usedAI ? 'cez AI' : '(rule-based, pridaj OPENAI_API_KEY pre AI)'
        }.`,
      )
    }
    onDone?.()
    setTimeout(() => setMsg(null), 6000)
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button onClick={run} disabled={busy} className={PRIMARY}>
        {busy ? '✦ Triedim kúzlom… ✦' : '🔮 Roztriediť výdavky kúzlom'}
      </button>
      {msg && <span className="font-ui italic text-sm text-text-secondary">{msg}</span>}
    </div>
  )
}

interface RaulData {
  period: string
  recommendation: { content: string; createdAt: string } | null
}

interface RaulResult {
  period: string
  content: string
  usedAI: boolean
}

export function RaulPanel({ month }: { month: string }) {
  const [data, setData] = useState<RaulData | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoaded(false)
    const res = await apiFetch<RaulData>(`/api/ai/recommendations?month=${encodeURIComponent(month)}`)
    setLoaded(true)
    if (res.ok) setData(res.data)
  }

  async function generate() {
    setBusy(true)
    setErr(null)
    const res = await apiFetch<RaulResult>('/api/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({ month }),
    })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setData({
      period: res.data.period,
      recommendation: { content: res.data.content, createdAt: new Date().toISOString() },
    })
  }

  // Lazy load on first mount
  if (!loaded && !data) {
    load()
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
            ✦ Veštba z Komnaty galeónov
          </p>
          <h2 className="font-heading text-xl text-text-primary tracking-wide">
            Raul, kde mi miznú galeóny?
          </h2>
        </div>
        <button onClick={generate} disabled={busy} className={PRIMARY}>
          {busy ? '✦ Raul fajčí cigaru… ✦' : data?.recommendation ? '🔄 Vygenerovať znovu' : '⚡ Spýtať sa Raula'}
        </button>
      </div>

      {err && (
        <div className="bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3 mb-4">
          <p className="font-body text-sm text-text-secondary">{err}</p>
        </div>
      )}

      {data?.recommendation ? (
        <div className="bg-stone/40 border border-border-dim border-l-[3px] border-l-gold rounded-[3px] px-5 py-4">
          <RaulMarkdown content={data.recommendation.content} />
          <p className="font-ui text-xs text-text-muted italic mt-3">
            ✦ {new Date(data.recommendation.createdAt).toLocaleString('sk-SK')}
          </p>
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-border-dim rounded-[3px]">
          <p className="text-3xl text-gold-dim mb-2">🦉</p>
          <p className="font-heading text-sm uppercase tracking-widest text-text-muted">
            Raul ešte nemá veštbu pre tento mesiac
          </p>
          <p className="font-ui text-xs text-text-muted italic mt-1">
            Klikni „Spýtať sa Raula" — pozrie tvoje výdavky a niečo k tomu povie.
          </p>
        </div>
      )}
    </div>
  )
}

/** Minimal markdown renderer — bold, italics, code, line breaks. No raw HTML. */
function RaulMarkdown({ content }: { content: string }) {
  const html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gold-bright">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-text-primary">$1</em>')
    .replace(/_([^_]+)_/g, '<em class="italic text-text-muted">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="text-gold font-mono text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-text-secondary">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>)/gs, '<ul class="space-y-1 my-2">$1</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
  return (
    <div
      className="font-body text-text-primary leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
