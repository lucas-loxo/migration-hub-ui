import { getAccessToken } from './google'
import { getSheetsId } from '../config/env'

const SHEETS_ID = (import.meta as any).env?.VITE_SHEETS_ID as string | undefined

export type MigrationSnapshot = {
  CustomerID: string
  CustomerName: string
  Stage: string
  DaysInStage: number | null
  Status: 'On Track' | 'Behind' | string
  OwnerEmail: string
  GH_IssueURL?: string
  ghStatus?: string  // GitHub status from MH_View_Migrations GH_Status column (e.g., "Gathering Requirements", "Ready to Work", etc.)
  previousATS?: string
  payingUsers?: number | string
  customerSegment?: string
  dataMethod?: string
  intakeNotes?: string
  pod?: string
  tier?: string
  churnZeroLink?: string
  MigrationID?: string
  GH_IssueNumber?: string
  primaryContactName?: string
  primaryContactEmail?: string
  secondaryContactName?: string
  secondaryContactEmail?: string
  tertiaryContactName?: string
  tertiaryContactEmail?: string
  attachments?: string
}

export type CustomerProfile = {
  CustomerID: string
  CustomerName: string
  PreviousATS: string
  Seats: string | number | null
  ChurnZeroLink: string
  GitHubLink: string
  CustomerSegment: string
  PrimaryContactName: string
  PrimaryContactEmail: string
  SecondaryContactName: string
  SecondaryContactEmail: string
  Notes: string
}

export type Activity = {
  migrationId: string
  migrationTitle?: string
  eventId?: string
  eventType?: string
  source?: string
  actor?: string
  occurredAt?: string
  prevStage?: string
  newStage?: string
  githubIssueId?: string
  githubIssueUrl?: string
  gmailThreadId?: string
  details?: string
}

