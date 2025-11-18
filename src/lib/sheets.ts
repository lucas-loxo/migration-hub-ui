import { getAccessToken } from './google'
import { getSheetsId } from '../config/env'
import { isValidSheetTab, getValidSheetTabs } from '../config/sheetMapping'
import type { Activity, Customer, Migration, Owner, StageThreshold } from '../types'

// Use env helper for a single source of truth
const SHEETS_ID = (import.meta as any).env?.VITE_SHEETS_ID as string | undefined

function toCamel(s: string): string {
  return s.trim().replace(/[^a-zA-Z0-9 ]+/g, '').replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (c) => c.toLowerCase())
}

function isBlankRow(arr: any[]): boolean {
  return arr.every((v) => (v == null || String(v).trim() === ''))
}

async function fetchValues(range: string, token?: string): Promise<string[][]> {
  const accessToken = token || getAccessToken()
  if (!accessToken) throw new Error('Not authenticated. Please sign in to Google.')
  const id = SHEETS_ID || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k'
  // Hard guard: disallow derived tabs as primary sources
  if (/^All\s*Migrations!?/i.test(range)) {
    throw new Error('Invalid data source: "All Migrations" is derived. Use the authoritative "Migrations" tab.')
  }
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

function toObjects(rows: string[][]): Record<string, string>[] {
  if (!rows || rows.length === 0) return []
  const headers = rows[0].map((h) => (h || '').toString().trim())
  const headerKeys = headers.map((h) => toCamel(h))
  const result: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || []
    if (isBlankRow(r)) continue
    const obj: Record<string, string> = {}
    for (let j = 0; j < headerKeys.length; j++) {
      const key = headerKeys[j]
      obj[key] = String(r[j] ?? '')
    }
    result.push(obj)
  }
  return result
}

export async function getCustomersMap(token?: string): Promise<Map<string, Customer>> {
  const rows = await fetchValues('Customers!A1:G', token)
  const objs = toObjects(rows)
  const map = new Map<string, Customer>()
  for (const o of objs) {
    const customerId = o.customerID || o.customerId || o.customerid || o.customerID
    if (!customerId) continue
    const customer: Customer = {
      customerId: customerId,
      customerName: o.customerName || o.customer || o.customername || '',
      seats: o.seats,
      segment: o.segment,
      secondaryContactName: o.secondaryContactName,
      secondaryContactEmail: o.secondaryContactEmail,
      czLink: o.cZLink || o.czLink,
    }
    map.set(customerId, customer)
  }
  return map
}

/**
 * Fetches all migrations from MH_View_Migrations.
 * Returns all rows - multiple migrations can share the same CustomerID.
 * MigrationID is the unique identifier for each migration.
 */
export async function getMigrations(token?: string): Promise<Array<{
  MigrationID: string
  CustomerID: string
  Customer: string
  OwnerEmail: string
  Stage: string
  Status: string
  DaysInStage: string | number
}>> {
  const [rows, customers] = await Promise.all([
    fetchValues('MH_View_Migrations!A1:Z', token),
    getCustomersMap(token),
  ])
  const objs = toObjects(rows)
  const result: Array<any> = []
  for (const o of objs) {
    const migrationId = o.migrationID || o.migrationId || o.migrationid || o.MigrationID
    if (!migrationId || String(migrationId).trim() === '') continue
    const customerId = o.customerID || o.customerId || o.customerid || o.CustomerID || ''
    let customer = o.customer || o.customerName || o.customername || ''
    if ((!customer || customer.trim() === '') && customerId) {
      const c = customers.get(customerId)
      if (c?.customerName) customer = c.customerName
    }
    result.push({
      MigrationID: String(migrationId),
      CustomerID: String(customerId || ''),
      Customer: customer || '',
      OwnerEmail: o.ownerEmail || o.owner || o.owneremail || '',
      Stage: o.stage || o.Stage || '',
      Status: o.status || o.Status || '',
      DaysInStage: o.daysInStage || o.daysinstage || o.DaysInStage || o.days || o.Days || '',
    })
  }
  return result
}

export async function getActivities(token?: string): Promise<Activity[]> {
  const rows = await fetchValues('Activities!A1:G', token)
  const objs = toObjects(rows)
  return objs as unknown as Activity[]
}

export async function getOwners(token?: string): Promise<Owner[]> {
  const rows = await fetchValues('Owners!A1:C', token)
  const objs = toObjects(rows)
  return objs as unknown as Owner[]
}

