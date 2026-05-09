import { useAuth } from '../../hooks/useAuth'
import { Sidebar } from './Sidebar'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <div className="min-h-screen flex">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 px-8 py-10 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
