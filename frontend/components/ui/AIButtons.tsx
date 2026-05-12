import { useState, useEffect } from 'react'
import { apiFetch } from '../../utils/api'
import { BrandLogo } from './BrandLogo'

const PRIMARY =
  'font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-5 py-2 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

const SECONDARY =
  'font-heading text-xs uppercase tracking-widest text-gold border border-gold/40 hover:border-gold-bright hover:text-gold-bright bg-stone/40 px-4 py-2 rounded-[3px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

interface CategorizeResult {
  processed: number
  updated: number
  usedAI: boolean
  mode?: 'force' | 'uncategorized'
  note?: string
  tokens?: number
}

type Phase = 'idle' | 'fetching' | 'ai' | 'rules' | 'done' | 'error'

interface CategorizeButtonProps {
  onDone?: () => void
  /**
   * If true, server re-categorizes ALL transactions (except user-locked ones).
   * If false (default), only "system"-tagged uncategorized transactions are processed.
   */
  force?: boolean
  /** Override the button label (each phase). */
  label?: string
  /** Visual variant — "primary" (gold gradient) or "secondary" (outline). */
  variant?: 'primary' | 'secondary'
}

export function CategorizeButton({
  onDone,
  force = false,
  label,
  variant = 'primary',
}: CategorizeButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<CategorizeResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  async function run() {
    setPhase('fetching')
    setResult(null)
    setErr(null)
    setElapsed(0)
    const startedAt = Date.now()
    const ticker = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 250)

    // Phase progression — purely cosmetic, but tells the user something is happening
    const t1 = setTimeout(() => setPhase('ai'), 800)
    const t2 = setTimeout(() => setPhase('rules'), 3500)

    try {
      const res = await apiFetch<CategorizeResult>('/api/ai/categorize', {
        method: 'POST',
        body: JSON.stringify({ force }),
      })
      clearInterval(ticker)
      clearTimeout(t1)
      clearTimeout(t2)
      if (!res.ok) {
        setPhase('error')
        setErr(res.error)
        return
      }
      setResult(res.data)
      setPhase('done')
      onDone?.()
    } catch (e: unknown) {
      clearInterval(ticker)
      clearTimeout(t1)
      clearTimeout(t2)
      setPhase('error')
      setErr(e instanceof Error ? e.message : 'Neznáma chyba')
    }
  }

  const busy = phase === 'fetching' || phase === 'ai' || phase === 'rules'
  const buttonClass = variant === 'primary' ? PRIMARY : SECONDARY
  const idleLabel = label ?? (force ? '🔄 Pretriediť všetko znovu' : '🔮 Roztriediť výdavky kúzlom')

  return (
    <div className="inline-flex flex-col items-start gap-1.5 max-w-full">
      <button onClick={run} disabled={busy} className={buttonClass}>
        {phase === 'idle' && idleLabel}
        {phase === 'fetching' && '✦ Zhromažďujem pergameny…'}
        {phase === 'ai' && '🪄 Vyvolávam AI duchov…'}
        {phase === 'rules' && '🔮 Triedim transakcie…'}
        {phase === 'done' && idleLabel}
        {phase === 'error' && idleLabel}
      </button>

      {busy && (
        <div className="font-ui italic text-xs text-text-secondary flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span>
            {phase === 'fetching' &&
              (force ? 'Načítavam všetky transakcie…' : 'Načítavam nezaradené transakcie…')}
            {phase === 'ai' && `AI číta tvoje transakcie · ${elapsed}s`}
            {phase === 'rules' && `Triedi do kategórií · ${elapsed}s`}
          </span>
        </div>
      )}

      {phase === 'done' && result && (
        <ResultPill result={result} onDismiss={() => setPhase('idle')} />
      )}

      {phase === 'error' && err && (
        <div className="font-ui italic text-xs text-crimson-bright">
          ⚠ {err}
          <button
            onClick={() => setPhase('idle')}
            className="ml-2 underline hover:text-crimson"
          >
            zrušiť
          </button>
        </div>
      )}
    </div>
  )
}

function ResultPill({
  result,
  onDismiss,
}: {
  result: CategorizeResult
  onDismiss: () => void
}) {
  const isForce = result.mode === 'force'
  if (result.processed === 0) {
    return (
      <div className="font-ui italic text-xs text-text-secondary flex items-center gap-2">
        <span>{result.note ?? '✓ Všetky transakcie sú už zaradené.'}</span>
        <button onClick={onDismiss} className="underline text-text-muted hover:text-text-primary">
          OK
        </button>
      </div>
    )
  }
  return (
    <div className="font-ui text-xs leading-relaxed bg-gold/10 border border-gold/30 rounded-[3px] px-3 py-2 max-w-md">
      <p className={result.usedAI ? 'text-gold-bright' : 'text-text-secondary'}>
        ✓ {isForce ? 'Pretriedil som znovu' : 'Roztriedil som'}{' '}
        <strong>{result.updated}</strong> z {result.processed} transakcií{' '}
        {result.usedAI ? (
          <>
            <strong>cez AI</strong>
            {result.tokens && (
              <span className="text-text-muted"> · {result.tokens.toLocaleString('sk-SK')} tokenov</span>
            )}
          </>
        ) : (
          <>
            <strong>rule-based</strong>
            <span className="text-text-muted"> (OpenAI key chýba alebo zlyhal)</span>
          </>
        )}
        .
      </p>
      <button
        onClick={onDismiss}
        className="mt-1 font-heading text-[0.6rem] uppercase tracking-widest text-text-muted hover:text-gold underline"
      >
        zatvoriť
      </button>
    </div>
  )
}

