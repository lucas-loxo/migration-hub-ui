/**
 * Helper functions for reading from MH_AiEmailLog sheet
 */

import { getAccessToken } from './google'
import { getSheetsId } from '../config/env'

const SHEETS_ID = (import.meta as any).env?.VITE_SHEETS_ID as string | undefined

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

/**
 * Gets the latest AI draft for a given thread from MH_AiEmailLog sheet.
 * Returns the most recent row's AiDraftBodyPlain for the specified ThreadID.
 */
export async function getLatestAiDraftForThread(
  threadId: string,
  token?: string
): Promise<{ draftText: string | null }> {
  try {
    // Read MH_AiEmailLog sheet
    const grid = await fetchValues('MH_AiEmailLog!A1:Z', token)
    if (!Array.isArray(grid) || grid.length === 0) {
      return { draftText: null }
    }

    // Find column indices
    let threadIdIdx: number
    let draftBodyIdx: number
    let dateGeneratedIdx: number = -1

    try {
      threadIdIdx = byHeader(grid, 'ThreadID')
    } catch {
      // ThreadID column not found
      return { draftText: null }
    }

    try {
      draftBodyIdx = byHeader(grid, 'AiDraftBodyPlain')
    } catch {
      // AiDraftBodyPlain column not found
      return { draftText: null }
    }

    // DateGenerated is optional - try to find it for sorting
    try {
      dateGeneratedIdx = byHeader(grid, 'DateGenerated')
    } catch {
      // DateGenerated not found, will use row order
    }

    // Find all rows matching the threadId
    const matchingRows: Array<{ row: string[]; dateGenerated: string; rowIndex: number }> = []
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r] || []
      const rowThreadId = getValue(row, threadIdIdx)
      if (rowThreadId === threadId) {
        const dateGenerated = dateGeneratedIdx >= 0 ? getValue(row, dateGeneratedIdx) : ''
        matchingRows.push({
          row,
          dateGenerated,
          rowIndex: r,
        })
      }
    }

    if (matchingRows.length === 0) {
      return { draftText: null }
    }

    // Sort by DateGenerated descending (most recent first), or by row index descending if no date
    matchingRows.sort((a, b) => {
      if (dateGeneratedIdx >= 0 && a.dateGenerated && b.dateGenerated) {
        const aDate = new Date(a.dateGenerated).getTime()
        const bDate = new Date(b.dateGenerated).getTime()
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return bDate - aDate // Most recent first
        }
      }
      // Fallback to row order (most recent = higher row index)
      return b.rowIndex - a.rowIndex
    })

    // Get the most recent row's AiDraftBodyPlain
    const mostRecentRow = matchingRows[0].row
    const draftText = getValue(mostRecentRow, draftBodyIdx)

    return {
      draftText: draftText || null,
    }
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/MH_AiEmailLog not found/.test(msg)) {
      // Sheet doesn't exist yet, return null
      return { draftText: null }
    }
    console.error('[getLatestAiDraftForThread] Error:', msg)
    throw e
  }
}

