import { getAccessToken } from './google'
import type { Activity, Customer, Migration, Owner, StageThreshold } from '../types'

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
  const id = SHEETS_ID
  if (!id) throw new Error('Missing VITE_SHEETS_ID. Configure .env.local (dev) and GitHub secret (prod).')
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
    fetchValues('Migrations!A1:Z', token),
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


