import React, { useEffect, useState } from 'react'
import Card from '../Card.jsx'
import {
  type MigrationSnapshot,
  getStageMapOrder,
  updateMigrationStage,
  updateMigrationFieldByHeader,
  logActivity,
  type Activity,
} from '../../lib/sheetsCustomers'
import { usePermissions } from '../../state/usePermissions'

type StageTimelineProps = {
  snapshot: MigrationSnapshot | null
  onRefresh?: () => void
}

// Stage to date column mapping (from NextActionPanel)
const STAGE_TO_DATE_COLUMN: Record<string, string> = {
  'Sending Kickoff Email': 'Kickoff_Email_Sent_Date',
  'Waiting on Data Upload': 'Customer_Uploaded_Data_Date',
  'Waiting on Eng Import Map': 'Import_Map_Complete_Date',
  'Sending Import Map Email': 'Import_Map_Email_Sent_Date',
  'Waiting on Customer Import Map': 'Import_Map_Finalized_Date',
  'Waiting on Data Import': 'Data_Import_Complete_Date',
  'Sending Validation Email': 'Validation_Email_Sent_Date',
  'Waiting on Validation Requests': 'Validation_Requests_Received_Date',
  'Waiting on Eng Validation': 'Validation_Complete_Date',
  'Sending Final Confirm Email': 'Final_Confirm_Email_Sent_Date',
  'Waiting on Final Confirmation': 'Final_Confirm_Date',
  'Waiting on Duplicate Merge': 'Merged_Duplicates_Date',
  'Sending Sign-Off Email': 'Email_Sign_Off_Complete_Date',
}

// All date fields to display (including BTC fields)
const STAGE_TIMELINE_FIELDS = [
  { label: 'Kickoff Email Sent', key: 'Kickoff_Email_Sent_Date' },
  { label: 'Data Upload Completed', key: 'Customer_Uploaded_Data_Date' },
  { label: 'Eng Import Map Completed', key: 'Import_Map_Complete_Date' },
  { label: 'Import Map Email Sent', key: 'Import_Map_Email_Sent_Date' },
  { label: 'Customer Import Map Finalized', key: 'Import_Map_Finalized_Date' },
  { label: 'Data Import Completed', key: 'Data_Import_Complete_Date' },
  { label: 'Validation Email Sent', key: 'Validation_Email_Sent_Date' },
  { label: 'Validation Requests Received', key: 'Validation_Requests_Received_Date' },
  { label: 'Validation Completed', key: 'Validation_Complete_Date' },
  { label: 'Final Confirm Email Sent', key: 'Final_Confirm_Email_Sent_Date' },
  { label: 'Final Confirmation', key: 'Final_Confirm_Date' },
  { label: 'Duplicate Merge Completed', key: 'Merged_Duplicates_Date' },
  { label: 'Sign-Off Email Sent', key: 'Email_Sign_Off_Complete_Date' },
  { label: 'BTC Work Started', key: 'BTC_Started_Date' },
  { label: 'BTC Work Completed', key: 'BTC_Completed_Date' },
]