export async function getStageThresholds(token?: string): Promise<StageThreshold[]> {
  const rows = await fetchValues('StageThresholds!A1:C', token)
  const objs = toObjects(rows)
  return objs as unknown as StageThreshold[]
}

export async function fetchHeader(tabName: string, token?: string): Promise<string[]> {
  const rows = await fetchValues(`${tabName}!A1:Z1`, token)
  return (rows && rows[0]) ? rows[0].map((h) => (h ?? '').toString().trim()) : []
}

export async function getSettingsSchemaVersion(token?: string): Promise<string | undefined> {
  try {
    const rows = await fetchValues('Settings!B2:B2', token)
    const v = rows && rows[0] && rows[0][0]
    return v ? String(v) : undefined
  } catch (e: any) {
    const msg = String(e?.message || e)
    // Treat missing Settings tab/range as "no version" rather than a hard error
    if (/Unable to parse range|INVALID_ARGUMENT|Settings!/i.test(msg)) {
      return undefined
    }
    throw e
  }
}

/**
 * ViewMigration represents a migration row from MH_View_Migrations.
 * MigrationID (M-XXXX format) is the canonical unique identifier for a migration.
 * CustomerID is not unique because a customer may have multiple migrations (e.g., second passes).
 */
export type ViewMigration = {
  MigrationID: string  // Primary unique identifier (e.g., "M-0062")
  CustomerID: string   // Customer identifier (not unique - multiple migrations can share same CustomerID)
  CustomerName: string
  Stage: string
  DaysInStage: number
  Status: string
  OwnerEmail: string
}

export type MigrationRow = { [key: string]: any }

export type SimpleMigration = {
  customer_id: string
  customer_name: string
  stage: string
  days_in_stage: string
  status: string
  owner_email: string
}

export async function fetchSimpleMigrations(): Promise<SimpleMigration[]> {
  try {
    const grid = await fetchValues(`MH_View_Migrations!A1:Z`)
    if (!Array.isArray(grid) || grid.length === 0) {
      console.warn('[Migrations] No rows returned from Google Sheets (MH_View_Migrations)')
      return []
    }
    
    // Use toObjects to convert to header-keyed objects
    const rawRows = toObjects(grid)
    console.info('[Migrations] Raw MH_View_Migrations rows:', rawRows)
    
    if (!rawRows || rawRows.length === 0) return []
    
    return rawRows
      .filter((r: any) => r.customerId || r.customer_id || r.CustomerID || r.customerName || r.customer_name || r.CustomerName)
      .map((r: any) => ({
        customer_id: r.customerId || r.customer_id || r.CustomerID || '',
        customer_name: r.customerName || r.customer_name || r.CustomerName || '',
        stage: r.stage || r.Stage || '',
        days_in_stage: r.daysInStage || r.days_in_stage || r.DaysInStage || r.Days || '',
        status: r.status || r.Status || '',
        owner_email: r.ownerEmail || r.owner_email || r.OwnerEmail || r.owner || '',
      }))
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      console.warn('[Migrations] Sheets API unauthorized')
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.error('[Migrations] Error fetching migrations:', msg)
    throw e
  }
}

export async function fetchMigrationsFromView(): Promise<MigrationRow[]> {
  try {
    console.info('[Migrations] Fetching from MH_View_Migrations...')
    const grid = await fetchValues(`MH_View_Migrations!A1:Z`)
    if (!Array.isArray(grid) || grid.length === 0) {
      console.warn('[Migrations] No rows returned from Google Sheets (MH_View_Migrations)')
      return []
    }
    
    const headers = (grid[0] || []).map((h) => String(h ?? '').trim())
    const results: MigrationRow[] = []
    
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      if (isBlankRow(row)) continue
      
      const obj: MigrationRow = {}
      for (let j = 0; j < headers.length; j++) {
        const headerName = headers[j]
        if (headerName) {
          obj[headerName] = String(row[j] ?? '').trim()
        }
      }
      if (Object.keys(obj).length > 0) {
        results.push(obj)
      }
    }
    
    console.info('[Migrations] Loaded from MH_View_Migrations:', results.length)
    return results
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      console.warn('[Migrations] Sheets API unauthorized')
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.error('[Migrations] Error fetching migrations:', msg)
    throw e
  }
}

