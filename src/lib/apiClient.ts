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
 */
export async function syncMigrationStatusToGitHub(request: StatusSyncRequest): Promise<{ success: boolean }> {
  return postJSON('/migrations/status-sync', request)
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

