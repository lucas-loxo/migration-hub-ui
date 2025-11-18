import { API_BASE_URL } from './env';

export async function postJSON(path: string, body: unknown, init?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
    ...init,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Request type for status sync endpoint
 */
export type StatusSyncRequest = {
  migrationId: string
  targetStatus: string
  customerId?: string
  currentStage?: string
  updatedByUserEmail?: string
}

/**
 * Syncs migration status to GitHub via Zapier webhook
 * This triggers the status sync flow which updates the corresponding GitHub issue
 * Uses no-cors mode for fire-and-forget behavior to avoid CORS issues on GitHub Pages
 */
export async function syncMigrationStatusToGitHub(request: StatusSyncRequest): Promise<void> {
  const payload = {
    migrationId: request.migrationId,
    targetStatus: request.targetStatus,
    customerId: request.customerId,
    currentStage: request.currentStage,
    updatedByUserEmail: request.updatedByUserEmail,
  }

  try {
    await fetch('https://hooks.zapier.com/hooks/catch/25132117/u8vyvfs/', {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    // Fire-and-forget: do not inspect the response, do not throw on non-200.
    return
  } catch (err) {
    console.error('[syncMigrationStatusToGitHub] Zapier status sync failed', err)
    throw new Error('Zapier status sync failed')
  }
}

/**
 * Gets the latest AI draft for a thread from MH_AiEmailLog
 */
export async function getLatestAiDraft(threadId: string, token?: string): Promise<{ draftText: string | null }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  // Include authorization token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/ai-drafts/latest?threadId=${encodeURIComponent(threadId)}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