// ===================== RAUL =====================

interface RaulData {
  period: string
  recommendation: { content: string; createdAt: string } | null
}

interface RaulResult {
  period: string
  content: string
  usedAI: boolean
}

type RaulPhase = 'idle' | 'loading' | 'analyzing' | 'writing' | 'done' | 'error'

/**
 * Raul recommendations panel. Always shows the cached recommendation if one
 * exists for the picked month (free, no API cost). Generation is ALWAYS
 * triggered by an explicit user click — we used to auto-fire on first mount,
 * but that burned through the rate-limit budget when users were just
 * browsing across months (each unique month = 1 OpenAI call). Better to make
 * the cost an explicit user action.
 */
export function RaulPanel({ month }: { month: string }) {
  const [data, setData] = useState<RaulData | null>(null)
  const [phase, setPhase] = useState<RaulPhase>('loading')
  const [usedAI, setUsedAI] = useState<boolean | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  // Load existing recommendation whenever the month prop changes
  // (fixes blank-screen bug from calling load() during render).
  useEffect(() => {
    let alive = true
    setPhase('loading')
    setData(null)
    setUsedAI(null)
    setErr(null)
    apiFetch<RaulData>(`/api/ai/recommendations?month=${encodeURIComponent(month)}`).then((res) => {
      if (!alive) return
      setPhase('idle')
      if (res.ok) setData(res.data)
    })
    return () => {
      alive = false
    }
  }, [month])

  async function generate() {
    setErr(null)
    setUsedAI(null)
    setPhase('analyzing')
    setElapsed(0)
    const startedAt = Date.now()
    const ticker = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 250)
    const t1 = setTimeout(() => setPhase('writing'), 2500)

    const res = await apiFetch<RaulResult>('/api/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({ month }),
    })
    clearInterval(ticker)
    clearTimeout(t1)

    if (!res.ok) {
      setPhase('error')
      setErr(res.error)
      return
    }
    setData({
      period: res.data.period,
      recommendation: { content: res.data.content, createdAt: new Date().toISOString() },
    })
    setUsedAI(res.data.usedAI)
    setPhase('done')
  }

  const busy = phase === 'analyzing' || phase === 'writing'

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BrandLogo className="w-12 h-12 md:w-14 md:h-14" />
          <div>
            <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
              ✦ Veštba z Komnaty galeónov
            </p>
            <h2 className="font-heading text-xl text-text-primary tracking-wide">
              Raul, kde mi miznú galeóny?
            </h2>
          </div>
        </div>
        <button onClick={generate} disabled={busy} className={PRIMARY}>
          {phase === 'analyzing' && '✦ Raul číta tvoj výpis…'}
          {phase === 'writing' && '🪄 Raul fajčí a píše…'}
          {!busy && (data?.recommendation ? '🔄 Vygenerovať znovu' : '⚡ Spýtať sa Raula')}
        </button>
      </div>

      {busy && (
        <div className="font-ui italic text-sm text-text-secondary flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span>
            {phase === 'analyzing' && `Analyzujem transakcie, top kategórie, zmeny vs. minulý mesiac · ${elapsed}s`}
            {phase === 'writing' && `Raul si zapaľuje cigaru a píše komentár · ${elapsed}s`}
          </span>
        </div>
      )}

      {err && (
        <div className="bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3 mb-4">
          <p className="font-body text-sm text-text-secondary">{err}</p>
        </div>
      )}

      {data?.recommendation ? (
        <div className="bg-stone/40 border border-border-dim border-l-[3px] border-l-gold rounded-[3px] px-5 py-4">
          <RaulMarkdown content={data.recommendation.content} />
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border-dim/50">
            <p className="font-ui text-xs text-text-muted italic">
              ✦ {new Date(data.recommendation.createdAt).toLocaleString('sk-SK')}
            </p>
            {usedAI !== null && (
              <span
                className={`font-heading text-[0.6rem] uppercase tracking-widest px-2 py-0.5 rounded-[2px] border ${
                  usedAI
                    ? 'text-gold-bright border-gold/40 bg-gold/10'
                    : 'text-text-muted border-border-dim bg-stone/40'
                }`}
                title={usedAI ? 'GPT-4o-mini' : 'OpenAI nedostupný — rule-based stub'}
              >
                {usedAI ? '🪄 AI' : 'rule-based'}
              </span>
            )}
          </div>
        </div>
      ) : (
        !busy && (
          <div className="text-center py-8 px-4 border border-dashed border-border-dim rounded-[3px] bg-stone/20">
            <p className="text-4xl text-gold-dim mb-3">🦉</p>
            <p className="font-heading text-sm uppercase tracking-widest text-text-secondary mb-2">
              Raul ešte nemá veštbu pre tento mesiac
            </p>
            <p className="font-ui text-xs text-text-muted italic mb-4 max-w-md mx-auto">
              Klikni <strong className="text-gold">„⚡ Spýtať sa Raula"</strong> vyššie a finančný manažér
              ti za pár sekúnd vyplodí 3 konkrétne tipy ako ušetriť. Cca 0.001 USD za jedno volanie.
            </p>
            <p className="font-ui text-[10px] text-text-muted italic">
              ✦ Odpoveď sa uloží — pri druhom otvorení tohto mesiaca už nestojí nič.
            </p>
          </div>
        )
      )}
    </div>
  )
}

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
