import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { AuthShell, AuthCard, INPUT_CLASS, PRIMARY_BTN_CLASS, ErrorBox } from '../components/layout/AuthShell'

export function Login() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCode(null)
    setLoading(true)
    const res = await apiFetch<{ id: number; email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      // typed code (forwarded by backend on EMAIL_NOT_VERIFIED)
      setCode((res as unknown as { code?: string }).code ?? null)
      return
    }
    await refresh()
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthShell
      eyebrow="✦ Trezor Gringottov ✦"
      title={
        <>
          Nula <span className="text-gold-bright">na účte</span>
        </>
      }
      subtitle="tu uvidíš, na čo rozjebávaš lóve"
    >
      <AuthCard>
        <h2 className="font-heading text-xl text-gold tracking-widest uppercase mb-1">
          Vyslov zaklínadlo
        </h2>
        <p className="font-ui text-sm text-text-muted mb-7 italic">
          Iba zaregistrovaní čarodejníci sa dostanú dnu
        </p>

        <form onSubmit={onSubmit} className="space-y-5 text-left">
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@example.com"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Heslo">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={INPUT_CLASS}
            />
          </Field>

          {error && (
            <ErrorBox title="Zaklínadlo zlyhalo" message={error}>
              {code === 'EMAIL_NOT_VERIFIED' && (
                <p className="mt-2">
                  <Link to="/forgot" className="underline text-gold hover:text-gold-bright">
                    Požiadaj o nový verify link
                  </Link>
                </p>
              )}
            </ErrorBox>
          )}

          <button type="submit" disabled={loading} className={PRIMARY_BTN_CLASS}>
            {loading ? '✦ Otváram trezor… ✦' : '⚡ Alohomora'}
          </button>
        </form>

        <div className="mt-7 flex items-center gap-3 text-xs">
          <Link to="/forgot" className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted hover:text-gold-bright transition-colors">
            Zabudnuté heslo?
          </Link>
          <span className="text-text-muted">·</span>
          <Link to="/register" className="font-heading text-[0.65rem] uppercase tracking-widest text-gold hover:text-gold-bright transition-colors">
            Zaregistrovať sa →
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-ui text-sm uppercase tracking-widest text-text-muted block">
        {label}
      </label>
      {children}
    </div>
  )
}

