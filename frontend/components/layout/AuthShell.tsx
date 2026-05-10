import type { ReactNode } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { BrandLogo } from '../ui/BrandLogo'

interface Props {
  eyebrow: string
  title: ReactNode
  subtitle?: string
  children: ReactNode
}

/** Shared visual shell for unauthenticated pages (Login / Register / Verify / Reset). */
export function AuthShell({ eyebrow, title, subtitle, children }: Props) {
  const { theme, toggle } = useTheme()
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-10 overflow-hidden">
      {/* Floating theme toggle */}
      <button
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Zapnúť svetlý režim' : 'Zapnúť tmavý režim'}
        className="absolute top-5 right-5 z-10 font-heading text-[0.65rem] uppercase tracking-widest text-text-secondary hover:text-gold-bright border border-border-dim hover:border-gold bg-obsidian/60 backdrop-blur-sm px-3 py-1.5 rounded-[3px] transition-all duration-300"
      >
        {theme === 'dark' ? '☀ Lumos' : '☾ Nox'}
      </button>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gold/[0.05] blur-[140px] float" />
        <div className="absolute top-1/4 left-1/5 w-72 h-72 rounded-full bg-crimson/[0.04] blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/5 w-72 h-72 rounded-full bg-cobalt/[0.06] blur-[100px]" />
      </div>

      <p className="font-heading text-sm uppercase tracking-[0.4em] text-gold mb-6 reveal reveal-1">
        {eyebrow}
      </p>

      <div className="reveal reveal-2 flex items-center justify-center gap-4 mb-3">
        <BrandLogo className="w-12 h-12 md:w-14 md:h-14 text-gold-bright shrink-0" />
        <h1 className="font-display text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_60px_rgba(201,151,42,0.4)]">
          {title}
        </h1>
      </div>

      {subtitle && (
        <p className="font-body italic text-base text-text-secondary mb-8 reveal reveal-3 max-w-md">
          {subtitle}
        </p>
      )}

      <div className="relative w-full max-w-md reveal reveal-4">{children}</div>
    </section>
  )
}

const INPUT_CLASS_BASE =
  'w-full font-body text-base text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim border-b-border rounded-t-[3px] px-4 py-3 outline-none focus:border-gold-dim focus:[box-shadow:0_2px_0_var(--color-gold),0_0_24px_rgba(201,151,42,0.1)] transition-all duration-300'
export const INPUT_CLASS = INPUT_CLASS_BASE

export const PRIMARY_BTN_CLASS =
  'w-full font-heading text-sm uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-8 py-3 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px hover:[box-shadow:0_4px_24px_rgba(201,151,42,0.5),0_0_48px_rgba(201,151,42,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0'

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-obsidian/80 backdrop-blur-md border border-border rounded-[4px] p-8 [box-shadow:0_8px_40px_rgba(0,0,0,0.5),0_0_40px_rgba(201,151,42,0.05)]">
      <div className="absolute inset-[6px] border border-gold/[0.06] rounded-[2px] pointer-events-none" />
      <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
      <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>
      <span className="absolute bottom-2 left-2 text-gold/40 text-[10px]">✦</span>
      <span className="absolute bottom-2 right-2 text-gold/40 text-[10px]">✦</span>
      {children}
    </div>
  )
}

export function ErrorBox({
  title,
  message,
  children,
}: {
  title: string
  message: string
  children?: ReactNode
}) {
  return (
    <div className="bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3">
      <p className="font-heading text-xs uppercase tracking-widest text-crimson-bright">⚠ {title}</p>
      <p className="font-body text-sm text-text-secondary mt-0.5">{message}</p>
      {children}
    </div>
  )
}

export function SuccessBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-emerald/10 border border-emerald-bright/30 border-l-[3px] border-l-emerald-bright rounded-[3px] px-4 py-3">
      <p className="font-heading text-xs uppercase tracking-widest text-emerald-bright">✦ {title}</p>
      <p className="font-body text-sm text-text-secondary mt-0.5">{message}</p>
    </div>
  )
}
