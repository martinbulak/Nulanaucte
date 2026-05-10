import { Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Verify } from './pages/Verify'
import { Forgot } from './pages/Forgot'
import { Reset } from './pages/Reset'
import { Dashboard } from './pages/Dashboard'
import { Banky } from './pages/Banky'
import { Prijmy } from './pages/Prijmy'
import { Vydavky } from './pages/Vydavky'
import { Hypoteky } from './pages/Hypoteky'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import { Layout } from './components/layout/Layout'
import { useAuth } from './hooks/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-heading text-sm uppercase tracking-widest text-gold flicker">
          ✦ Otváram trezor ✦
        </span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />

      {/* Protected app */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/banky" element={<ProtectedRoute><Banky /></ProtectedRoute>} />
      <Route path="/prijmy" element={<ProtectedRoute><Prijmy /></ProtectedRoute>} />
      <Route path="/vydavky" element={<ProtectedRoute><Vydavky /></ProtectedRoute>} />
      <Route path="/hypoteky" element={<ProtectedRoute><Hypoteky /></ProtectedRoute>} />
      <Route path="/nastavenia" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
