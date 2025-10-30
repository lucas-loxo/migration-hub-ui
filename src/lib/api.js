import { APPS_SCRIPT_API_URL } from './config.js'
import { migrations as sampleMigrations, stagePerformance as sampleStagePerformance } from './sampleData.js'

async function fetchJson(url, init) {
  const res = await fetch(url, {
    mode: 'cors',
    headers: {
      'Accept': 'application/json',
      ...(init && init.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...init,
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function getMigrations() {
  if (!APPS_SCRIPT_API_URL) {
    return Promise.resolve(sampleMigrations)
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getMigrations`)
    return Array.isArray(data) ? data : sampleMigrations
  } catch (err) {
    // Fail loud if URL is configured
    console.error('[MH-UI] getMigrations failed', err)
    throw err
  }
}

export async function getStagePerformance(ownerEmail) {
  if (!APPS_SCRIPT_API_URL) {
    if (!ownerEmail) return Promise.resolve(sampleStagePerformance)
    // Optionally filter sample by owner
    return Promise.resolve(sampleStagePerformance)
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getStagePerformance${ownerEmail ? `&owner=${encodeURIComponent(ownerEmail)}` : ''}`)
    return Array.isArray(data) ? data : sampleStagePerformance
  } catch (err) {
    console.error('[MH-UI] getStagePerformance failed', err)
    throw err
  }
}

export async function updateMigrationStatus(migrationId, newStageOrStatus) {
  if (!APPS_SCRIPT_API_URL) {
    // no-op in fallback
    return Promise.resolve({ ok: true })
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=updateMigrationStatus`, {
      method: 'POST',
      body: JSON.stringify({ migrationId, newStageOrStatus }),
    })
    return { ok: data?.ok === true }
  } catch (err) {
    console.error('[MH-UI] updateMigrationStatus failed', err)
    throw err
  }
}


