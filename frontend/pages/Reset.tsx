import { useState, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { AuthShell, AuthCard, INPUT_CLASS, PRIMARY_BTN_CLASS, ErrorBox, SuccessBox } from '../components/layout/AuthShell'

export function Reset() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Heslá sa nezhodujú')
      return
    }
    setLoading(true)
    const res = await apiFetch<{ reset: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  return (
    <AuthShell
      eyebrow="✦ Nové zaklínadlo ✦"
      title={
        <>
          Nastaviť <span className="text-gold-bright">heslo</span>
        </>
      }
    >
      <AuthCard>
        {!token ? (
          <ErrorBox title="Chýba token" message="Otvor link z emailu." />
        ) : done ? (
          <>
            <p className="text-5xl text-emerald-bright text-center mb-3">⚡</p>
            <SuccessBox title="Heslo nastavené" message="Všetky existujúce sessiony boli zrušené. Prihlás sa novým heslom." />
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] inline-block hover:-translate-y-px transition-all"
              >
                ⚡ Prihlásiť sa
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-heading text-xl text-gold tracking-widest uppercase mb-1">
              Nové heslo
            </h2>
            <p className="font-ui text-sm text-text-muted mb-7 italic">
              Aspoň 12 znakov + číslica/symbol
            </p>
            <form onSubmit={onSubmit} className="space-y-5 text-left">
              <div className="space-y-1.5">
                <label className="font-ui text-sm uppercase tracking-widest text-text-muted block">
                  Nové heslo
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="aspoň 12 znakov"
                  className={INPUT_CLASS}
                  autoComplete="new-password"
                  minLength={12}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-ui text-sm uppercase tracking-widest text-text-muted block">
                  Zopakuj heslo
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••••••"
                  className={INPUT_CLASS}
                  autoComplete="new-password"
                />
              </div>
              {error && <ErrorBox title="Chyba" message={error} />}
              <button type="submit" disabled={loading} className={PRIMARY_BTN_CLASS}>
                {loading ? '✦ Nastavujem… ✦' : '⚡ Uložiť nové heslo'}
              </button>
            </form>
          </>
        )}
      </AuthCard>
    </AuthShell>
  )
}
