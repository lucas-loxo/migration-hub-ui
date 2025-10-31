type InitArgs = { clientId: string; scopes: string[] }

let gisLoaded = false
let token: string | null = null
let expiresAt = 0
let tokenClient: any = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('GIS failed to load')))
      if ((existing as HTMLScriptElement).readyState === 'complete') resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('GIS failed to load'))
    document.head.appendChild(s)
  })
}

export async function initGoogle({ clientId, scopes }: InitArgs) {
  if (gisLoaded) return
  await loadScript('https://accounts.google.com/gsi/client')
  // @ts-ignore
  if (!(window as any).google || !(window as any).google.accounts?.oauth2) {
    throw new Error('Google Identity Services not available')
  }
  // @ts-ignore
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    // join scopes with space
    scope: scopes.join(' '),
    callback: (resp: any) => {
      if (resp && resp.access_token) {
        token = resp.access_token
        const expiresIn = Number(resp.expires_in || 0)
        expiresAt = Date.now() + expiresIn * 1000 - 5000
      }
    },
  })
  gisLoaded = true
}

export function signIn(prompt = 'consent'): Promise<{ access_token: string; expires_in: number }> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Token client not initialized'))
    // @ts-ignore
    tokenClient.callback = (resp: any) => {
      if (resp?.error) return reject(new Error(resp.error))
      if (resp?.access_token) {
        token = resp.access_token
        const expiresIn = Number(resp.expires_in || 0)
        expiresAt = Date.now() + expiresIn * 1000 - 5000
        resolve({ access_token: token!, expires_in: expiresIn })
      } else {
        reject(new Error('No access token'))
      }
    }
    try {
      // @ts-ignore
      tokenClient.requestAccessToken({ prompt })
    } catch (e) {
      reject(e as Error)
    }
  })
}

export function signOut() {
  token = null
  expiresAt = 0
}

export function getAccessToken(): string | null {
  if (!token) return null
  if (Date.now() >= expiresAt) return null
  return token
}


