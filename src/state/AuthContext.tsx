import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_SCOPES } from '../config'
import { getAccessToken, initGoogle, signIn, signOut } from '../lib/google'

type AuthState = { loading: boolean; authed: boolean; token?: string; userEmail?: string; requestSignIn: () => Promise<void>; requestSignOut: () => void }

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | undefined>(undefined)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    ;(async () => {
      try {
        await initGoogle({ clientId: GOOGLE_OAUTH_CLIENT_ID, scopes: GOOGLE_SCOPES })
        const tk = getAccessToken() || undefined
        setToken(tk)
        if (tk && tk.trim().length > 0) {
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tk}` } })
            if (r.ok) {
              const u = await r.json()
              if (u?.email) setUserEmail(u.email)
            }
          } catch {}
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const requestSignIn = useCallback(async () => {
    try {
      const resp = await signIn('consent')
      const accessToken = resp.access_token
      setToken(accessToken)
      if (accessToken && accessToken.trim().length > 0) {
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
          if (r.ok) {
            const u = await r.json()
            if (u?.email) setUserEmail(u.email)
          }
        } catch {}
      }
    } catch (e) {
      console.error(e)
      throw e
    }
  }, [])

  const requestSignOut = useCallback(() => {
    signOut()
    setToken(undefined)
    setUserEmail(undefined)
  }, [])

  const value = useMemo<AuthState>(() => ({ loading, authed: !!token, token, userEmail, requestSignIn, requestSignOut }), [loading, token, userEmail, requestSignIn, requestSignOut])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


