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

export async function getMigrationById(migrationId) {
  if (!APPS_SCRIPT_API_URL) {
    const m = sampleMigrations.find((x) => String(x.MigrationID) === String(migrationId))
    if (!m) return null
    // derive rich record
    return {
      migrationId: m.MigrationID,
      customerId: m.CustomerID ?? 'C-000',
      customer: m.Customer,
      stage: m.Stage,
      daysInStage: typeof m.Days === 'number' ? m.Days : 0,
      owner: m.Owner,
      githubStatus: 'In Progress',
      startDate: '2025-10-01',
      estimatedGoLive: '2025-11-15',
      notes: ['Kickoff complete', 'Waiting on data upload'],
      documents: [
        { title: 'Data Export Guide', url: 'https://example.com/guide.pdf' },
        { title: 'SOW.pdf' },
      ],
      stageHistory: [
        { stage: 'Discovery', date: '2025-10-02' },
        { stage: m.Stage, date: '2025-10-10' },
      ],
      stageCompletions: [
        { date: '2025-10-03', count: 1 },
        { date: '2025-10-10', count: 2 },
        { date: '2025-10-17', count: 1 },
      ],
    }
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getMigrationById&migrationId=${encodeURIComponent(migrationId)}`)
    return data || null
  } catch (err) {
    console.error('[MH-UI] getMigrationById failed', err)
    throw err
  }
}

export async function getRemappingItems(migrationId) {
  if (!APPS_SCRIPT_API_URL) {
    return [
      { id: '1', field: 'CandidateName', from: 'name', to: 'full_name', status: 'Needs Review', createdAt: '2025-10-01' },
      { id: '2', field: 'Email', from: 'email_address', to: 'email', status: 'Approved', createdAt: '2025-10-02' },
      { id: '3', field: 'Phone', from: 'phone_number', to: 'phone', status: 'Pending', createdAt: '2025-10-03' },
    ]
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getRemappingItems&migrationId=${encodeURIComponent(migrationId)}`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[MH-UI] getRemappingItems failed', err)
    throw err
  }
}

export async function getKpis(ownerEmail) {
  if (!APPS_SCRIPT_API_URL) {
    // derive from sample as a fallback
    const total = sampleMigrations.length
    const behind = sampleMigrations.filter((m) => m.Status === 'Behind').length
    const dueToday = sampleMigrations.filter((m) => Number(m.Days) === 0).length
    const avgDays = sampleMigrations.reduce((acc, m) => acc + (Number(m.Days) || 0), 0) / (total || 1)
    return { activeMigrations: total, behind, dueToday, avgDaysInStage: Math.round(avgDays) }
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getKpis${ownerEmail ? `&owner=${encodeURIComponent(ownerEmail)}` : ''}`)
    return data || { activeMigrations: 0, behind: 0, dueToday: 0, avgDaysInStage: 0 }
  } catch (err) {
    console.error('[MH-UI] getKpis failed', err)
    return { activeMigrations: 0, behind: 0, dueToday: 0, avgDaysInStage: 0 }
  }
}

export async function getTeamWorkload() {
  if (!APPS_SCRIPT_API_URL) {
    return [
      { team: 'BTC', pct: 35 },
      { team: 'Engineering', pct: 40 },
      { team: 'Customer Success', pct: 25 },
    ]
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getTeamWorkload`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[MH-UI] getTeamWorkload failed', err)
    return []
  }
}

export async function getRecentActivities(limit = 5) {
  if (!APPS_SCRIPT_API_URL) {
    return [
      { id: 'a1', text: 'Acme advanced to Mapping', ts: '2025-10-10T10:00:00Z' },
      { id: 'a2', text: 'Globex draft emailed', ts: '2025-10-09T15:20:00Z' },
      { id: 'a3', text: 'Umbrella data import validated', ts: '2025-10-08T12:05:00Z' },
      { id: 'a4', text: 'Wayne created mapping rules', ts: '2025-10-07T18:40:00Z' },
      { id: 'a5', text: 'Stark went live', ts: '2025-10-06T09:15:00Z' },
    ].slice(0, limit)
  }
  try {
    const data = await fetchJson(`${APPS_SCRIPT_API_URL}?action=getRecentActivities&limit=${limit}`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[MH-UI] getRecentActivities failed', err)
    return []
  }
}


