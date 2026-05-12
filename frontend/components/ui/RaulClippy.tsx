import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../utils/api'
import { BrandLogo } from './BrandLogo'

/**
 * RaulClippy — bottom-right floating mascot ala Word Clippy. Shows a rotating
 * series of short, witty tips parsed from the LATEST cached Raul recommendation
 * (no extra OpenAI calls — we reuse what Raul already wrote for the most
 * recent month with a recommendation).
 *
 * Tips rotate every ~12 s. Click the avatar to manually cycle. Dismiss with
 * the × button — preference is stored in localStorage so the mascot doesn't
 * pop back after a refresh. Tap the speech bubble to expand the full tip.
 *
 * If no recommendation exists yet, we hide the widget entirely (we don't
 * spam the user with placeholder noise).
 */

const STORAGE_KEY = 'nu_clippy_dismissed_until'
const ROTATE_MS = 12_000
/** How long the dismiss button silences the mascot before it re-appears. */
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface RecommendationData {
  period: string
  recommendation: { content: string; createdAt: string } | null
}

interface ParsedTip {
  title: string
  body: string
}

/**
 * Extract tips from Raul markdown. The prompt asks for:
 *   1. **Tučný nadpis** — 1-2 vety s konkrétnymi sumami...
 *   2. **Druhý nadpis** — ...
 *   3. **Tretí nadpis** — ...
 *
 * We pluck out the "1.", "2.", "3." entries; title = bold prefix, body =
 * the rest of the line / paragraph until the next numbered item or blank.
 */
function parseTips(markdown: string): ParsedTip[] {
  if (!markdown) return []
  const lines = markdown.replace(/\r/g, '').split('\n')
  const tips: ParsedTip[] = []
  let current: ParsedTip | null = null
  for (const line of lines) {
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      if (current) tips.push(current)
      const rest = numberedMatch[2].trim()
      // Title = first bold span if present, else first sentence-ish
      const boldMatch = rest.match(/^\*\*(.+?)\*\*(.*)$/)
      if (boldMatch) {
        current = {
          title: boldMatch[1].trim(),
          body: stripMd(boldMatch[2].trim().replace(/^[—–-]\s*/, '')),
        }
      } else {
        const [first, ...restWords] = rest.split(/[—–-]/, 2)
        current = {
          title: stripMd(first.trim()).slice(0, 60),
          body: stripMd(restWords.join('—').trim()),
        }
      }
    } else if (current) {
      const trimmed = line.trim()
      if (!trimmed) {
        // blank line ends the tip body
        tips.push(current)
        current = null
      } else {
        current.body = (current.body + ' ' + stripMd(trimmed)).trim()
      }
    }
  }
  if (current) tips.push(current)
  // Cap body length so the speech bubble stays small
  return tips
    .filter((t) => t.title || t.body)
    .map((t) => ({
      title: t.title.slice(0, 60),
      body: t.body.slice(0, 220),
    }))
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pick the most recent month with a cached recommendation. */
async function fetchLatestRecommendation(): Promise<RecommendationData | null> {
  // Step 1 — get list of months with data, newest first
  const monthsRes = await apiFetch<string[]>('/api/months')
  if (!monthsRes.ok || monthsRes.data.length === 0) return null
  // Step 2 — try each month until one has a cached rec (max 3 to avoid spam)
  for (const ym of monthsRes.data.slice(0, 3)) {
    const recRes = await apiFetch<RecommendationData>(
      `/api/ai/recommendations?month=${encodeURIComponent(ym)}`,
    )
    if (recRes.ok && recRes.data.recommendation) return recRes.data
  }
  return null
}

export function RaulClippy() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const until = parseInt(raw, 10)
      return Number.isFinite(until) && Date.now() < until
    } catch {
      return false
    }
  })
  const [data, setData] = useState<RecommendationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (dismissed) return
    let alive = true
    fetchLatestRecommendation().then((d) => {
      if (!alive) return
      setData(d)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [dismissed])

  const tips = useMemo(() => {
    if (!data?.recommendation?.content) return []
    return parseTips(data.recommendation.content)
  }, [data])

  // Auto-rotate
  useEffect(() => {
    if (tips.length < 2 || expanded) return
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % tips.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [tips.length, expanded])

  // Hide entirely if dismissed, still loading, or no tips
  if (dismissed) return null
  if (loading) return null
  if (tips.length === 0) return null

  const tip = tips[idx % tips.length]
  const periodLabel = data?.period
    ? `tip z analýzy · ${data.period}`
    : 'tip z Raulovej analýzy'

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS))
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  function cycle() {
    if (tips.length < 2) return
    setIdx((i) => (i + 1) % tips.length)
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-30 flex items-end gap-3 pointer-events-none"
      // pointer-events-none on wrapper so background still scrolls; bubble + avatar opt back in
    >
      {/* Speech bubble */}
      <div
        className={[
          'pointer-events-auto relative max-w-xs bg-obsidian border border-gold/40 rounded-[6px] shadow-card transition-all duration-300',
          expanded ? 'p-4' : 'p-3',
        ].join(' ')}
        style={{ boxShadow: '0 8px 32px rgba(90,69,39,0.18), 0 0 24px rgba(160,120,32,0.15)' }}
      >
        <span className="absolute -top-1 left-3 text-gold/50 text-[10px]">✦</span>
        <span className="absolute -top-1 right-3 text-gold/50 text-[10px]">✦</span>
        {/* Bubble tail pointing to avatar */}
        <span
          className="absolute -right-2 bottom-4 w-3 h-3 rotate-45 bg-obsidian border-r border-b border-gold/40"
          aria-hidden="true"
        />
        <button
          onClick={dismiss}
          aria-label="Skryť Raulove tipy na týždeň"
          title="Skryť na týždeň — potom sa znova ozve"
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-stone border border-border-dim hover:border-gold-bright hover:text-crimson-bright text-text-muted font-heading text-[10px] flex items-center justify-center transition-colors"
        >
          ✕
        </button>
        <p className="font-heading text-[0.55rem] uppercase tracking-widest text-gold-dim mb-1">
          🪄 {periodLabel}
        </p>
        {tip.title && (
          <p
            onClick={() => setExpanded((v) => !v)}
            className="font-heading text-sm text-gold-bright leading-snug cursor-pointer"
            title={expanded ? 'Klikni pre zbalenie' : 'Klikni pre celý tip'}
          >
            {tip.title}
          </p>
        )}
        {expanded && tip.body && (
          <p className="font-body text-sm text-text-secondary leading-relaxed mt-2">{tip.body}</p>
        )}
        {tips.length > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-dim/50">
            <span className="font-ui text-[10px] text-text-muted italic">
              {idx + 1} / {tips.length}
            </span>
            <button
              onClick={cycle}
              className="font-heading text-[0.55rem] uppercase tracking-widest text-text-muted hover:text-gold-bright transition-colors"
              title="Ďalší tip"
            >
              ďalší ›
            </button>
          </div>
        )}
      </div>

      {/* Mascot avatar — pulsing gentle glow, clickable */}
      <button
        onClick={cycle}
        className="pointer-events-auto relative shrink-0 rounded-full hover:scale-105 active:scale-95 transition-transform"
        aria-label="Raul má pre teba tip"
        title="Klikni — Raul prehodí na ďalší tip"
        style={{
          filter:
            'drop-shadow(0 0 8px rgba(160,120,32,0.45)) drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
        }}
      >
        <BrandLogo className="w-14 h-14" />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gold-bright animate-pulse" />
      </button>
    </div>
  )
}
