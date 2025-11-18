export function toSearch(obj: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => {
    if (v) sp.set(k, v)
  })
  return `?${sp.toString()}`
}