// Helper to fetch date field values from the sheet
async function fetchDateFields(migrationId: string, token?: string): Promise<Record<string, string>> {
  const { getAccessToken } = await import('../../lib/google')
  
  const accessToken = token || getAccessToken()
  if (!accessToken) throw new Error('Not authenticated. Please sign in to Google.')
  
  const SHEETS_ID = (import.meta as any).env?.VITE_SHEETS_ID as string | undefined
  const id = SHEETS_ID || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k'
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent('MH_View_Migrations!A1:ZZ')}?majorDimension=ROWS`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API error ${res.status}: ${err || res.statusText}`)
  }
  const json = await res.json()
  const grid: string[][] = json.values || []
  
  if (!Array.isArray(grid) || grid.length === 0) {
    return {}
  }
  
  const headers = grid[0].map((h) => String(h ?? '').trim())
  const migrationIdIdx = headers.findIndex((h) => h === 'MigrationID' || h.toLowerCase() === 'migrationid')
  
  if (migrationIdIdx < 0) {
    throw new Error('MigrationID column not found')
  }
  
  // Helper to get value from row
  const getValue = (row: string[], index: number): string => {
    if (index < 0 || index >= row.length) return ''
    return String(row[index] ?? '').trim()
  }
  
  // Find the row with matching MigrationID
  let rowIndex = -1
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] || []
    const rowMigrationId = getValue(row, migrationIdIdx)
    if (rowMigrationId.toLowerCase() === migrationId.toLowerCase()) {
      rowIndex = r
      break
    }
  }
  
  if (rowIndex < 0) {
    return {}
  }
  
  const row = grid[rowIndex] || []
  const dateFields: Record<string, string> = {}
  
  // Fetch all date field values
  for (const field of STAGE_TIMELINE_FIELDS) {
    const colIdx = headers.findIndex((h) => h === field.key || h.toLowerCase() === field.key.toLowerCase())
    if (colIdx >= 0) {
      const value = getValue(row, colIdx)
      dateFields[field.key] = value || ''
    }
  }
  
  return dateFields
}

// Convert date string to YYYY-MM-DD format for input[type="date"]
function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr || !dateStr.trim()) return ''
  
  // Try parsing as ISO string or various date formats
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  
  // Return in YYYY-MM-DD format
  return date.toISOString().slice(0, 10)
}

// Convert YYYY-MM-DD to date string for storage
function formatDateForStorage(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return ''
  // Return as-is (YYYY-MM-DD format)
  return dateStr.trim()
}

