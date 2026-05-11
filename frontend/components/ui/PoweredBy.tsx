import { Link } from 'react-router-dom'

/**
 * Tiny brand-credit badges used in the AuthShell footer and at the bottom of
 * the in-app Sidebar. Two pills:
 *   ⚡ Powered by OpenAI   (links to openai.com, opens in a new tab)
 *   🛡 Secured by Vercel   (links to our in-app /bezpecnost page which
 *                            explains the full stack: TLS 1.3 + HSTS +
 *                            PBKDF2 + JWT + per-user data isolation)
 *
 * Two layout variants:
 *   - "row" (default): inline row, used in wide footers
 *   - "stack": two pills stacked vertically, used in the narrow sidebar
 */
export function PoweredBy({
  variant = 'row',
  className = '',
}: {
  variant?: 'row' | 'stack'
  className?: string
}) {
  const wrap =
    variant === 'stack'
      ? 'flex flex-col items-stretch gap-1.5'
      : 'flex flex-wrap items-center justify-center gap-2'
  return (
    <div className={`${wrap} ${className}`}>
      <a
        href="https://openai.com"
        target="_blank"
        rel="noopener noreferrer"
        title="AI kategorizácia + Raulove odporúčania bežia na GPT-4o-mini od OpenAI"
        className={[
          'group inline-flex items-center gap-2 font-heading text-[0.6rem] uppercase tracking-widest',
          'text-text-muted hover:text-gold-bright',
          'border border-border-dim hover:border-gold/60',
          'bg-stone/40 hover:bg-gold/5',
          'px-3 py-1.5 rounded-[3px] transition-all duration-200',
          variant === 'stack' ? 'justify-between' : '',
        ].join(' ')}
      >
        <span className="flex items-center gap-2">
          <OpenAIMark className="w-3.5 h-3.5 text-gold group-hover:text-gold-bright shrink-0" />
          <span className="opacity-80">Powered by</span>
        </span>
        <span className="text-gold group-hover:text-gold-bright">OpenAI</span>
      </a>

      <Link
        to="/bezpecnost"
        title="HTTPS / TLS 1.3, HSTS, PBKDF2 hashing, JWT sessions, per-user data isolation"
        className={[
          'group inline-flex items-center gap-2 font-heading text-[0.6rem] uppercase tracking-widest',
          'text-text-muted hover:text-gold-bright',
          'border border-border-dim hover:border-gold/60',
          'bg-stone/40 hover:bg-gold/5',
          'px-3 py-1.5 rounded-[3px] transition-all duration-200',
          variant === 'stack' ? 'justify-between' : '',
        ].join(' ')}
      >
        <span className="flex items-center gap-2">
          <VercelMark className="w-3.5 h-3.5 text-gold group-hover:text-gold-bright shrink-0" />
          <span className="opacity-80">Secured by</span>
        </span>
        <span className="text-gold group-hover:text-gold-bright">Vercel</span>
      </Link>
    </div>
  )
}

/** Minimal stylised OpenAI mark — six-petal knot in monochrome currentColor. */
function OpenAIMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a4 4 0 0 1 3.46 6 4 4 0 0 1 0 6A4 4 0 0 1 12 21a4 4 0 0 1-3.46-6 4 4 0 0 1 0-6A4 4 0 0 1 12 3Z" />
      <path d="M8.54 9 12 11l3.46-2M8.54 15 12 13l3.46 2M12 11v2" />
    </svg>
  )
}

/** Minimal Vercel mark — equilateral triangle. */
function VercelMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 4 22 20H2L12 4Z" />
    </svg>
  )
}
