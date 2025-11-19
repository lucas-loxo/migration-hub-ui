import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_SCOPES } from '../config'
import { getAccessToken, initGoogle, signIn, signOut, restoreTokenFromStorage } from '../lib/google'

type AuthState = { loading: boolean; authed: boolean; token?: string; userEmail?: string; requestSignIn: () => Promise<void>; requestSignOut: () => void }

const AUTH_STORAGE_KEY = 'mh_auth_user'

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | undefined>(undefined)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    ;(async () => {
      try {
        await initGoogle({ clientId: GOOGLE_OAUTH_CLIENT_ID, scopes: GOOGLE_SCOPES })
        
        // Try to restore email from localStorage first
        const savedEmail = localStorage.getItem('mh_user_email')
        if (savedEmail) {
          setUserEmail(savedEmail)
        }
        
        // Try to restore from localStorage first
        const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
        if (savedAuth) {
          try {
            const { token: savedToken, expiresAt: savedExpiresAt, userEmail: savedUserEmail } = JSON.parse(savedAuth)
            if (savedToken && savedExpiresAt && Date.now() < savedExpiresAt) {
              // Restore token to google.ts module
              restoreTokenFromStorage(savedToken, savedExpiresAt)
              const tk = getAccessToken() || undefined
              if (tk) {
                setToken(tk)
                // Use saved email from auth storage, or fall back to mh_user_email
                if (savedUserEmail) {
                  setUserEmail(savedUserEmail)
                } else if (savedEmail) {
                  setUserEmail(savedEmail)
                }
                setLoading(false)
                return
              }
            }
          } catch (e) {
            // Invalid saved auth, clear it
            localStorage.removeItem(AUTH_STORAGE_KEY)
          }
        }
        
        // Fallback to checking if token exists in google.ts (for backward compatibility)
        const tk = getAccessToken() || undefined
        setToken(tk)
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
      const expiresAt = Date.now() + resp.expires_in * 1000 - 5000
      setToken(accessToken)
      // Use email from sign-in response
      const email = resp.email
      if (email) {
        setUserEmail(email)
        // Email is already stored in localStorage by signIn()
      }
      // Save to localStorage
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        token: accessToken,
        expiresAt: expiresAt,
        userEmail: email
      }))
    } catch (e) {
      console.error(e)
      throw e
    }
  }, [])

  const requestSignOut = useCallback(() => {
    signOut()
    setToken(undefined)
    setUserEmail(undefined)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [])

  const value = useMemo<AuthState>(() => ({ loading, authed: !!token, token, userEmail, requestSignIn, requestSignOut }), [loading, token, userEmail, requestSignIn, requestSignOut])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


