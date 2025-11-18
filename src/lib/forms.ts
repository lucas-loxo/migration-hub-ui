export function buildPrefilledFormUrl(baseUrl: string, params: Record<string, unknown> = {}): string {
  try {
    const url = new URL(baseUrl)
    const sp = url.searchParams
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      sp.set(String(k), String(v))
    })
    url.search = sp.toString()
    return url.toString()
  } catch {
    return baseUrl
  }
}