/**
 * Generates the next MigrationID by reading existing IDs from MH_View_Migrations
 * and incrementing the highest numeric value.
 * 
 * Format: M-XXXX where XXXX is zero-padded (e.g., M-0001, M-0061, M-0123)
 * 
 * This function:
 * - Reads the MigrationID column from MH_View_Migrations sheet
 * - Parses existing IDs of the form M-XXXX
 * - Finds the maximum numeric value
 * - Increments by 1 and formats with the same padding style
 * 
 * @param token Optional access token for Google Sheets API
 * @returns The next MigrationID string (e.g., "M-0062")
 */
export async function getNextMigrationId(token?: string): Promise<string> {
  try {
    // Read MH_View_Migrations sheet to get existing MigrationIDs
    const grid = await fetchValues('MH_View_Migrations!A1:Z', token)
    if (!Array.isArray(grid) || grid.length < 2) {
      // No existing rows, start with M-0001
      console.log('[MH-Migrations] No existing migrations found, starting with M-0001')
      return 'M-0001'
    }

    // Find MigrationID column index
    const headers = (grid[0] || []).map((h) => String(h ?? '').trim())
    const migrationIdColIndex = headers.findIndex(
      (h) => h === 'MigrationID' || h.toLowerCase() === 'migrationid'
    )

    if (migrationIdColIndex === -1) {
      console.warn('[MH-Migrations] MigrationID column not found, starting with M-0001')
      return 'M-0001'
    }

    // Parse existing MigrationIDs and find the maximum numeric value
    let maxNum = 0
    const idPattern = /^M-(\d+)$/i
    let paddingLength = 4 // Default to 4 digits (M-0001 format)

    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const migrationId = String(row[migrationIdColIndex] ?? '').trim()
      
      if (!migrationId) continue // Skip blank cells
      
      const match = migrationId.match(idPattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
          // Detect padding length from existing IDs
          const digits = match[1].length
          if (digits > paddingLength) {
            paddingLength = digits
          }
        }
      }
    }

    // Increment and format with zero-padding
    const nextNum = maxNum + 1
    const paddedNum = String(nextNum).padStart(paddingLength, '0')
    const nextMigrationId = `M-${paddedNum}`

    console.log(
      `[MH-Migrations] Generated new migrationId=${nextMigrationId} (numeric=${nextNum}, max found=${maxNum}, range=MH_View_Migrations!A1:Z)`
    )

    return nextMigrationId
  } catch (error) {
    console.error('[MH-Migrations] Error generating next MigrationID:', error)
    // Fallback: return a safe default
    return 'M-0001'
  }
}

