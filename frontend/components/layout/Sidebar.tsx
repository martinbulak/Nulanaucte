import { useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import type { AuthUser } from '../../hooks/useAuth'
import { BrandLogo } from '../ui/BrandLogo'
import { FeedbackWidget } from '../ui/FeedbackWidget'

interface NavItem {
  to: string
  label: string
  icon: string
  enabled: boolean
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '✦', enabled: true },
  { to: '/banky', label: 'Banky', icon: '⚖', enabled: true },
  { to: '/prijmy', label: 'Príjmy', icon: '⚜', enabled: true },
  { to: '/vydavky', label: 'Výdavky', icon: '☥', enabled: true },
  { to: '/hypoteky', label: 'Hypotéky', icon: '⚱', enabled: true },
  { to: '/nastavenia', label: 'Nastavenia', icon: '⚙', enabled: true },
]

interface Props {
  user: AuthUser
  onLogout: () => void
  /** Mobile drawer state — controlled by Layout. Ignored on lg+. */
  mobileOpen?: boolean
  /** Called when the user wants the drawer closed (link click / backdrop / Esc). */
  onMobileClose?: () => void
}

/**
 * Two render modes from one component:
 *   - <lg : fixed full-height drawer that slides in from the left. Backdrop
 *           dims the rest of the page. Hidden when mobileOpen is false.
 *   - >=lg: classic static aside, always visible, no backdrop.
 *
 * Drawer behaviour: backdrop click + nav link click + Esc all close. We
 * lock body scroll while the drawer is open so the page underneath doesn't
 * jump around when the user swipes.
 */
export function Sidebar({ user, onLogout, mobileOpen = false, onMobileClose }: Props) {
  const location = useLocation()

  // Close on route change (clicking a NavLink while drawer is open should dismiss it)
  useEffect(() => {
    if (mobileOpen) onMobileClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileClose?.()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileOpen, onMobileClose])

  return (
    <>
      {/* Backdrop — only on mobile when drawer is open */}
      <div
        onClick={onMobileClose}
        className={[
          'fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        ].join(' ')}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={[
          // base layout
          'bg-obsidian/95 lg:bg-obsidian/80 backdrop-blur-md border-r border-border-dim flex flex-col',
          // small screens — fixed slide-in drawer
          'fixed top-0 left-0 z-50 h-screen w-72 max-w-[85vw] transform transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // lg+ — sticky aside, always visible (override the transform)
          'lg:sticky lg:translate-x-0 lg:z-auto lg:w-72 lg:max-w-none',
        ].join(' ')}
      >
        {/* Close X — mobile only */}
        <button
          onClick={onMobileClose}
          aria-label="Zavri menu"
          className="lg:hidden absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-stone border border-border-dim hover:border-gold-bright hover:text-crimson-bright text-text-secondary font-heading text-sm flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {/* Brand — clickable, goes back to dashboard */}
        <div className="px-6 pt-7 pb-5 border-b border-border-dim relative text-center">
          <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute top-2 right-2 text-gold/40 text-[10px] lg:block hidden">✦</span>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2.5 text-gold-bright group rounded-[3px] -m-1 p-1 hover:bg-gold/5 transition-colors"
            aria-label="Naspäť na hlavný dashboard"
            title="Naspäť na hlavný dashboard"
            onClick={onMobileClose}
          >
            <BrandLogo className="w-9 h-9 shrink-0" />
            <h1 className="font-display text-2xl leading-none [text-shadow:0_0_24px_rgba(201,151,42,0.4)] group-hover:text-gold transition-colors">
              Nula na účte
            </h1>
          </Link>
          <p className="font-body italic text-text-secondary text-sm mt-2 leading-snug">
            Raul uprace tvoje financie. Lebo ty nevieš. Zadarmo.
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-1">
          <p className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-text-muted px-3 mb-3">
            ✦ Komnaty
          </p>
          {NAV.map((item) =>
            item.enabled ? (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2.5 rounded-[3px] transition-all duration-200',
                    'font-heading text-sm uppercase tracking-wider',
                    isActive
                      ? 'bg-gold/10 border border-gold/30 text-gold-bright [box-shadow:inset_0_0_20px_rgba(201,151,42,0.08)]'
                      : 'text-text-secondary border border-transparent hover:text-gold-bright hover:bg-gold/5',
                  ].join(' ')
                }
              >
                <span className="text-base text-gold w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <div
                key={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] font-heading text-sm uppercase tracking-wider text-text-muted/60 cursor-not-allowed"
                title="Zatiaľ nie je odomknuté"
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto font-heading text-[0.55rem] tracking-widest text-gold-dim border border-gold-dim/40 px-1.5 py-px rounded-[2px]">
                  Čoskoro
                </span>
              </div>
            ),
          )}
        </nav>

        {/* User manual + feedback — stacked above user block */}
        <div className="px-4 py-3 border-t border-border-dim space-y-2">
          <Link
            to="/navod"
            className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[3px] border border-border-dim text-text-secondary hover:border-gold hover:text-gold-bright hover:bg-gold/5 transition-all duration-300 group"
            title="Otvor návod a dokumentáciu k appke"
          >
            <span className="font-heading text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="text-gold group-hover:text-gold-bright">📜</span>
              Návod
            </span>
            <span className="font-heading text-[0.55rem] tracking-widest text-text-muted group-hover:text-gold-bright">
              ako to ovládať
            </span>
          </Link>
          <FeedbackWidget />
        </div>

        {/* User — show name if set, otherwise fall back to email. Initial in
            the avatar follows the displayed label so it stays consistent. */}
        <div className="px-4 py-5 border-t border-border-dim">
          <div className="flex items-center gap-3 px-2 py-2">
            {(() => {
              const displayName = (user.name && user.name.trim()) || user.email
              const initial = displayName.charAt(0).toUpperCase()
              const hasName = !!(user.name && user.name.trim())
              return (
                <>
                  <div
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-bright via-gold to-gold-dim flex items-center justify-center font-heading text-ink text-sm font-bold [box-shadow:0_0_16px_rgba(201,151,42,0.3)]"
                    title={user.email}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm text-text-primary truncate" title={user.email}>
                      {displayName}
                    </p>
                    <p className="font-ui text-xs text-text-muted truncate">
                      {hasName ? user.email : 'Strážca trezoru'}
                    </p>
                  </div>
                </>
              )
            })()}
          </div>
          <button
            onClick={onLogout}
            className="mt-3 w-full font-heading text-xs uppercase tracking-widest text-crimson-bright border border-crimson/30 px-3 py-2 rounded-[3px] hover:border-crimson-bright hover:bg-crimson/10 transition-all duration-300 cursor-pointer"
          >
            ⌬ Opustiť trezor
          </button>
        </div>
      </aside>
    </>
  )
}
