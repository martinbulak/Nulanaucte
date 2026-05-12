import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '../../utils/api'

/**
 * Small "nahlásiť" trigger + modal for sending bug reports / feature requests
 * directly to the project owner's email. Designed to be persistent but
 * unobtrusive — renders just an icon-style button; the form lives in a modal
 * that opens on click.
 *
 * Body of the email forwards via /api/feedback (rate-limited 5/hour/user).
 */

type FeedbackKind = 'bug' | 'idea' | 'other'

const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: '🐛 Chyba',
  idea: '💡 Nápad',
  other: '💬 Iné',
}

const KIND_DESCRIPTION: Record<FeedbackKind, string> = {
  bug: 'Niečo nefunguje — popíš čo robíš, čo sa stane a čo si očakával.',
  idea: 'Nový feature alebo zlepšenie — povedz mi čo by ti pomohlo.',
  other: 'Otázka, postreh, čokoľvek iné na čo nemáš inú kolónku.',
}

interface Props {
  /** Inline variant used inside the sidebar (small link); "fab" not used yet. */
  variant?: 'sidebar' | 'fab'
}

export function FeedbackWidget({ variant = 'sidebar' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[3px] border border-border-dim text-text-secondary hover:border-gold hover:text-gold-bright hover:bg-gold/5 transition-all duration-300 group"
          title="Nahlás chybu alebo pošli nápad priamo na email autora"
        >
          <span className="font-heading text-xs uppercase tracking-widest flex items-center gap-2">
            <span className="text-gold group-hover:text-gold-bright">📮</span>
            Nahlásiť
          </span>
          <span className="font-heading text-[0.55rem] tracking-widest text-text-muted group-hover:text-gold-bright">
            chyba / nápad
          </span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-5 z-40 font-heading text-xs uppercase tracking-widest text-gold border border-gold/40 bg-obsidian/80 backdrop-blur-sm px-4 py-2 rounded-[3px] hover:border-gold-bright hover:text-gold-bright transition-all"
        >
          📮 Nahlásiť
        </button>
      )}
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  )
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      setErr('Aspoň pár slov, prosím.')
      return
    }
    setBusy(true)
    setErr(null)
    const res = await apiFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ kind, subject: subject.trim(), message: message.trim() }),
    })
    setBusy(false)
    if (res.ok) {
      setSent(true)
      setTimeout(onClose, 1800)
    } else {
      setErr(res.error)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-ink/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="relative w-full max-w-xl bg-obsidian border border-border rounded-[6px] shadow-card max-h-[90vh] overflow-auto">
        <div className="absolute inset-[6px] border border-gold/[0.06] rounded-[4px] pointer-events-none" />
        <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
        <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>

        <div className="relative p-8">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="font-heading text-[0.65rem] uppercase tracking-[0.3em] text-gold mb-1">
                ✦ Sova pošle list ✦
              </p>
              <h2 className="font-heading text-2xl text-text-primary tracking-wide">
                Nahlásiť chybu alebo nápad
              </h2>
              <p className="font-ui text-sm text-text-muted italic mt-1">
                Pôjde priamo na email autora, odpovie ti zo svojej schránky.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="font-heading text-xs uppercase tracking-widest text-text-muted hover:text-crimson-bright transition-colors px-2 py-1"
            >
              ✕
            </button>
          </div>

          {sent ? (
            <div className="bg-emerald/10 border border-emerald-bright/30 border-l-[3px] border-l-emerald-bright rounded-[3px] px-5 py-4">
              <p className="font-heading text-sm uppercase tracking-widest text-emerald-bright">
                ✦ Odoslané
              </p>
              <p className="font-body text-sm text-text-secondary mt-1">
                Sova už letí. Ďakujem — odpoveď príde do tvojej schránky.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Kind tabs */}
              <div>
                <p className="font-ui text-sm uppercase tracking-widest text-text-muted mb-2">
                  Typ
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(KIND_LABEL) as FeedbackKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={[
                        'font-heading text-xs uppercase tracking-widest px-4 py-2 rounded-[3px] border transition-all',
                        kind === k
                          ? 'bg-gold/15 border-gold text-gold-bright'
                          : 'bg-stone/50 border-border-dim text-text-secondary hover:border-gold-dim',
                      ].join(' ')}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                <p className="font-ui text-xs text-text-muted italic mt-2">
                  {KIND_DESCRIPTION[kind]}
                </p>
              </div>

              <div>
                <label className="font-ui text-sm uppercase tracking-widest text-text-muted block mb-1.5">
                  Predmet <span className="font-body text-[10px] text-text-muted normal-case italic">(voliteľné)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder='Napr. „Po importe sa stratil dátum"'
                  maxLength={120}
                  className="w-full font-body text-base text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim border-b-border rounded-t-[3px] px-4 py-3 outline-none focus:border-gold-dim transition-all"
                />
              </div>

              <div>
                <label className="font-ui text-sm uppercase tracking-widest text-text-muted block mb-1.5">
                  Detaily
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  maxLength={5000}
                  placeholder={
                    kind === 'bug'
                      ? 'Čo si robil, čo sa stalo, čo si očakával. Ak ide o transakciu/import, napíš ktorú banku a kedy.'
                      : kind === 'idea'
                      ? 'Popíš čo by si chcel mať v appke a prečo by ti to pomohlo.'
                      : 'Píš čo máš na srdci.'
                  }
                  className="w-full font-body text-sm text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim rounded-[3px] px-4 py-3 outline-none focus:border-gold-dim transition-all resize-y min-h-[160px]"
                />
                <p className="font-ui text-[10px] text-text-muted italic text-right mt-1">
                  {message.length} / 5000
                </p>
              </div>

              {err && (
                <div className="bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3">
                  <p className="font-body text-sm text-text-secondary">{err}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="font-ui text-xs text-text-muted italic">
                  Tvoj email + meno sa pripoja k správe automaticky.
                </p>
                <button
                  type="submit"
                  disabled={busy || !message.trim()}
                  className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? '✦ Posielam… ✦' : '🦉 Poslať'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
