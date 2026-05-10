import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { AuthShell, AuthCard, ErrorBox, SuccessBox } from '../components/layout/AuthShell'

type State = 'verifying' | 'ok' | 'fail'

export function Verify() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<State>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setState('fail')
      setError('Chýba token v URL.')
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await apiFetch<{ verified: boolean }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      if (cancelled) return
      if (res.ok) setState('ok')
      else {
        setState('fail')
        setError(res.error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthShell
      eyebrow="✦ Pergamen overenia ✦"
      title={
        <>
          <span className="text-gold-bright">Overenie</span> emailu
        </>
      }
    >
      <AuthCard>
        {state === 'verifying' && (
          <p className="text-center py-8 font-heading text-sm uppercase tracking-widest text-gold flicker">
            ✦ Lúštim runy… ✦
          </p>
        )}
        {state === 'ok' && (
          <>
            <p className="text-5xl text-emerald-bright text-center mb-3">⚡</p>
            <h2 className="font-heading text-xl text-emerald-bright tracking-widest uppercase mb-2 text-center">
              Email potvrdený
            </h2>
            <p className="font-body text-sm text-text-secondary text-center mb-6">
              Trezor je odomknutý. Môžeš sa prihlásiť.
            </p>
            <SuccessBox title="Hotovo" message="Sova zletela späť. Vstup do trezora je tvoj." />
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="font-heading text-xs uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-2.5 rounded-[3px] inline-block hover:-translate-y-px transition-all"
              >
                ⚡ Prihlásiť sa
              </Link>
            </div>
          </>
        )}
        {state === 'fail' && (
          <>
            <ErrorBox title="Verifikácia zlyhala" message={error ?? 'Neznáma chyba'} />
            <div className="mt-6 text-center">
              <Link
                to="/forgot"
                className="font-heading text-[0.65rem] uppercase tracking-widest text-gold hover:text-gold-bright transition-colors"
              >
                Požiadať o nový link →
              </Link>
            </div>
          </>
        )}
      </AuthCard>
    </AuthShell>
  )
}
