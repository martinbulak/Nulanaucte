import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { BrandLogo } from '../components/ui/BrandLogo'

export function Login() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const { theme, toggle } = useTheme()
  const [email, setEmail] = useState('koduvanica')
  const [password, setPassword] = useState('koduvanica')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await apiFetch<{ id: number; email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    await refresh()
    navigate('/dashboard', { replace: true })
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Floating theme toggle */}
      <button
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Zapnúť svetlý režim' : 'Zapnúť tmavý režim'}
        title={theme === 'dark' ? 'Lumos — svetlý režim' : 'Nox — tmavý režim'}
        className="absolute top-5 right-5 z-10 font-heading text-[0.65rem] uppercase tracking-widest text-text-secondary hover:text-gold-bright border border-border-dim hover:border-gold bg-obsidian/60 backdrop-blur-sm px-3 py-1.5 rounded-[3px] transition-all duration-300"
      >
        {theme === 'dark' ? '☀ Lumos' : '☾ Nox'}
      </button>

      {/* Background glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gold/[0.05] blur-[140px] float" />
        <div className="absolute top-1/4 left-1/5 w-72 h-72 rounded-full bg-crimson/[0.04] blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/5 w-72 h-72 rounded-full bg-cobalt/[0.06] blur-[100px]" />
      </div>

      {/* Header */}
      <p className="font-heading text-sm uppercase tracking-[0.4em] text-gold mb-6 reveal reveal-1">
        ✦ Trezor Gringottov ✦
      </p>

      <div className="reveal reveal-2 flex items-center justify-center gap-4 mb-3">
        <BrandLogo
          className="w-14 h-14 md:w-16 md:h-16 text-gold-bright shrink-0"
          // standalone — currentColor inherits from text-gold-bright
        />
        <h1 className="font-display text-5xl md:text-6xl text-text-primary leading-tight [text-shadow:0_0_60px_rgba(201,151,42,0.4)]">
          Nula <span className="text-gold-bright">na účte</span>
        </h1>
      </div>

      <p className="font-body italic text-lg text-text-secondary mb-10 reveal reveal-3">
        tu uvidíš, na čo rozjebávaš lóve
      </p>

      {/* Card */}
      <div className="relative w-full max-w-md reveal reveal-4">
        <div className="relative bg-obsidian/80 backdrop-blur-md border border-border rounded-[4px] p-8 [box-shadow:0_8px_40px_rgba(0,0,0,0.5),0_0_40px_rgba(201,151,42,0.05)]">
          <div className="absolute inset-[6px] border border-gold/[0.06] rounded-[2px] pointer-events-none" />
          <span className="absolute top-2 left-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute top-2 right-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute bottom-2 left-2 text-gold/40 text-[10px]">✦</span>
          <span className="absolute bottom-2 right-2 text-gold/40 text-[10px]">✦</span>

          <h2 className="font-heading text-xl text-gold tracking-widest uppercase mb-1">
            Vyslov zaklínadlo
          </h2>
          <p className="font-ui text-sm text-text-muted mb-7 italic">
            iba ozajstní čarodejníci sa dostanú dnu
          </p>

          <form onSubmit={onSubmit} className="space-y-5 text-left">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="font-ui text-sm uppercase tracking-widest text-text-muted block"
              >
                Meno čarodejníka
              </label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="koduvanica"
                className="w-full font-body text-base text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim border-b-border rounded-t-[3px] px-4 py-3 outline-none focus:border-gold-dim focus:[box-shadow:0_2px_0_var(--color-gold),0_0_24px_rgba(201,151,42,0.1)] transition-all duration-300"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="font-ui text-sm uppercase tracking-widest text-text-muted block"
              >
                Tajné zaklínadlo
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full font-body text-base text-text-primary placeholder:text-text-muted placeholder:italic bg-stone/80 border border-border-dim border-b-border rounded-t-[3px] px-4 py-3 outline-none focus:border-gold-dim focus:[box-shadow:0_2px_0_var(--color-gold),0_0_24px_rgba(201,151,42,0.1)] transition-all duration-300"
              />
            </div>

            {error && (
              <div className="bg-crimson/10 border border-crimson/30 border-l-[3px] border-l-crimson-bright rounded-[3px] px-4 py-3 flex gap-3 items-start">
                <span className="text-lg flex-shrink-0">⚠</span>
                <div>
                  <p className="font-heading text-xs uppercase tracking-widest text-crimson-bright">
                    Zaklínadlo zlyhalo
                  </p>
                  <p className="font-body text-sm text-text-secondary mt-0.5">
                    {error}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-heading text-sm uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-8 py-3 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px hover:[box-shadow:0_4px_24px_rgba(201,151,42,0.5),0_0_48px_rgba(201,151,42,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? '✦ Otváram trezor… ✦' : '⚡ Alohomora'}
            </button>
          </form>

          <div className="mt-7 flex items-center gap-4 text-gold-dim font-heading text-[0.6rem] uppercase tracking-widest">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold-dim to-transparent" />
            <span>✦ Tip ✦</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold-dim to-transparent" />
          </div>
          <p className="font-ui text-xs text-text-muted italic mt-3">
            Skús <span className="text-gold">koduvanica</span> /{' '}
            <span className="text-gold">koduvanica</span>
          </p>
        </div>
      </div>

      <p className="mt-10 font-heading text-[0.6rem] uppercase tracking-[0.3em] text-text-muted reveal reveal-5">
        ✦ Koduvanica · Anno {new Date().getFullYear()} ✦
      </p>
    </section>
  )
}
