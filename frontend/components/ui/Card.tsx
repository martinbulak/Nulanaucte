import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`relative bg-obsidian/80 backdrop-blur-sm border border-border rounded-[4px] p-6 transition-all duration-300 hover:border-border-bright hover:[box-shadow:0_8px_32px_rgba(0,0,0,0.4),0_0_24px_rgba(201,151,42,0.08)] group ${className}`}
    >
      <div className="absolute inset-[6px] border border-gold/[0.06] rounded-[2px] pointer-events-none" />
      <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
      <span className="absolute bottom-2 right-2 text-gold/40 text-[10px]">✦</span>
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'gold' | 'emerald' | 'crimson' | 'cobalt'
  icon?: string
}

const toneMap = {
  gold: { text: 'text-gold-bright', glow: 'rgba(201,151,42,0.35)' },
  emerald: { text: 'text-emerald-bright', glow: 'rgba(26,107,58,0.35)' },
  crimson: { text: 'text-crimson-bright', glow: 'rgba(192,57,43,0.35)' },
  cobalt: { text: 'text-cobalt-bright', glow: 'rgba(26,74,156,0.35)' },
} as const

export function StatCard({ label, value, hint, tone = 'gold', icon }: StatCardProps) {
  const t = toneMap[tone]
  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <span className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
          {label}
        </span>
        {icon && (
          <span
            className={`text-2xl ${t.text}`}
            style={{ filter: `drop-shadow(0 0 8px ${t.glow})` }}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={`font-display text-4xl ${t.text} tracking-wide`}
        style={{ textShadow: `0 0 24px ${t.glow}` }}
      >
        {value}
      </p>
      {hint && (
        <p className="font-ui text-sm text-text-secondary italic mt-2">{hint}</p>
      )}
    </Card>
  )
}