async function fetchValues(range: string, token?: string): Promise<string[][]> {
  const accessToken = token || getAccessToken()
  if (!accessToken) throw new Error('Not authenticated. Please sign in to Google.')
  const id = SHEETS_ID || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k'
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API error ${res.status}: ${err || res.statusText}`)
  }
  const json = await res.json()
  const rows: string[][] = json.values || []
  return rows
}

function byHeader(rows: string[][], headerName: string): number {
  if (!rows || rows.length === 0) {
    throw new Error(`Cannot find header "${headerName}": no rows in sheet`)
  }
  const headers = rows[0].map((h) => String(h ?? '').trim())
  const index = headers.findIndex((h) => h === headerName)
  if (index === -1) {
    throw new Error(`Header "${headerName}" not found. Available headers: ${headers.join(', ')}`)
  }
  return index
}

function getValue(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return ''
  return String(row[index] ?? '').trim()
}

export async function fetchMigrationSnapshot(customerId: string): Promise<MigrationSnapshot | null> {
  try {
    // Use a wide range to ensure all columns are included (A1:ZZ covers up to column ZZ)
    const grid = await fetchValues('MH_View_Migrations!A1:ZZ')
    if (!Array.isArray(grid) || grid.length === 0) {
      return null
    }

    // Required headers: Status is now derived from Is_Behind, not required in sheet
    const required = ['CustomerID', 'CustomerName', 'Stage', 'DaysInStage', 'OwnerEmail']
    const idx: Record<string, number> = {}
    for (const h of required) {
      try {
        idx[h] = byHeader(grid, h)
      } catch (e: any) {
        console.warn(`[CustomerPage] Missing header "${h}" in MH_View_Migrations:`, e.message)
        return null
      }
    }
    // Is_Behind is optional but preferred - find it if present
    try {
      idx['Is_Behind'] = byHeader(grid, 'Is_Behind')
    } catch {
      // Is_Behind not found, will default to "On Track"
      idx['Is_Behind'] = -1
    }
    // GH_IssueURL is optional - find it if present
    try {
      idx['GH_IssueURL'] = byHeader(grid, 'GH_IssueURL')
    } catch {
      // GH_IssueURL not found, will be undefined
      idx['GH_IssueURL'] = -1
    }
    // GH_Status is optional - find it if present (column K in MH_View_Migrations)
    try {
      idx['GH_Status'] = byHeader(grid, 'GH_Status')
    } catch {
      // GH_Status not found, will be undefined
      idx['GH_Status'] = -1
    }
    
    // Optional fields - find them if present
    // Try both with spaces and without spaces for contact fields
    const optionalFields = ['PreviousATS', 'PayingUsers', 'CustomerSegment', 'DataMethod', 'IntakeNotes', 'Pod', 'Tier', 'ChurnZeroLink', 'MigrationID', 'GH_IssueNumber', 'Attachments']
    for (const field of optionalFields) {
      try {
        idx[field] = byHeader(grid, field)
      } catch {
        idx[field] = -1
      }
    }
    
    // Contact fields - try both variations (with and without spaces)
    const contactFields = [
      { key: 'Primary Contact Name', variants: ['Primary Contact Name', 'PrimaryContactName'] },
      { key: 'Primary Contact Email', variants: ['Primary Contact Email', 'PrimaryContactEmail'] },
      { key: 'Secondary Contact Name', variants: ['Secondary Contact Name', 'SecondaryContactName'] },
      { key: 'Secondary Contact Email', variants: ['Secondary Contact Email', 'SecondaryContactEmail'] },
      { key: 'Tertiary Contact Name', variants: ['Tertiary Contact Name', 'TertiaryContactName'] },
      { key: 'Tertiary Contact Email', variants: ['Tertiary Contact Email', 'TertiaryContactEmail'] },
    ]
    for (const field of contactFields) {
      let found = false
      for (const variant of field.variants) {
        try {
          idx[field.key] = byHeader(grid, variant)
          found = true
          break
        } catch {
          // Try next variant
        }
      }
      if (!found) {
        idx[field.key] = -1
      }
    }

    // Find row matching customerId (case-sensitive match)
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowCustomerId = getValue(row, idx['CustomerID'])

      if (rowCustomerId === customerId) {
        const customerName = getValue(row, idx['CustomerName'])
        const stage = getValue(row, idx['Stage'])
        const daysInStageStr = getValue(row, idx['DaysInStage'])
        const ownerEmail = getValue(row, idx['OwnerEmail'])
        
        // Derive Status from Is_Behind: TRUE -> "Behind", else "On Track"
        const isBehindRaw = idx['Is_Behind'] >= 0 ? getValue(row, idx['Is_Behind']) : ''
        const isBehind = isBehindRaw === 'TRUE' || isBehindRaw === 'True' || isBehindRaw === 'true' || isBehindRaw === '1'
        const status = isBehind ? 'Behind' : 'On Track'

        const daysInStage = daysInStageStr ? Number(daysInStageStr) : null
        const ghIssueURL = idx['GH_IssueURL'] >= 0 ? getValue(row, idx['GH_IssueURL']) : undefined
        
        // Read optional fields
        const previousATS = idx['PreviousATS'] >= 0 ? getValue(row, idx['PreviousATS']) : undefined
        const payingUsersStr = idx['PayingUsers'] >= 0 ? getValue(row, idx['PayingUsers']) : undefined
        const payingUsers = payingUsersStr ? (Number.isFinite(Number(payingUsersStr)) ? Number(payingUsersStr) : payingUsersStr) : undefined
        const customerSegment = idx['CustomerSegment'] >= 0 ? getValue(row, idx['CustomerSegment']) : undefined
        const dataMethod = idx['DataMethod'] >= 0 ? getValue(row, idx['DataMethod']) : undefined
        const intakeNotes = idx['IntakeNotes'] >= 0 ? getValue(row, idx['IntakeNotes']) : undefined
        const pod = idx['Pod'] >= 0 ? getValue(row, idx['Pod']) : undefined
        const tier = idx['Tier'] >= 0 ? getValue(row, idx['Tier']) : undefined
        const churnZeroLink = idx['ChurnZeroLink'] >= 0 ? getValue(row, idx['ChurnZeroLink']) : undefined
        const migrationID = idx['MigrationID'] >= 0 ? getValue(row, idx['MigrationID']) : undefined
        const ghIssueNumber = idx['GH_IssueNumber'] >= 0 ? getValue(row, idx['GH_IssueNumber']) : undefined
        const ghStatus = idx['GH_Status'] >= 0 ? getValue(row, idx['GH_Status']) : undefined
        const primaryContactName = idx['Primary Contact Name'] >= 0 ? getValue(row, idx['Primary Contact Name']) : undefined
        const primaryContactEmail = idx['Primary Contact Email'] >= 0 ? getValue(row, idx['Primary Contact Email']) : undefined
        const secondaryContactName = idx['Secondary Contact Name'] >= 0 ? getValue(row, idx['Secondary Contact Name']) : undefined
        const secondaryContactEmail = idx['Secondary Contact Email'] >= 0 ? getValue(row, idx['Secondary Contact Email']) : undefined
        const tertiaryContactName = idx['Tertiary Contact Name'] >= 0 ? getValue(row, idx['Tertiary Contact Name']) : undefined
        const tertiaryContactEmail = idx['Tertiary Contact Email'] >= 0 ? getValue(row, idx['Tertiary Contact Email']) : undefined

        return {
          CustomerID: customerId,
          CustomerName: customerName,
          Stage: stage,
          DaysInStage: Number.isFinite(daysInStage) ? daysInStage : null,
          Status: status,
          OwnerEmail: ownerEmail,
          GH_IssueURL: ghIssueURL || undefined,
          previousATS: previousATS || undefined,
          payingUsers: payingUsers,
          customerSegment: customerSegment || undefined,
          dataMethod: dataMethod || undefined,
          intakeNotes: intakeNotes || undefined,
          pod: pod || undefined,
          tier: tier || undefined,
          churnZeroLink: churnZeroLink || undefined,
          MigrationID: migrationID || undefined,
          GH_IssueNumber: ghIssueNumber || undefined,
          ghStatus: ghStatus || undefined,
          primaryContactName: primaryContactName || undefined,
          primaryContactEmail: primaryContactEmail || undefined,
          secondaryContactName: secondaryContactName || undefined,
          secondaryContactEmail: secondaryContactEmail || undefined,
          tertiaryContactName: tertiaryContactName || undefined,
          tertiaryContactEmail: tertiaryContactEmail || undefined,
        }
      }
    }

    return null
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/MH_View_Migrations not found/.test(msg)) {
      throw new Error('MH_View_Migrations tab not found in Google Sheets')
    }
    throw e
  }
}

export async function fetchMigrationSnapshotByMigrationId(migrationId: string): Promise<MigrationSnapshot | null> {
  try {
    // Use a wide range to ensure all columns are included
    const grid = await fetchValues('MH_View_Migrations!A1:ZZ')
    if (!Array.isArray(grid) || grid.length === 0) {
      return null
    }

    // Required headers
    const required = ['CustomerID', 'CustomerName', 'Stage', 'DaysInStage', 'OwnerEmail', 'MigrationID']
    const idx: Record<string, number> = {}
    for (const h of required) {
      try {
        idx[h] = byHeader(grid, h)
      } catch (e: any) {
        console.warn(`[MessagingPage] Missing header "${h}" in MH_View_Migrations:`, e.message)
        return null
      }
    }
    // Is_Behind is optional but preferred
    try {
      idx['Is_Behind'] = byHeader(grid, 'Is_Behind')
    } catch {
      idx['Is_Behind'] = -1
    }
    // GH_IssueURL is optional
    try {
      idx['GH_IssueURL'] = byHeader(grid, 'GH_IssueURL')
    } catch {
      idx['GH_IssueURL'] = -1
    }
    // GH_Status is optional - find it if present (column K in MH_View_Migrations)
    try {
      idx['GH_Status'] = byHeader(grid, 'GH_Status')
    } catch {
      // GH_Status not found, will be undefined
      idx['GH_Status'] = -1
    }
    // Optional fields
    const optionalFields = ['PreviousATS', 'PayingUsers', 'CustomerSegment', 'DataMethod', 'IntakeNotes', 'Pod', 'Tier', 'ChurnZeroLink', 'GH_IssueNumber', 'Attachments']
    for (const field of optionalFields) {
      try {
        idx[field] = byHeader(grid, field)
      } catch {
        idx[field] = -1
      }
    }
    
    // Contact fields - try both variations
    const contactFields = [
      { key: 'Primary Contact Name', variants: ['Primary Contact Name', 'PrimaryContactName'] },
      { key: 'Primary Contact Email', variants: ['Primary Contact Email', 'PrimaryContactEmail'] },
      { key: 'Secondary Contact Name', variants: ['Secondary Contact Name', 'SecondaryContactName'] },
      { key: 'Secondary Contact Email', variants: ['Secondary Contact Email', 'SecondaryContactEmail'] },
      { key: 'Tertiary Contact Name', variants: ['Tertiary Contact Name', 'TertiaryContactName'] },
      { key: 'Tertiary Contact Email', variants: ['Tertiary Contact Email', 'TertiaryContactEmail'] },
    ]
    for (const field of contactFields) {
      let found = false
      for (const variant of field.variants) {
        try {
          idx[field.key] = byHeader(grid, variant)
          found = true
          break
        } catch {
          // Try next variant
        }
      }
      if (!found) {
        idx[field.key] = -1
      }
    }

    // Find row matching migrationId (case-insensitive)
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowMigrationId = getValue(row, idx['MigrationID'])

      if (rowMigrationId.toLowerCase() === migrationId.toLowerCase()) {
        const customerId = getValue(row, idx['CustomerID'])
        const customerName = getValue(row, idx['CustomerName'])
        const stage = getValue(row, idx['Stage'])
        const daysInStageStr = getValue(row, idx['DaysInStage'])
        const ownerEmail = getValue(row, idx['OwnerEmail'])
        
        // Derive Status from Is_Behind
        const isBehindRaw = idx['Is_Behind'] >= 0 ? getValue(row, idx['Is_Behind']) : ''
        const isBehind = isBehindRaw === 'TRUE' || isBehindRaw === 'True' || isBehindRaw === 'true' || isBehindRaw === '1'
        const status = isBehind ? 'Behind' : 'On Track'

        const daysInStage = daysInStageStr ? Number(daysInStageStr) : null
        const ghIssueURL = idx['GH_IssueURL'] >= 0 ? getValue(row, idx['GH_IssueURL']) : undefined
        
        // Read optional fields
        const previousATS = idx['PreviousATS'] >= 0 ? getValue(row, idx['PreviousATS']) : undefined
        const payingUsersStr = idx['PayingUsers'] >= 0 ? getValue(row, idx['PayingUsers']) : undefined
        const payingUsers = payingUsersStr ? (Number.isFinite(Number(payingUsersStr)) ? Number(payingUsersStr) : payingUsersStr) : undefined
        const customerSegment = idx['CustomerSegment'] >= 0 ? getValue(row, idx['CustomerSegment']) : undefined
        const dataMethod = idx['DataMethod'] >= 0 ? getValue(row, idx['DataMethod']) : undefined
        const intakeNotes = idx['IntakeNotes'] >= 0 ? getValue(row, idx['IntakeNotes']) : undefined
        const pod = idx['Pod'] >= 0 ? getValue(row, idx['Pod']) : undefined
        const tier = idx['Tier'] >= 0 ? getValue(row, idx['Tier']) : undefined
        const churnZeroLink = idx['ChurnZeroLink'] >= 0 ? getValue(row, idx['ChurnZeroLink']) : undefined
        const ghIssueNumber = idx['GH_IssueNumber'] >= 0 ? getValue(row, idx['GH_IssueNumber']) : undefined
        const ghStatus = idx['GH_Status'] >= 0 ? getValue(row, idx['GH_Status']) : undefined
        const primaryContactName = idx['Primary Contact Name'] >= 0 ? getValue(row, idx['Primary Contact Name']) : undefined
        const primaryContactEmail = idx['Primary Contact Email'] >= 0 ? getValue(row, idx['Primary Contact Email']) : undefined
        const secondaryContactName = idx['Secondary Contact Name'] >= 0 ? getValue(row, idx['Secondary Contact Name']) : undefined
        const secondaryContactEmail = idx['Secondary Contact Email'] >= 0 ? getValue(row, idx['Secondary Contact Email']) : undefined
        const tertiaryContactName = idx['Tertiary Contact Name'] >= 0 ? getValue(row, idx['Tertiary Contact Name']) : undefined
        const tertiaryContactEmail = idx['Tertiary Contact Email'] >= 0 ? getValue(row, idx['Tertiary Contact Email']) : undefined
        const attachments = idx['Attachments'] >= 0 ? getValue(row, idx['Attachments']) : undefined

        return {
          CustomerID: customerId,
          CustomerName: customerName,
          Stage: stage,
          DaysInStage: Number.isFinite(daysInStage) ? daysInStage : null,
          Status: status,
          OwnerEmail: ownerEmail,
          GH_IssueURL: ghIssueURL || undefined,
          previousATS: previousATS || undefined,
          payingUsers: payingUsers,
          customerSegment: customerSegment || undefined,
          dataMethod: dataMethod || undefined,
          intakeNotes: intakeNotes || undefined,
          pod: pod || undefined,
          tier: tier || undefined,
          churnZeroLink: churnZeroLink || undefined,
          MigrationID: rowMigrationId || undefined,
          GH_IssueNumber: ghIssueNumber || undefined,
          ghStatus: ghStatus || undefined,
          primaryContactName: primaryContactName || undefined,
          primaryContactEmail: primaryContactEmail || undefined,
          secondaryContactName: secondaryContactName || undefined,
          secondaryContactEmail: secondaryContactEmail || undefined,
          tertiaryContactName: tertiaryContactName || undefined,
          tertiaryContactEmail: tertiaryContactEmail || undefined,
          attachments: attachments || undefined,
        }
      }
    }

    return null
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/MH_View_Migrations not found/.test(msg)) {
      throw new Error('MH_View_Migrations tab not found in Google Sheets')
    }
    throw e
  }
}

export async function fetchCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  try {
    const grid = await fetchValues('Customers!A1:Z')
    if (!Array.isArray(grid) || grid.length === 0) {
      return null
    }

    const required = [
      'CustomerID',
      'CustomerName',
      'PreviousATS',
      'Seats',
      'ChurnZeroLink',
      'GitHubLink',
      'CustomerSegment',
      'PrimaryContactName',
      'PrimaryContactEmail',
      'SecondaryContactName',
      'SecondaryContactEmail',
      'Notes',
    ]

    const idx: Record<string, number> = {}
    for (const h of required) {
      try {
        idx[h] = byHeader(grid, h)
      } catch (e: any) {
        console.warn(`[CustomerPage] Missing header "${h}" in Customers:`, e.message)
        return null
      }
    }

    // Find row matching customerId
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowCustomerId = getValue(row, idx['CustomerID'])

      if (rowCustomerId === customerId) {
        const seatsStr = getValue(row, idx['Seats'])
        const seats = seatsStr ? (Number.isFinite(Number(seatsStr)) ? Number(seatsStr) : seatsStr) : null

        return {
          CustomerID: customerId,
          CustomerName: getValue(row, idx['CustomerName']),
          PreviousATS: getValue(row, idx['PreviousATS']),
          Seats: seats,
          ChurnZeroLink: getValue(row, idx['ChurnZeroLink']),
          GitHubLink: getValue(row, idx['GitHubLink']),
          CustomerSegment: getValue(row, idx['CustomerSegment']),
          PrimaryContactName: getValue(row, idx['PrimaryContactName']),
          PrimaryContactEmail: getValue(row, idx['PrimaryContactEmail']),
          SecondaryContactName: getValue(row, idx['SecondaryContactName']),
          SecondaryContactEmail: getValue(row, idx['SecondaryContactEmail']),
          Notes: getValue(row, idx['Notes']),
        }
      }
    }

    return null
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/Customers not found/.test(msg)) {
      throw new Error('Customers tab not found in Google Sheets')
    }
    throw e
  }
}

export async function getActivitiesForMigration(migrationId: string): Promise<Activity[]> {
  try {
    const grid = await fetchValues('MH_Activities!A1:Z')
    if (!Array.isArray(grid) || grid.length === 0) {
      return []
    }

    // Find header indices
    const headers = grid[0].map((h) => String(h ?? '').trim())
    const idx: Record<string, number> = {}
    const columnNames = [
      'migration_id',
      'migration_title',
      'event_id',
      'event_type',
      'source',
      'actor',
      'occurred_at',
      'prev_stage',
      'new_stage',
      'github_issue_id',
      'github_issue_url',
      'gmail_thread_id',
      'details',
    ]

    for (const colName of columnNames) {
      const headerIndex = headers.findIndex((h) => h.toLowerCase() === colName.toLowerCase())
      idx[colName] = headerIndex >= 0 ? headerIndex : -1
    }

    // Filter and map rows
    const activities: Activity[] = []
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowMigrationId = idx['migration_id'] >= 0 ? getValue(row, idx['migration_id']) : ''

      if (rowMigrationId === migrationId) {
        const activity: Activity = {
          migrationId: rowMigrationId,
          migrationTitle: idx['migration_title'] >= 0 ? getValue(row, idx['migration_title']) : undefined,
          eventId: idx['event_id'] >= 0 ? getValue(row, idx['event_id']) : undefined,
          eventType: idx['event_type'] >= 0 ? getValue(row, idx['event_type']) : undefined,
          source: idx['source'] >= 0 ? getValue(row, idx['source']) : undefined,
          actor: idx['actor'] >= 0 ? getValue(row, idx['actor']) : undefined,
          occurredAt: idx['occurred_at'] >= 0 ? getValue(row, idx['occurred_at']) : undefined,
          prevStage: idx['prev_stage'] >= 0 ? getValue(row, idx['prev_stage']) : undefined,
          newStage: idx['new_stage'] >= 0 ? getValue(row, idx['new_stage']) : undefined,
          githubIssueId: idx['github_issue_id'] >= 0 ? getValue(row, idx['github_issue_id']) : undefined,
          githubIssueUrl: idx['github_issue_url'] >= 0 ? getValue(row, idx['github_issue_url']) : undefined,
          gmailThreadId: idx['gmail_thread_id'] >= 0 ? getValue(row, idx['gmail_thread_id']) : undefined,
          details: idx['details'] >= 0 ? getValue(row, idx['details']) : undefined,
        }
        activities.push(activity)
      }
    }

    // Sort by occurred_at descending (most recent first)
    activities.sort((a, b) => {
      const aTime = a.occurredAt || ''
      const bTime = b.occurredAt || ''
      return bTime.localeCompare(aTime)
    })

    return activities
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.warn('[getActivitiesForMigration] Error loading activities:', msg)
    return []
  }
}

async function appendRowToSheet(tabName: string, values: string[], token?: string): Promise<void> {
  const accessToken = token || getAccessToken()
  if (!accessToken) throw new Error('Not authenticated. Please sign in to Google.')
  const id = SHEETS_ID || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k'
  
  // Use batchUpdate to append a row
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tabName + '!A:Z')}:append?valueInputOption=RAW`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  })
  
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API error ${res.status}: ${err || res.statusText}`)
  }
}

export async function logActivity(activity: Activity): Promise<void> {
  try {
    // Generate a simple event_id if not provided
    const eventId = activity.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Map Activity fields to MH_Activities columns
    const row = [
      activity.migrationId || '',
      activity.migrationTitle || '',
      eventId,
      activity.eventType || '',
      activity.source || '',
      activity.actor || '',
      activity.occurredAt || new Date().toISOString(),
      activity.prevStage || '',
      activity.newStage || '',
      activity.githubIssueId || '',
      activity.githubIssueUrl || '',
      activity.gmailThreadId || '',
      activity.details || '',
    ]
    
    await appendRowToSheet('MH_Activities', row)
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.error('[logActivity] Error logging activity:', msg)
    throw e
  }
}

export async function getStageMapOrder(): Promise<string[]> {
  try {
    const grid = await fetchValues('MH_StageMap!A1:Z')
    if (!Array.isArray(grid) || grid.length === 0) {
      return []
    }

    const headers = grid[0].map((h) => String(h ?? '').trim())
    const stageTextIdx = headers.findIndex((h) => h.toLowerCase() === 'stagetext' || h === 'StageText')
    
    if (stageTextIdx < 0) {
      console.warn('[getStageMapOrder] StageText column not found in MH_StageMap')
      return []
    }

    const stages: string[] = []
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const stageText = getValue(row, stageTextIdx)
      if (stageText && stageText.trim()) {
        stages.push(stageText.trim())
      }
    }

    return stages
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.error('[getStageMapOrder] Error loading stage map:', msg)
    return []
  }
}

function colIndexToA1(colIndex: number): string {
  // Convert 0-based column index to A1 notation (A=0, B=1, ..., Z=25, AA=26, etc.)
  let result = ''
  let n = colIndex
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

async function updateCellInSheet(
  tabName: string,
  rowIndex: number,
  colIndex: number,
  value: string,
  token?: string,
  valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'
): Promise<void> {
  const accessToken = token || getAccessToken()
  if (!accessToken) throw new Error('Not authenticated. Please sign in to Google.')
  const id = SHEETS_ID || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k'
  
  // Convert 0-based to A1 notation (rowIndex is 1-based for the data row, colIndex is 0-based)
  const colLetter = colIndexToA1(colIndex)
  const range = `${tabName}!${colLetter}${rowIndex + 1}` // +1 because rowIndex is 1-based for data (0=header)
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[value]],
    }),
  })
  
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API error ${res.status}: ${err || res.statusText}`)
  }
}

