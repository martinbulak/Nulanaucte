import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../utils/api'

export interface AuthUser {
  id: number
  email: string
  name?: string | null
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch<AuthUser>('/api/auth/me')
    if (res.ok) setUser(res.data)
    else setUser(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.location.href = '/login'
  }, [])

  return { user, loading, refresh, logout }
}
