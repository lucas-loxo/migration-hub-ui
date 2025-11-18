import { useState, useEffect } from 'react'
// Legacy hook - Apps Script removed, use fetchPreviousATSList from sheets.ts instead
const APPS_SCRIPT_WEBAPP_URL = "" // Removed

const STATIC_ATS_OPTIONS = [
  'Bullhorn',
  'Greenhouse',
  'Lever',
  'Jobvite',
  'Workday',
  'iCIMS',
  'Other',
]

const CACHE_KEY = 'mh_ats_options_v1'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

type CacheData = {
  options: string[]
  ts: number
  source?: 'local-cache' | 'server-cache' | 'live' | 'static'
}

type Source = 'live' | 'server-cache' | 'local-cache' | 'static'

export function useAtsOptions() {
  const [options, setOptions] = useState<string[]>(STATIC_ATS_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<Source>('static')

  useEffect(() => {
    let active = true

    const loadOptions = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check localStorage cache first
        const cachedStr = localStorage.getItem(CACHE_KEY)
        if (cachedStr) {
          try {
            const cached: CacheData = JSON.parse(cachedStr)
            const age = Date.now() - cached.ts
            if (cached.options && Array.isArray(cached.options) && age < CACHE_TTL_MS) {
              if (active) {
                setOptions(cached.options)
                setSource('local-cache')
                setLoading(false)
                return
              }
            }
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }
        
        // No valid cache, need to fetch
        if (!active) return

        // Fetch from server
        if (!APPS_SCRIPT_WEBAPP_URL) {
          throw new Error('APPS_SCRIPT_WEBAPP_URL not configured')
        }

        const url = `${APPS_SCRIPT_WEBAPP_URL}?action=ats`
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
          },
        })
        
        const result = await response.json()
        
        // Check for cache header (may not be available in Apps Script)
        const cacheHeader = response.headers.get('X-ATS-Cache')
        // Fallback to checking response body for cache status
        const cacheStatus = cacheHeader || result._cache
        const responseSource: Source = cacheStatus === 'HIT' ? 'server-cache' : 'live'

        if (!active) return

        if (result.ok && Array.isArray(result.options)) {
          setOptions(result.options)
          setSource(responseSource)
          // Store to localStorage with source
          const cacheData: CacheData = {
            options: result.options,
            ts: Date.now(),
            source: 'local-cache',
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
        } else {
          throw new Error(result.error || 'Failed to fetch ATS options')
        }
      } catch (e: any) {
        if (!active) return
        console.warn('[useAtsOptions] Failed to fetch, using static options:', e)
        setError(e.message || 'Failed to load ATS options')
        setSource('static')
        // Fallback to static options (already set as default)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      active = false
    }
  }, [])

  return { options, loading, error, source }
}