export async function updateMigrationStage(
  migrationId: string,
  newStage: string,
  dateColumn: string,
  prevStage?: string,
  token?: string
): Promise<void> {
  try {
    // Use a wide range to ensure all date columns are included (A1:ZZ covers up to column ZZ)
    const grid = await fetchValues('MH_View_Migrations!A1:ZZ', token)
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new Error('MH_View_Migrations sheet is empty')
    }

    const headers = grid[0].map((h) => String(h ?? '').trim())
    const migrationIdIdx = headers.findIndex((h) => h === 'MigrationID' || h.toLowerCase() === 'migrationid')
    const stageIdx = headers.findIndex((h) => h === 'Stage' || h.toLowerCase() === 'stage')
    const dateColIdx = headers.findIndex((h) => h === dateColumn || h.toLowerCase() === dateColumn.toLowerCase())

    if (migrationIdIdx < 0) {
      throw new Error('MigrationID column not found in MH_View_Migrations')
    }
    if (stageIdx < 0) {
      throw new Error('Stage column not found in MH_View_Migrations')
    }
    // Find the row with matching MigrationID
    let rowIndex = -1
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowMigrationId = getValue(row, migrationIdIdx)
      if (rowMigrationId === migrationId) {
        rowIndex = r
        break
      }
    }

    if (rowIndex < 0) {
      throw new Error(`Migration with MigrationID "${migrationId}" not found`)
    }

    // Update Stage
    await updateCellInSheet('MH_View_Migrations', rowIndex, stageIdx, newStage, token)
    
    // Update date column if found (use date-only format YYYY-MM-DD)
    if (dateColIdx >= 0 && dateColumn) {
      const today = new Date()
      const dateString = today.toISOString().slice(0, 10) // "YYYY-MM-DD"
      console.log(
        '[updateMigrationStage] Completing stage:',
        prevStage || 'unknown',
        '-> date column:',
        dateColumn,
        '-> value:',
        dateString
      )
      await updateCellInSheet('MH_View_Migrations', rowIndex, dateColIdx, dateString, token, 'USER_ENTERED')
    } else if (!dateColumn && prevStage && prevStage !== 'Complete') {
      console.warn('[updateMigrationStage] No date column mapping for stage:', prevStage)
    } else if (dateColumn && dateColIdx < 0) {
      console.warn(`[updateMigrationStage] Date column ${dateColumn} not found in sheet, skipping date update`)
      console.warn('[updateMigrationStage] Known headers from MH_View_Migrations:', headers)
    }
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.error('[updateMigrationStage] Error updating migration:', msg)
    throw e
  }
}

