import { NavLink } from 'react-router-dom'
import type { AuthUser } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { BrandLogo } from '../ui/BrandLogo'

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
}

export function Sidebar({ user, onLogout }: Props) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <aside className="w-72 shrink-0 bg-obsidian/80 backdrop-blur-md border-r border-border-dim flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 pt-7 pb-5 border-b border-border-dim relative text-center">
        <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
        <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>
        <div className="inline-flex items-center justify-center gap-2.5 text-gold-bright">
          <BrandLogo
            className="w-9 h-9 shrink-0"
            // gold glow shadow on the SVG
          />
          <h1
            className="font-display text-2xl leading-none [text-shadow:0_0_24px_rgba(201,151,42,0.4)]"
          >
            Nula na účte
          </h1>
        </div>
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

      {/* Theme toggle */}
      <div className="px-4 py-3 border-t border-border-dim">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Zapnúť svetlý režim' : 'Zapnúť tmavý režim'}
          title={isDark ? 'Zapnúť svetlý režim (Lumos)' : 'Zapnúť tmavý režim (Nox)'}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[3px] border border-border-dim text-text-secondary hover:border-gold hover:text-gold-bright hover:bg-gold/5 transition-all duration-300 cursor-pointer group"
        >
          <span className="font-heading text-xs uppercase tracking-widest">
            {isDark ? '☀ Lumos' : '☾ Nox'}
          </span>
          <span
            className="text-base text-gold group-hover:text-gold-bright"
            style={{ filter: 'drop-shadow(0 0 6px rgba(201,151,42,0.4))' }}
          >
            {isDark ? '✦' : '✧'}
          </span>
        </button>
      </div>

      {/* User */}
      <div className="px-4 py-5 border-t border-border-dim">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-bright via-gold to-gold-dim flex items-center justify-center font-heading text-ink text-sm font-bold [box-shadow:0_0_16px_rgba(201,151,42,0.3)]">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm text-text-primary truncate">{user.email}</p>
            <p className="font-ui text-xs text-text-muted">Strážca trezoru</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-3 w-full font-heading text-xs uppercase tracking-widest text-crimson-bright border border-crimson/30 px-3 py-2 rounded-[3px] hover:border-crimson-bright hover:bg-crimson/10 transition-all duration-300 cursor-pointer"
        >
          ⌬ Opustiť trezor
        </button>
      </div>
    </aside>
  )
}
