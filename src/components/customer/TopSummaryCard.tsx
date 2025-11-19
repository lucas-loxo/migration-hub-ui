import React from 'react'
import Card from '../Card.jsx'
import type { MigrationSnapshot, CustomerProfile } from '../../lib/sheetsCustomers'

// Helper function to get text color class for stage
function getStageTextColor(stage: string | undefined): string {
  if (!stage) return 'text-blue-700'
  
  const normalizedStage = stage.trim()
  
  switch (normalizedStage) {
    case 'Sending Kickoff Email':
    case 'Sending Import Map Email':
    case 'Sending Validation Email':
    case 'Sending Final Confirm Email':
    case 'Sending Sign-Off Email':
      return 'text-purple-600'
    case 'Waiting on Data Upload':
    case 'Waiting on Customer Import Map':
    case 'Waiting on Validation Requests':
    case 'Waiting on Final Confirmation':
      return 'text-orange-600'
    case 'Waiting on Eng Import Map':
    case 'Waiting on Data Import':
    case 'Waiting on Eng Validation':
    case 'Waiting on Duplicate Merge':
      return 'text-blue-600'
    case 'Complete':
      return 'text-green-600'
    default:
      return 'text-blue-700' // Default blue color
  }
}

type TopSummaryCardProps = {
  profile: CustomerProfile | null
  snapshot: MigrationSnapshot | null
}

export default function TopSummaryCard({ profile, snapshot }: TopSummaryCardProps) {
  const customerName = profile?.CustomerName || snapshot?.CustomerName || '—'
  const customerId = profile?.CustomerID || snapshot?.CustomerID || '—'
  const stage = snapshot?.Stage || '—'
  const status = snapshot?.Status || '—'
  const daysInStage = snapshot?.DaysInStage ?? '—'
  const ownerEmail = snapshot?.OwnerEmail || '—'
  const githubIssueUrl = snapshot?.GH_IssueURL
  const churnZeroLink = snapshot?.churnZeroLink

  const handleGithubClick = () => {
    if (!githubIssueUrl) return
    window.open(githubIssueUrl, '_blank', 'noopener,noreferrer')
  }

  const handleChurnZeroClick = () => {
    if (!churnZeroLink) return
    window.open(churnZeroLink, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{customerName}</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            {customerId}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 ${getStageTextColor(stage)}`}>
          Current Stage: {stage}
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-50 text-slate-700">
          Status: {status}
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-50 text-slate-700">
          Days in Stage: {daysInStage}
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-50 text-slate-700">
          Owner: {ownerEmail}
        </span>
        <button
          onClick={handleGithubClick}
          disabled={!githubIssueUrl}
          className={githubIssueUrl 
            ? "inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
            : "inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
          }
        >
          Open GitHub Issue
        </button>
        <button
          onClick={handleChurnZeroClick}
          disabled={!churnZeroLink}
          className={churnZeroLink 
            ? "inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
            : "inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
          }
        >
          Open CZ
        </button>
      </div>
    </Card>
  )
}

