import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { AuthShell, AuthCard, INPUT_CLASS, PRIMARY_BTN_CLASS, ErrorBox, SuccessBox } from '../components/layout/AuthShell'

export function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await apiFetch<{ sent: boolean }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name: name || undefined }),
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
      eyebrow="✦ Nový čarodejník ✦"
      title={
        <>
          Vytvor si <span className="text-gold-bright">trezor</span>
        </>
      }
      subtitle="po registrácii ti pošleme overovací list — sovou"
    >
      <AuthCard>
        {sent ? (
          <>
            <p className="text-5xl text-gold-bright text-center mb-3">🦉</p>
            <h2 className="font-heading text-xl text-gold-bright tracking-widest uppercase mb-2 text-center">
              Sova letí!
            </h2>
            <p className="font-body text-sm text-text-secondary text-center mb-6">
              Ak je <span className="text-text-primary">{email}</span> platná adresa,
              dorazí ti overovací email do pár sekúnd. Klikni na link v ňom a môžeš sa prihlásiť.
            </p>
            <SuccessBox
              title="Skontroluj schránku"
              message={'Niekedy končí v Spame. Hľadaj predmet „Potvrď svoju adresu — Nula na účte“.'}
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
              Otvor si nový trezor
            </h2>
            <p className="font-ui text-sm text-text-muted mb-7 italic">
              Heslo aspoň 12 znakov + číslica/symbol
            </p>

            <form onSubmit={onSubmit} className="space-y-5 text-left">
              <Field label="Meno (nepovinné)">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tvoje meno alebo prezývka"
                  className={INPUT_CLASS}
                  autoComplete="name"
                  maxLength={80}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ty@example.com"
                  className={INPUT_CLASS}
                  autoComplete="email"
                />
              </Field>
              <Field label="Heslo">
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
              </Field>

              {error && <ErrorBox title="Registrácia zlyhala" message={error} />}

              <button type="submit" disabled={loading} className={PRIMARY_BTN_CLASS}>
                {loading ? '✦ Pripravujem trezor… ✦' : '⚡ Vytvoriť účet'}
              </button>
            </form>

            <div className="mt-7 text-center">
              <Link
                to="/login"
                className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted hover:text-gold-bright transition-colors"
              >
                Už máš účet? Prihlás sa →
              </Link>
            </div>
          </>
        )}
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
