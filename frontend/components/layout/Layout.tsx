import { useAuth } from '../../hooks/useAuth'
import { Sidebar } from './Sidebar'
import { RaulClippy } from '../ui/RaulClippy'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <div className="min-h-screen flex">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 px-8 py-10 overflow-x-hidden">
        {children}
      </main>
      {/* Persistent bottom-right tip mascot — hides itself if no cached Raul rec exists */}
      <RaulClippy />
    </div>
  )
}
