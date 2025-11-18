import React, { useEffect, useState, useMemo } from 'react'
import Card from '../Card.jsx'
import {
  type MigrationSnapshot,
  getStageMapOrder,
  updateMigrationStage,
  logActivity,
  type Activity,
} from '../../lib/sheetsCustomers'
import { usePermissions } from '../../state/usePermissions'

type NextActionPanelProps = {
  snapshot: MigrationSnapshot | null
  onRefresh?: () => void
}

// Stage to date column mapping
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
  // 'Complete' stage does not set a date column
}

export default function NextActionPanel({ snapshot, onRefresh }: NextActionPanelProps) {
  const { isEditor } = usePermissions()
  const stage = snapshot?.Stage || '—'
  const [stageOrder, setStageOrder] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const loadStageOrder = async () => {
      try {
        const order = await getStageMapOrder()
        setStageOrder(order)
      } catch (e) {
        console.error('[NextActionPanel] Error loading stage order:', e)
      }
    }
    loadStageOrder()
  }, [])

  const nextStage = useMemo(() => {
    if (!stage || !stageOrder.length) return null
    const currentIndex = stageOrder.findIndex((s) => s === stage)
    if (currentIndex < 0 || currentIndex >= stageOrder.length - 1) return null
    return stageOrder[currentIndex + 1]
  }, [stage, stageOrder])

  const handleMoveToNextStage = async () => {
    if (!snapshot || !nextStage || !snapshot.MigrationID || !isEditor) {
      if (!isEditor) {
        alert('Read-only access. Contact Lucas if you need edit permissions.')
      }
      return
    }

    setUpdating(true)
    try {
      const migrationId = snapshot.MigrationID
      const prevStage = snapshot.Stage
      
      console.log(
        '[MoveToNextStage] prevStage=',
        prevStage,
        'nextStage=',
        nextStage
      )
      
      // Map using prevStage (the stage being completed), not nextStage
      const dateColumn = STAGE_TO_DATE_COLUMN[prevStage] || ''
      
      console.log(
        '[MoveToNextStage] dateColumnName for prevStage',
        prevStage,
        'is',
        dateColumn
      )
      
      if (!dateColumn && prevStage !== 'Complete') {
        console.warn('[MoveToNextStage] No date column mapping for prevStage:', prevStage)
        console.warn('[NextActionPanel] No date column mapping found for stage:', prevStage)
      }

      // Update MH_View_Migrations
      await updateMigrationStage(migrationId, nextStage, dateColumn, prevStage)

      // Log activity
      const activity: Activity = {
        migrationId: migrationId,
        migrationTitle: snapshot.CustomerName,
        eventType: 'stage_changed',
        source: 'app',
        actor: snapshot.OwnerEmail || 'System',
        occurredAt: new Date().toISOString(),
        prevStage: prevStage,
        newStage: nextStage,
        githubIssueId: snapshot.GH_IssueNumber,
        githubIssueUrl: snapshot.GH_IssueURL,
        gmailThreadId: '',
        details: `Stage changed from ${prevStage} to ${nextStage}`,
      }
      await logActivity(activity)

      // Refresh the page data
      if (onRefresh) {
        onRefresh()
      } else {
        // Fallback: reload the page
        window.location.reload()
      }
    } catch (e: any) {
      console.error('[NextActionPanel] Error moving to next stage:', e)
      alert(`Failed to move to next stage: ${e?.message || 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-700">Current Stage: {stage}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">SLA Due:</span>
          <span className="text-sm text-slate-700">—</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
        >
          Add Activity
        </button>
        <button
          onClick={handleMoveToNextStage}
          disabled={!nextStage || updating || loading || !isEditor}
          title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
          className={
            nextStage && !updating && !loading && isEditor
              ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition'
              : 'px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed'
          }
        >
          {updating ? 'Updating...' : 'Move to Next Stage'}
        </button>
        <button
          disabled
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
        >
          Draft Email
        </button>
      </div>
    </Card>
  )
}

