import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Sidebar } from './Sidebar'
import { MobileTopBar } from './MobileTopBar'
import { RaulClippy } from '../ui/RaulClippy'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!user) return null

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar — drawer on mobile, sticky aside on lg+ */}
      <Sidebar
        user={user}
        onLogout={logout}
        mobileOpen={drawerOpen}
        onMobileClose={() => setDrawerOpen(false)}
      />

      {/* Right pane = mobile bar (mobile only) + main content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <MobileTopBar user={user} onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-10 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Persistent bottom-right tip mascot — hides itself if no cached Raul rec exists */}
      <RaulClippy />
    </div>
  )
}
