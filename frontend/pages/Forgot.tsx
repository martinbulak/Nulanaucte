import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { AuthShell, AuthCard, INPUT_CLASS, PRIMARY_BTN_CLASS, ErrorBox, SuccessBox } from '../components/layout/AuthShell'

export function Forgot() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await apiFetch<{ sent: boolean }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      eyebrow="✦ Stratené zaklínadlo ✦"
      title={
        <>
          Reset <span className="text-gold-bright">hesla</span>
        </>
      }
    >
      <AuthCard>
        {sent ? (
          <>
            <p className="text-5xl text-gold-bright text-center mb-3">🦉</p>
            <SuccessBox
              title="Sova letí"
              message="Ak je adresa zaregistrovaná, dostaneš link na reset (platný 30 minút)."
            />
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="font-heading text-xs uppercase tracking-widest text-gold hover:text-gold-bright transition-colors"
              >
                ← Späť na prihlásenie
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-heading text-xl text-gold tracking-widest uppercase mb-1">
              Zabudnuté heslo?
            </h2>
            <p className="font-ui text-sm text-text-muted mb-7 italic">
              Pošleme ti link na reset
            </p>
            <form onSubmit={onSubmit} className="space-y-5 text-left">
              <div className="space-y-1.5">
                <label className="font-ui text-sm uppercase tracking-widest text-text-muted block">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ty@example.com"
                  className={INPUT_CLASS}
                  autoComplete="email"
                />
              </div>
              {error && <ErrorBox title="Chyba" message={error} />}
              <button type="submit" disabled={loading} className={PRIMARY_BTN_CLASS}>
                {loading ? '✦ Posielam… ✦' : '🦉 Poslať reset link'}
              </button>
            </form>
            <div className="mt-7 text-center">
              <Link
                to="/login"
                className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted hover:text-gold-bright transition-colors"
              >
                ← Späť na prihlásenie
              </Link>
            </div>
          </>
        )}
      </AuthCard>
    </AuthShell>
  )
}