export async function fetchViewMigrations(params?: { ownerEmail?: string; sheetTab?: string; range?: string }): Promise<{ rows: ViewMigration[]; fetchedAt: string }> {
  const ownerEmail = params?.ownerEmail
  // [MH-AI] Use config-driven sheet/range with fallback to defaults
  const sheetTab = params?.sheetTab || 'MH_View_Migrations'
  const range = params?.range || 'A:Z'
  const timestamp = () => new Date().toISOString()
  
  // Validate sheet tab
  if (sheetTab && !isValidSheetTab(sheetTab)) {
    throw new Error(`Invalid sheet_tab: "${sheetTab}". Valid tabs: ${getValidSheetTabs().join(', ')}`)
  }
  
  try {
    const grid = await fetchValues(`${sheetTab}!${range}`)
    if (!Array.isArray(grid) || grid.length === 0) {
      console.warn('[MH] No rows returned from Google Sheets (MH_View_Migrations)')
      return { rows: [], fetchedAt: timestamp() }
    }
    const headers = (grid[0] || []).map((h) => String(h ?? '').trim())
    // Required headers: Status is now derived from Is_Behind, not required in sheet
    const required = ['MigrationID','CustomerID','CustomerName','Stage','DaysInStage','OwnerEmail']
    const idx: Record<string, number> = {}
    const missing: string[] = []
    for (const h of required) {
      const i = headers.findIndex((header) => header === h || header.toLowerCase() === h.toLowerCase())
      if (i === -1) missing.push(h)
      idx[h] = i
    }
    if (missing.length) {
      throw new Error(`HEADERS_MISSING|missing=${missing.join(',')}|found=${headers.join(',')}`)
    }
    // Is_Behind is optional but preferred - find it if present
    const isBehindIdx = headers.findIndex((h) => h === 'Is_Behind' || h.toLowerCase() === 'is_behind')
    idx['Is_Behind'] = isBehindIdx
    
    const results: ViewMigration[] = []
    for (let r = 1; r < grid.length; r++) {
      const rowRaw = grid[r]
      if (!rowRaw) continue
      const row = Array.isArray(rowRaw) ? rowRaw : []
      const get = (key: string) => {
        const columnIndex = idx[key]
        if (columnIndex == null || columnIndex < 0) return ''
        return String(row[columnIndex] ?? '').trim()
      }
      const migrationId = get('MigrationID')
      const customerId = get('CustomerID')
      const customerName = get('CustomerName')
      const stage = get('Stage')
      const daysVal = Number(get('DaysInStage'))
      const owner = get('OwnerEmail')
      
      // Derive Status from Is_Behind: TRUE -> "Behind", else "On Track"
      const isBehindRaw = get('Is_Behind')
      const isBehind = isBehindRaw === 'TRUE' || isBehindRaw === 'True' || isBehindRaw === 'true' || isBehindRaw === '1'
      const status = isBehind ? 'Behind' : 'On Track'
      
      if (!migrationId || !customerId || !customerName || !stage) continue
      const record: ViewMigration = {
        MigrationID: migrationId,
        CustomerID: customerId,
        CustomerName: customerName,
        Stage: stage,
        DaysInStage: Number.isFinite(daysVal) ? daysVal : 0,
        Status: status,
        OwnerEmail: owner,
      }
      ;(record as any).ownerEmail = owner
      results.push(record)
    }
    if (results.length) {
      console.debug('[MH] sample normalized row', results[0])
    } else {
      console.debug('[MH] sample normalized row', null)
    }
    const filtered = ownerEmail
      ? results.filter((r) => (r.OwnerEmail || '').toLowerCase() === String(ownerEmail).toLowerCase())
      : results
    return { rows: filtered, fetchedAt: timestamp() }
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      console.warn('[MH] Sheets API unauthorized – refreshing token...', msg)
      return { rows: [], fetchedAt: timestamp() }
    }
    if (/MH_View_Migrations not found/.test(msg)) {
      console.warn('[MH] MH_View_Migrations tab not found')
      return { rows: [], fetchedAt: timestamp() }
    }
    throw e
  }
}

// Safe sheets reading with Zod validation and header synonyms
export async function safeGetRows<T>(
  tabName: string,
  schema: any,
  options?: { aliases?: Record<string, string[]>; caseInsensitiveTabs?: boolean; token?: string }
): Promise<T[]> {
  const { aliases = {}, caseInsensitiveTabs = false, token } = options || {}
  
  // Validate sheet tab (skip validation for case-insensitive lookups)
  if (tabName && !caseInsensitiveTabs && !isValidSheetTab(tabName)) {
    console.warn(`[Sheets] Invalid sheet_tab: "${tabName}". Valid tabs: ${getValidSheetTabs().join(', ')}`)
    // Don't throw - allow it to fail naturally with API error for better error messages
  }
  
  try {
    // Try exact tab name first, then try case-insensitive variants if enabled
    let grid
    try {
      grid = await fetchValues(`${tabName}!A1:Z`, token)
    } catch (e: any) {
      if (caseInsensitiveTabs) {
        // Try uppercase variant (e.g., Rpt_* -> RPT_*)
        const upperTab = tabName.toUpperCase()
        if (upperTab !== tabName) {
          try {
            grid = await fetchValues(`${upperTab}!A1:Z`, token)
          } catch {
            // Try title case variant (e.g., RPT_* -> Rpt_*)
            const titleTab = tabName.charAt(0).toUpperCase() + tabName.slice(1).toLowerCase()
            if (titleTab !== tabName && titleTab !== upperTab) {
              try {
                grid = await fetchValues(`${titleTab}!A1:Z`, token)
              } catch {
                throw e
              }
            } else {
              throw e
            }
          }
        } else {
          throw e
        }
      } else {
        throw e
      }
    }
    if (!Array.isArray(grid) || grid.length === 0) {
      console.warn(`[Reports] Tab "${tabName}" is empty or missing`)
      return []
    }

    const headers = (grid[0] || []).map((h) => String(h ?? '').trim())
    
    // Build header mapping with synonyms
    const headerMap: Record<string, number> = {}
    for (const [canonical, synonyms] of Object.entries(aliases)) {
      const allNames = [canonical, ...synonyms]
      for (const name of allNames) {
        const idx = headers.findIndex((h) => h === name)
        if (idx !== -1) {
          headerMap[canonical] = idx
          break
        }
      }
    }
    
    // Also map headers that match exactly (for fields not in aliases)
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      if (header && !Object.values(aliases).flat().includes(header) && !headerMap[header]) {
        headerMap[header] = j
      }
    }
    
    const results: T[] = []

    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const obj: Record<string, any> = {}

      // Map headers to canonical names
      for (const [canonical, idx] of Object.entries(headerMap)) {
        obj[canonical] = row[idx] ?? null
      }
      
      // Also include original headers
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]
        if (header && !obj[header]) {
          obj[header] = row[j] ?? null
        }
      }

      try {
        const parsed = schema.parse(obj)
        results.push(parsed as T)
      } catch (e: any) {
        console.warn(`[Reports] Invalid row in "${tabName}" (row ${r + 1}):`, e.message)
        // Skip invalid row but continue
      }
    }

    return results
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/not found/i.test(msg) || /Unable to parse range/i.test(msg)) {
      console.warn(`[Reports] Tab "${tabName}" not found`)
      return []
    }
    throw e
  }
}

