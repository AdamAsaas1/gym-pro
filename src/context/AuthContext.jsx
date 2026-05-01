/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  loginAuth,
  logoutAuth,
  meAuth,
  setTokens,
} from '../api/client'

const USER_STORAGE_KEY = 'gym_user_v1'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser())
  const [loadingAuth, setLoadingAuth] = useState(true)

  const syncUser = useCallback((nextUser) => {
    setUser(nextUser)
    if (nextUser) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
    else localStorage.removeItem(USER_STORAGE_KEY)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        await logoutAuth(refreshToken)
      } catch {
        // Ignore network/logout errors and continue local cleanup.
      }
    }
    clearTokens()
    syncUser(null)
  }, [syncUser])

  const login = useCallback(async ({ username, password }) => {
    const data = await loginAuth(username, password)
    setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
    syncUser(data.user)
    return data.user
  }, [syncUser])

  const refreshMe = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      syncUser(null)
      return null
    }

    try {
      const me = await meAuth()
      syncUser(me)
      return me
    } catch {
      await logout()
      return null
    }
  }, [logout, syncUser])

  useEffect(() => {
    let ignore = false
    async function init() {
      await refreshMe()
      if (!ignore) setLoadingAuth(false)
    }
    init()
    return () => { ignore = true }
  }, [refreshMe])

  const value = useMemo(
    () => ({
      user,
      loadingAuth,
      isAuthenticated: !!user,
      login,
      logout,
      refreshMe,
    }),
    [user, loadingAuth, login, logout, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