export default function StageTimeline({ snapshot, onRefresh }: StageTimelineProps) {
  const { isEditor } = usePermissions()
  const [stageOrder, setStageOrder] = useState<string[]>([])
  const [dateFields, setDateFields] = useState<Record<string, string>>({})
  const [editingDates, setEditingDates] = useState<Record<string, string>>({})
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [updatingStage, setUpdatingStage] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load stage order
  useEffect(() => {
    const loadStageOrder = async () => {
      try {
        const order = await getStageMapOrder()
        setStageOrder(order)
      } catch (e) {
        console.error('[StageTimeline] Error loading stage order:', e)
      }
    }
    loadStageOrder()
  }, [])

  // Load date fields when snapshot changes
  useEffect(() => {
    if (!snapshot?.MigrationID) {
      setDateFields({})
      return
    }

    const loadDateFields = async () => {
      setLoading(true)
      try {
        const { getAccessToken } = await import('../../lib/google')
        const token = getAccessToken()
        const fields = await fetchDateFields(snapshot.MigrationID!, token || undefined)
        setDateFields(fields)
        // Initialize editing dates with current values
        const initialEditing: Record<string, string> = {}
        for (const field of STAGE_TIMELINE_FIELDS) {
          initialEditing[field.key] = formatDateForInput(fields[field.key])
        }
        setEditingDates(initialEditing)
      } catch (e: any) {
        console.error('[StageTimeline] Error loading date fields:', e)
      } finally {
        setLoading(false)
      }
    }
    loadDateFields()
  }, [snapshot?.MigrationID])

  const handleStageChange = async (newStage: string) => {
    if (!snapshot?.MigrationID || !isEditor || updatingStage) return
    
    const currentStage = snapshot.Stage
    if (newStage === currentStage) return

    setUpdatingStage(true)
    try {
      // Use updateMigrationStage but with empty dateColumn since we're just changing stage
      // The dateColumn will be set when moving to next stage, not when manually changing
      await updateMigrationStage(snapshot.MigrationID, newStage, '', currentStage)

      // Log activity
      const activity: Activity = {
        migrationId: snapshot.MigrationID,
        migrationTitle: snapshot.CustomerName,
        eventType: 'stage_changed',
        source: 'app',
        actor: snapshot.OwnerEmail || 'System',
        occurredAt: new Date().toISOString(),
        prevStage: currentStage,
        newStage: newStage,
        githubIssueId: snapshot.GH_IssueNumber,
        githubIssueUrl: snapshot.GH_IssueURL,
        gmailThreadId: '',
        details: `Stage manually changed from ${currentStage} to ${newStage}`,
      }
      await logActivity(activity)

      // Refresh the page data
      if (onRefresh) {
        onRefresh()
      } else {
        window.location.reload()
      }
    } catch (e: any) {
      console.error('[StageTimeline] Error updating stage:', e)
      alert(`Failed to update stage: ${e?.message || 'Unknown error'}`)
    } finally {
      setUpdatingStage(false)
    }
  }

  const handleDateChange = (fieldKey: string, value: string) => {
    setEditingDates({ ...editingDates, [fieldKey]: value })
  }

  const handleDateSave = async (fieldKey: string) => {
    if (!snapshot?.MigrationID || !isEditor || savingDate) return

    const newValue = editingDates[fieldKey] || ''
    const currentValue = formatDateForInput(dateFields[fieldKey])
    
    // Only save if value changed
    if (newValue === currentValue) return

    setSavingDate(fieldKey)
    try {
      const dateValue = formatDateForStorage(newValue)
      await updateMigrationFieldByHeader(snapshot.MigrationID || '', fieldKey, dateValue)

      // Update local state
      setDateFields({ ...dateFields, [fieldKey]: dateValue })

      // Refresh the page data
      if (onRefresh) {
        onRefresh()
      }
    } catch (e: any) {
      console.error('[StageTimeline] Error saving date:', e)
      alert(`Failed to save date: ${e?.message || 'Unknown error'}`)
      // Revert editing value on error
      setEditingDates({ ...editingDates, [fieldKey]: formatDateForInput(dateFields[fieldKey]) })
    } finally {
      setSavingDate(null)
    }
  }

  if (!snapshot) {
    return null
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Stage Timeline</h2>
      
      {/* Current Stage Dropdown */}
      <div className="mb-4">
        <label htmlFor="current-stage-select" className="block text-sm text-slate-500 mb-2">
          Current Stage
        </label>
        <select
          id="current-stage-select"
          value={snapshot.Stage || ''}
          onChange={(e) => handleStageChange(e.target.value)}
          disabled={!isEditor || updatingStage || !stageOrder.length}
          title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
          className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm ${
            isEditor && !updatingStage && stageOrder.length
              ? 'bg-white text-slate-900'
              : 'bg-slate-50 text-slate-400 cursor-not-allowed'
          }`}
        >
          {stageOrder.length === 0 ? (
            <option value="">Loading stages...</option>
          ) : (
            stageOrder.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Date Fields List - Scrollable */}
      <div className="max-h-56 overflow-y-auto space-y-3 pr-2">
        {loading ? (
          <div className="text-sm text-slate-500 text-center py-4">Loading dates...</div>
        ) : (
          STAGE_TIMELINE_FIELDS.map((field) => {
            const isSaving = savingDate !== null && savingDate === field.key
            const currentValue = formatDateForInput(dateFields[field.key])
            const editingValue = editingDates[field.key] ?? currentValue
            const hasChanges = editingValue !== currentValue

            return (
              <div key={field.key} className="flex items-center gap-2 pb-2 border-b border-slate-100 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 mb-1">{field.label}</div>
                  <input
                    type="date"
                    value={editingValue}
                    onChange={(e) => handleDateChange(field.key, e.target.value)}
                    onBlur={() => {
                      if (hasChanges) {
                        handleDateSave(field.key)
                      }
                    }}
                    disabled={!isEditor || isSaving}
                    className={`w-full rounded-md border border-slate-300 px-2 py-1 text-xs ${
                      isEditor && !isSaving
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                  />
                </div>
                {hasChanges && isEditor && (
                  <button
                    onClick={() => handleDateSave(field.key)}
                    disabled={isSaving}
                    className="px-2 py-1 rounded text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50"
                    title="Save date"
                  >
                    {isSaving ? '...' : 'Save'}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