export function getDistinct<T extends string>(rows: Record<string, any>[], key: string): T[] {
  const set = new Set<T>()
  for (const row of rows) {
    const val = row[key]
    if (val && typeof val === 'string') {
      set.add(val as T)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

// Fetch Previous ATS list from Google Sheets
export async function fetchPreviousATSList(token?: string): Promise<string[]> {
  try {
    // Try case-insensitive tab name matching
    const tabNames = ['previous_ATS_list', 'Previous_ATS_List', 'Previous ATS List', 'previous ATS list']
    
    let grid
    for (const tabName of tabNames) {
      try {
        grid = await fetchValues(`${tabName}!A:A`, token)
        break
      } catch (e: any) {
        continue
      }
    }
    
    if (!grid || grid.length === 0) {
      console.warn('[ATS] Previous_ATS_List tab not found or empty')
      return []
    }
    
    // Flatten, trim, filter non-empty, unique, sort
    const values = new Set<string>()
    for (const row of grid) {
      if (Array.isArray(row) && row.length > 0) {
        const val = String(row[0] ?? '').trim()
        // Skip header-like values
        if (val && val.length > 0 && !/^(ATS|Previous ATS|Name|Value)$/i.test(val)) {
          values.add(val)
        }
      }
    }
    
    return Array.from(values).sort((a, b) => 
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    )
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/not found/i.test(msg) || /Unable to parse range/i.test(msg)) {
      console.warn('[ATS] Previous_ATS_List tab not found')
      return []
    }
    console.warn('[ATS] Error fetching Previous ATS list:', msg)
    return []
  }
}

// Get a single cell value (supports case-insensitive tab matching)
export async function getCell(
  tabNameLike: string,
  a1: string,
  token?: string
): Promise<number | null> {
  try {
    // Try exact tab name first
    let grid
    try {
      grid = await fetchValues(`${tabNameLike}!${a1}`, token)
    } catch (e: any) {
      // Try uppercase variant
      const upperTab = tabNameLike.toUpperCase()
      if (upperTab !== tabNameLike) {
        try {
          grid = await fetchValues(`${upperTab}!${a1}`, token)
        } catch {
          // Try title case variant
          const titleTab = tabNameLike.charAt(0).toUpperCase() + tabNameLike.slice(1).toLowerCase()
          if (titleTab !== tabNameLike && titleTab !== upperTab) {
            try {
              grid = await fetchValues(`${titleTab}!${a1}`, token)
            } catch {
              console.warn(`[Reports] Cell ${a1} not found in tab "${tabNameLike}" (tried variants)`)
              return null
            }
          } else {
            console.warn(`[Reports] Cell ${a1} not found in tab "${tabNameLike}"`)
            return null
          }
        }
      } else {
        console.warn(`[Reports] Cell ${a1} not found in tab "${tabNameLike}"`)
        return null
      }
    }

    if (!Array.isArray(grid) || grid.length === 0) {
      return null
    }

    // Handle single cell (A1 notation returns a 2D array)
    const value = grid[0]?.[0] ?? null
    if (value == null || value === '') {
      return null
    }

    const num = Number(value)
    if (Number.isFinite(num)) {
      return num
    }

    console.warn(`[Reports] Cell ${a1} in "${tabNameLike}" is not numeric: ${value}`)
    return null
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    console.warn(`[Reports] Error reading cell ${a1} from "${tabNameLike}":`, msg)
    return null
  }
}


