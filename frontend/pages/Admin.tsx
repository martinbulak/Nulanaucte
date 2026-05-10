import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { apiFetch } from '../utils/api'

interface AdminStats {
  totalUsers: number
  verifiedUsers: number
  unverifiedUsers: number
  lockedUsers: number
  totalBanks: number
  totalTransactions: number
  totalMortgages: number
  recentSignups: Array<{ id: number; email: string; emailVerified: boolean; createdAt: string }>
}

export function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<AdminStats>('/api/admin/stats').then((res) => {
      if (res.ok) setStats(res.data)
      else setErr(res.error)
    })
  }, [])

  if (err) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <p className="font-body text-crimson-bright">{err}</p>
          <p className="font-ui text-sm text-text-muted italic mt-2">
            Iba účty s rolou <code>admin</code> majú prístup. V DB nastav{' '}
            <code className="text-gold">role = 'admin'</code> v tabuľke <code>users</code>.
          </p>
        </Card>
      </div>
    )
  }
  if (!stats) {
    return (
      <p className="font-heading text-sm uppercase tracking-widest text-gold flicker text-center py-10">
        ✦ Načítavam štatistiky ✦
      </p>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 reveal reveal-1">
        <p className="font-heading text-xs uppercase tracking-[0.3em] text-gold mb-2">
          ⚱ Správca trezora ⚱
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-text-primary leading-tight [text-shadow:0_0_40px_rgba(201,151,42,0.3)]">
          <span className="text-gold-bright">Admin</span> — technický prehľad
        </h1>
        <p className="font-body italic text-text-secondary mt-2">
          Iba agregované čísla. Žiadne finančné dáta používateľov.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Stat label="Používatelia celkom" value={stats.totalUsers} accent="gold" />
        <Stat label="Overení" value={stats.verifiedUsers} accent="emerald" />
        <Stat label="Neoverení" value={stats.unverifiedUsers} accent="cobalt" />
        <Stat label="Zamknutí (lockout)" value={stats.lockedUsers} accent="crimson" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <Stat label="Bánk celkom" value={stats.totalBanks} accent="gold" small />
        <Stat label="Transakcií celkom" value={stats.totalTransactions} accent="gold" small />
        <Stat label="Hypoték celkom" value={stats.totalMortgages} accent="gold" small />
      </div>

      <div className="reveal reveal-3">
        <Card>
          <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
            ✦ Posledné registrácie
          </p>
          <h2 className="font-heading text-xl text-text-primary tracking-wide mb-4">
            Top {stats.recentSignups.length} účtov
          </h2>
          <div className="overflow-hidden rounded-[3px] border border-border-dim">
            <table className="w-full font-body">
              <thead className="bg-stone/50">
                <tr className="border-b border-border-dim">
                  <Th>ID</Th>
                  <Th>Email</Th>
                  <Th>Overený</Th>
                  <Th>Vznikol</Th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSignups.map((u) => (
                  <tr key={u.id} className="border-b border-border-dim/50">
                    <Td>{u.id}</Td>
                    <Td>{u.email}</Td>
                    <Td>
                      {u.emailVerified ? (
                        <span className="text-emerald-bright">✓ áno</span>
                      ) : (
                        <span className="text-crimson-bright">⚠ nie</span>
                      )}
                    </Td>
                    <Td className="text-text-muted text-xs">
                      {new Date(u.createdAt).toLocaleString('sk-SK')}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-ui text-xs text-text-muted italic mt-4">
            Admin nevidí transakcie, sumy, popisy, AI odporúčania ani PDF výpisy
            jednotlivých používateľov. Iba ich technický stav.
          </p>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  small,
}: {
  label: string
  value: number
  accent: 'gold' | 'emerald' | 'crimson' | 'cobalt'
  small?: boolean
}) {
  const tone =
    accent === 'gold'
      ? 'text-gold-bright'
      : accent === 'emerald'
      ? 'text-emerald-bright'
      : accent === 'crimson'
      ? 'text-crimson-bright'
      : 'text-cobalt-bright'
  return (
    <Card>
      <p className="font-heading text-[0.65rem] uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p className={`font-display ${small ? 'text-2xl' : 'text-3xl'} ${tone} mt-2`}>{value}</p>
    </Card>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-heading text-[0.6rem] uppercase tracking-widest text-text-muted px-4 py-2.5 text-left font-normal">
      {children}
    </th>
  )
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 text-text-primary text-sm ${className}`}>{children}</td>
}
