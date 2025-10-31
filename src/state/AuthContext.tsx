import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_SCOPES } from '../config'
import { getAccessToken, initGoogle, signIn, signOut } from '../lib/google'

type AuthState = { authed: boolean; token?: string; userEmail?: string; requestSignIn: () => Promise<void>; requestSignOut: () => void }

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | undefined>(undefined)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    ;(async () => {
      try {
        await initGoogle({ clientId: GOOGLE_OAUTH_CLIENT_ID, scopes: GOOGLE_SCOPES })
      } catch (e) {
        console.error(e)
      } finally {
        setReady(true)
        const tk = getAccessToken() || undefined
        setToken(tk)
        if (tk) {
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tk}` } })
            if (r.ok) {
              const u = await r.json()
              if (u?.email) setUserEmail(u.email)
            }
          } catch {}
        }
      }
    })()
  }, [])

  const requestSignIn = useCallback(async () => {
    try {
      const resp = await signIn('consent')
      setToken(resp.access_token)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${resp.access_token}` } })
        if (r.ok) {
          const u = await r.json()
          if (u?.email) setUserEmail(u.email)
        }
      } catch {}
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

  const value = useMemo<AuthState>(() => ({ authed: !!token, token, userEmail, requestSignIn, requestSignOut }), [token, userEmail, requestSignIn, requestSignOut])
  if (!ready) return <></>
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


