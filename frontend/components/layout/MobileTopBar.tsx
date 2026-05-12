import { Link } from 'react-router-dom'
import type { AuthUser } from '../../hooks/useAuth'
import { BrandLogo } from '../ui/BrandLogo'

interface Props {
  user: AuthUser
  onMenu: () => void
}

/**
 * Sticky top bar shown ONLY on small screens (<lg). Replaces the always-on
 * sidebar that's too wide for phones. Holds three things:
 *   - hamburger button (opens the Sidebar as a slide-in drawer)
 *   - brand logo + wordmark (click → /dashboard)
 *   - user avatar with initial (passive, just visual)
 *
 * Rendered by Layout side-by-side with Sidebar. CSS hides it on lg+ since
 * the regular Sidebar is always visible there.
 */
export function MobileTopBar({ user, onMenu }: Props) {
  const displayName = (user.name && user.name.trim()) || user.email
  const initial = displayName.charAt(0).toUpperCase()
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-obsidian/95 backdrop-blur-md border-b border-border-dim">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button
          onClick={onMenu}
          aria-label="Otvor menu"
          className="w-10 h-10 rounded-[3px] border border-border-dim hover:border-gold hover:bg-gold/5 text-text-secondary hover:text-gold-bright flex items-center justify-center transition-colors"
        >
          <span className="text-xl" aria-hidden="true">☰</span>
        </button>

        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-gold-bright min-w-0"
          aria-label="Domov"
        >
          <BrandLogo className="w-8 h-8 shrink-0" />
          <span className="font-display text-base leading-none truncate [text-shadow:0_0_16px_rgba(160,120,32,0.4)]">
            Nula na účte
          </span>
        </Link>

        <div
          className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-gold-bright via-gold to-gold-dim flex items-center justify-center font-heading text-ink text-sm font-bold [box-shadow:0_0_12px_rgba(160,120,32,0.3)]"
          title={displayName}
        >
          {initial}
        </div>
      </div>
    </header>
  )
}
