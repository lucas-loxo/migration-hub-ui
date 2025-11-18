let logged = false

export function getSheetsId(): string {
  const id = (import.meta as any).env?.VITE_SHEETS_ID as string | undefined
  if (import.meta.env.DEV && id && !logged) {
    console.log('[ENV] Sheets ID loaded')
    logged = true
  }
  if (!id) {
    throw new Error('Sheets ID missing. Set VITE_SHEETS_ID in .env.local (dev) or GH Actions secrets (prod).')
  }
  return id
}

export function hasSheetsId(): boolean {
  return !!((import.meta as any).env?.VITE_SHEETS_ID as string | undefined)
}

export function getWriteWithAiWebhookUrl(): string {
  const url = (import.meta as any).env?.VITE_ZAPIER_WRITE_WITH_AI_WEBHOOK_URL as string | undefined
  if (!url) {
    throw new Error('Write with AI webhook URL is missing. Set VITE_ZAPIER_WRITE_WITH_AI_WEBHOOK_URL in .env.local (dev) or GH Actions secrets (prod).')
  }
  return url
}

export function hasWriteWithAiWebhookUrl(): boolean {
  return !!((import.meta as any).env?.VITE_ZAPIER_WRITE_WITH_AI_WEBHOOK_URL as string | undefined)
}

