/**
 * AI helper for Write with AI feature
 */

import { postJSON } from './apiClient'

export type WriteWithAiPayload = {
  mode: 'write_with_ai'
  threadId: string  // ThreadID from the current thread
  userNote: string
  threadMessages: Array<{
    direction: 'incoming' | 'outgoing' | 'internal'
    fromEmail: string | null
    fromName: string | null
    subject: string | null
    bodyPlain: string | null
    sentAt: string | null
    createdAt: string | null
  }>
  migration?: {
    migrationId: string
    customerName: string
    stage: string
    ownerEmail: string
    previousATS?: string
    dataMethod?: string
    tier?: string
    pod?: string
  }
  customer?: {
    customerName: string
    primaryContactName?: string
    primaryContactEmail?: string
    previousATS?: string
    customerSegment?: string
  }
}

export type WriteWithAiResponse = {
  draftBodyPlain?: string  // Optional - draft is now fetched from MH_AiEmailLog
  model?: string
}

/**
 * Request AI draft via our backend API (which proxies to Zapier webhook)
 * Note: The draft body is no longer returned directly. Instead, it's written to MH_AiEmailLog
 * and should be fetched separately using getLatestAiDraft().
 */
export async function requestWriteWithAi(payload: WriteWithAiPayload): Promise<WriteWithAiResponse> {
  try {
    const data = await postJSON('/write-with-ai', payload)

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from Write with AI API: expected JSON object')
    }

    // draftBodyPlain is optional - we no longer expect it in the response
    // The draft will be written to MH_AiEmailLog by Zapier and fetched separately
    return {
      draftBodyPlain: typeof data.draftBodyPlain === 'string' ? data.draftBodyPlain : undefined,
      model: data.model || undefined,
    }
  } catch (e: any) {
    if (e instanceof Error) {
      throw e
    }
    throw new Error(`Write with AI request failed: ${String(e)}`)
  }
}