export async function updateMigrationFieldByHeader(
  migrationId: string,
  headerName: string,
  value: string,
  token?: string
): Promise<void> {
  try {
    const grid = await fetchValues('MH_View_Migrations!A1:ZZ', token)
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new Error('MH_View_Migrations sheet is empty')
    }

    const headers = grid[0].map((h) => String(h ?? '').trim())
    const migrationIdIdx = headers.findIndex((h) => h === 'MigrationID' || h.toLowerCase() === 'migrationid')
    const headerIdx = headers.findIndex((h) => h === headerName || h.toLowerCase() === headerName.toLowerCase())

    if (migrationIdIdx < 0) {
      throw new Error('MigrationID column not found in MH_View_Migrations')
    }
    if (headerIdx < 0) {
      throw new Error(`Column "${headerName}" not found in MH_View_Migrations`)
    }

    // Find the row with matching MigrationID
    let rowIndex = -1
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowMigrationId = getValue(row, migrationIdIdx)
      if (rowMigrationId === migrationId) {
        rowIndex = r
        break
      }
    }

    if (rowIndex < 0) {
      throw new Error(`Migration with MigrationID "${migrationId}" not found`)
    }

    // Update the cell
    await updateCellInSheet('MH_View_Migrations', rowIndex, headerIdx, value, token)
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.error('[updateMigrationFieldByHeader] Error updating field:', msg)
    throw e
  }
}

