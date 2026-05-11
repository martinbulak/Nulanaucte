import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { BrandLogo } from '../ui/BrandLogo'

interface Props {
  eyebrow: string
  title: ReactNode
  children: ReactNode
  /** Override where the "späť" link points. Defaults: /dashboard if logged in, else /login. */
  backTo?: string
  backLabel?: string
}

/**
 * Shared shell for informational pages (Privacy, Security, How-it-works).
 * Designed for longer-form content: wider max width, left-aligned, with a
 * persistent "back" link in the top-left and theme toggle in the top-right.
 * Back link auto-routes to /dashboard for logged-in users.
 */
export function InfoShell({ eyebrow, title, children, backTo, backLabel = '← Späť' }: Props) {
  const { theme, toggle } = useTheme()
  const { user } = useAuth()
  const resolvedBackTo = backTo ?? (user ? '/dashboard' : '/login')
  return (
    <section className="relative min-h-screen px-6 py-10 overflow-hidden">
      {/* Background glow — same family as AuthShell, dimmed */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gold/[0.04] blur-[140px]" />
        <div className="absolute top-1/4 right-1/5 w-72 h-72 rounded-full bg-cobalt/[0.05] blur-[100px]" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 max-w-3xl mx-auto flex items-center justify-between mb-10">
        <Link
          to={resolvedBackTo}
          className="font-heading text-[0.65rem] uppercase tracking-widest text-text-secondary hover:text-gold-bright border border-border-dim hover:border-gold bg-obsidian/60 backdrop-blur-sm px-3 py-1.5 rounded-[3px] transition-all duration-300"
        >
          {backLabel}
        </Link>
        <button
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Zapnúť svetlý režim' : 'Zapnúť tmavý režim'}
          className="font-heading text-[0.65rem] uppercase tracking-widest text-text-secondary hover:text-gold-bright border border-border-dim hover:border-gold bg-obsidian/60 backdrop-blur-sm px-3 py-1.5 rounded-[3px] transition-all duration-300"
        >
          {theme === 'dark' ? '☀ Lumos' : '☾ Nox'}
        </button>
      </div>

      {/* Header */}
      <div className="relative z-10 max-w-3xl mx-auto mb-8 reveal reveal-1">
        <p className="font-heading text-xs uppercase tracking-[0.4em] text-gold mb-3">{eyebrow}</p>
        <div className="flex items-center gap-3">
          <BrandLogo className="w-9 h-9 text-gold-bright shrink-0" />
          <h1 className="font-display text-3xl md:text-4xl text-text-primary leading-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Content card */}
      <div className="relative z-10 max-w-3xl mx-auto reveal reveal-2">
        <div className="relative bg-obsidian/70 backdrop-blur-md border border-border rounded-[4px] p-8 md:p-10 [box-shadow:0_8px_40px_rgba(0,0,0,0.25)]">
          <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute bottom-2 left-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute bottom-2 right-2 text-gold/40 text-[10px]">✦</span>
          <div className="prose-info text-text-primary font-body text-base leading-relaxed space-y-4">
            {children}
          </div>
        </div>

        <p className="mt-6 text-center font-ui text-xs text-text-muted italic">
          ✦ Nula na účte — Raul uprace tvojej financie. Lebo ty nevieš. Zadarmo. ✦
        </p>
      </div>
    </section>
  )
}

/** Headline H2 inside an InfoShell. */
export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-heading text-lg md:text-xl uppercase tracking-widest text-gold-bright mt-6 mb-2 first:mt-0">
      {children}
    </h2>
  )
}

/** Headline H3 inside an InfoShell. */
export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-heading text-sm uppercase tracking-widest text-gold mt-4 mb-1">
      {children}
    </h3>
  )
}
