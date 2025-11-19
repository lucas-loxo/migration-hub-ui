import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchCustomerProfile, fetchMigrationSnapshot, fetchMigrationSnapshotByMigrationId, updateMigrationFieldByHeader, type CustomerProfile, type MigrationSnapshot } from '../lib/sheetsCustomers'
import TopSummaryCard from '../components/customer/TopSummaryCard'
import NextActionPanel from '../components/customer/NextActionPanel'
import ActivityFeed from '../components/customer/ActivityFeed'
import DetailsSidebar from '../components/customer/DetailsSidebar'
import Card from '../components/Card.jsx'
import { syncMigrationStatusToGitHub, getLatestAiDraft } from '../lib/apiClient'
import Toast from '../components/Toast.jsx'
import { useAuth } from '../state/AuthContext'
import { usePermissions } from '../state/usePermissions'
import { requestWriteWithAi } from '../lib/ai'
import { getAccessToken } from '../lib/google'
import { getAllEmailThreads, getMessagesForThread } from '../lib/emails'

// Helper function to get Tailwind classes for GitHub status pill
function getGithubStatusClasses(status: string | undefined): string {
  if (!status) return 'bg-slate-100 border-slate-300'
  
  const normalizedStatus = status.trim()
  
  switch (normalizedStatus) {
    case 'In Progress':
      return 'bg-blue-100 border-blue-500'
    case 'Blocked':
      return 'bg-red-100 border-red-500'
    case 'Ready to Work':
      return 'bg-green-100 border-green-500'
    case 'Done':
      return 'bg-green-100 border-green-500'
    case 'Waiting Migration Team':
      return 'bg-orange-100 border-orange-500'
    case 'Gathering Requirements':
    default:
      return 'bg-slate-100 border-slate-300'
  }
}

export default function CustomerPage() {
  // Support both /migrations/:migrationId and /customer/:customerId routes
  // migrationId is the canonical identifier (M-XXXX format); customerId is for backward compatibility
  const { customerId, migrationId } = useParams<{ customerId?: string; migrationId?: string }>()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [snapshot, setSnapshot] = useState<MigrationSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCustomerNote, setNewCustomerNote] = useState<string>('')
  const [savingCustomerNotes, setSavingCustomerNotes] = useState(false)
  const { userEmail, token } = useAuth()
  const { isEditor } = usePermissions()
  
  // Email drafting state
  const [replyText, setReplyText] = useState<string>('')
  const [aiDraftBody, setAiDraftBody] = useState<string | null>(null)
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false)
  const [aiUserNote, setAiUserNote] = useState<string>('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  
  // GitHub Status control state
  const GITHUB_STATUS_OPTIONS = [
    'Gathering Requirements',
    'Ready to Work',
    'Blocked',
    'Waiting Migration Team',
    'In Progress',
    'Done',
  ] as const
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false)
  const [selectedGitHubStatus, setSelectedGitHubStatus] = useState<string>('Gathering Requirements')
  const [syncingStatus, setSyncingStatus] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Customer Details edit mode state
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editingDetails, setEditingDetails] = useState<{
    previousATS?: string
    payingUsers?: string
    customerSegment?: string
    dataMethod?: string
    pod?: string
    tier?: string
    primaryContactName?: string
    primaryContactEmail?: string
    secondaryContactName?: string
    secondaryContactEmail?: string
    tertiaryContactName?: string
    tertiaryContactEmail?: string
  }>({})
  const [savingDetails, setSavingDetails] = useState(false)

  useEffect(() => {
    // If migrationId is provided, use it; otherwise fall back to customerId for backward compatibility
    const identifier = migrationId || customerId
    if (!identifier) {
      setError('Migration ID or Customer ID is required')
      setLoading(false)
      return
    }

    let active = true

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        let snapshotData: MigrationSnapshot | null = null
        let profileData: CustomerProfile | null = null

        if (migrationId) {
          // Use MigrationID as the primary identifier
          snapshotData = await fetchMigrationSnapshotByMigrationId(migrationId)
          if (!active) return
          
          // Get customerId from snapshot to fetch profile
          if (snapshotData?.CustomerID) {
            profileData = await fetchCustomerProfile(snapshotData.CustomerID)
            if (!active) return
          }
        } else if (customerId) {
          // Backward compatibility: use customerId
          const [profileResult, snapshotResult] = await Promise.all([
            fetchCustomerProfile(customerId),
            fetchMigrationSnapshot(customerId),
          ])
          if (!active) return
          profileData = profileResult
          snapshotData = snapshotResult
        }

        setProfile(profileData)
        setSnapshot(snapshotData)
        if (snapshotData) {
          // Initialize GitHub status dropdown to current status from GH_Status column in sheet
          const currentStatus = snapshotData.ghStatus || 'Gathering Requirements'
          setSelectedGitHubStatus(currentStatus)
          
          // Find or create thread for this migration
          if (snapshotData.MigrationID) {
            try {
              const accessToken = token || getAccessToken()
              if (accessToken) {
                const threads = await getAllEmailThreads(accessToken)
                const migrationThread = threads.find(t => String(t.MigrationID || '').trim() === String(snapshotData.MigrationID).trim())
                if (migrationThread) {
                  setThreadId(migrationThread.ThreadID)
                  // Load messages for this thread
                  const threadMessages = await getMessagesForThread(migrationThread.ThreadID, accessToken)
                  setMessages(threadMessages || [])
                } else {
                  // Create a new thread ID for this migration (format: M-XXXX-thread)
                  const newThreadId = `${snapshotData.MigrationID}-thread`
                  setThreadId(newThreadId)
                }
              }
            } catch (e) {
              console.warn('[CustomerPage] Error loading email thread:', e)
              // Fallback: use migration ID as thread ID
              if (snapshotData.MigrationID) {
                setThreadId(`${snapshotData.MigrationID}-thread`)
              }
            }
          }
        }

        if (!profileData && !snapshotData) {
          setError(migrationId ? 'Migration not found' : 'Customer not found')
        }
      } catch (e: any) {
        if (!active) return
        console.error('[CustomerPage] Error loading data:', e)
        setError(String(e?.message || 'Failed to load data'))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      active = false
      // Cleanup polling on unmount
      if ((window as any).__customerPagePollCleanup) {
        ;(window as any).__customerPagePollCleanup()
        delete (window as any).__customerPagePollCleanup
      }
    }
  }, [customerId, migrationId, token])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
          </div>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-200 rounded w-1/4" />
                <div className="h-20 bg-slate-200 rounded" />
              </div>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <Card className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="mb-4 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
            <div className="font-medium mb-1">Error loading customer</div>
            <div className="text-sm">{error}</div>
          </div>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              const identifier = migrationId || customerId
              if (identifier) {
                if (migrationId) {
                  fetchMigrationSnapshotByMigrationId(migrationId)
                    .then((snapshotData) => {
                      setSnapshot(snapshotData)
                      if (snapshotData) {
                        if (snapshotData.CustomerID) {
                          return fetchCustomerProfile(snapshotData.CustomerID)
                        }
                        return null
                      }
                      return null
                    })
                    .then((profileData) => {
                      if (profileData) setProfile(profileData)
                    })
                    .catch((e) => {
                      console.error('[CustomerPage] Retry error:', e)
                      setError(String(e?.message || 'Failed to load migration data'))
                    })
                    .finally(() => setLoading(false))
                } else if (customerId) {
                  Promise.all([
                    fetchCustomerProfile(customerId),
                    fetchMigrationSnapshot(customerId),
                  ])
                    .then(([profileData, snapshotData]) => {
                      setProfile(profileData)
                      setSnapshot(snapshotData)
                      if (!profileData && !snapshotData) {
                        setError('Customer not found')
                      }
                    })
                    .catch((e) => {
                      console.error('[CustomerPage] Retry error:', e)
                      setError(String(e?.message || 'Failed to load customer data'))
                    })
                    .finally(() => setLoading(false))
                }
              }
            }}
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            Retry
          </button>
          <div className="mt-4">
            <Link className="text-blue-600 hover:underline" to="/migrations">
              Back to Migrations
            </Link>
          </div>
        </div>
      </Card>
    )
  }

  if (!profile && !snapshot) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="mb-4 text-slate-600">Customer not found</div>
          <Link className="text-blue-600 hover:underline" to="/migrations">
            Back to Migrations
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Link className="inline-flex items-center text-sm text-blue-600 hover:underline mb-2" to="/migrations">
        ← Back to Migrations
      </Link>

      {/* Header - Full Width */}
      <TopSummaryCard profile={profile} snapshot={snapshot} />

      {/* Two-Column Grid */}
      <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)] gap-6">
        {/* Left Column: Gmail Thread + Drafting */}
        <div className="space-y-6">
          {/* Gmail Thread */}
          {snapshot && snapshot.MigrationID && (
            <Card className="p-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Gmail Thread</h2>
              <div className="max-h-[420px] overflow-y-auto space-y-2 px-1">
                {messages.length === 0 ? (
                  <div className="text-sm text-slate-500 text-center py-8">No messages in this thread</div>
                ) : (
                  messages.map((msg: any, index: number) => {
                    const isIncoming = msg.Direction === 'incoming'
                    return (
                      <div
                        key={index}
                        className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            isIncoming
                              ? 'bg-slate-100 text-slate-900 rounded-tl-sm'
                              : 'bg-[#E01E73] text-white rounded-tr-sm'
                          }`}
                        >
                          <div className={`text-xs mb-1 ${isIncoming ? 'text-slate-600' : 'text-white/90'}`}>
                            {msg.FromName || msg.FromEmail || 'Unknown'}
                            {msg.SentAt && (
                              <span className="ml-2">
                                {new Date(msg.SentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className={`text-sm whitespace-pre-wrap ${isIncoming ? 'text-slate-800' : 'text-white'}`}>
                            {msg.BodyPlain || msg.Subject || '—'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          )}

          {/* Draft Email Card */}
          {snapshot && snapshot.MigrationID && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Draft Email</h2>
              
              {/* Primary Reply Box */}
              <div className="mb-4">
                <label htmlFor="reply-box" className="block text-sm font-medium text-slate-700 mb-2">
                  Your Reply
                </label>
                <textarea
                  id="reply-box"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E01E73] resize-none"
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={async () => {
                      if (!snapshot?.MigrationID || !threadId || !replyText.trim()) return
                      
                      const accessToken = token || getAccessToken()
                      if (!accessToken) {
                        setToast({ message: 'Not authenticated. Please sign in to Google.', type: 'error' })
                        return
                      }
                      
                      try {
                        // Import createOutgoingEmailMessage dynamically to avoid circular dependencies
                        const { createOutgoingEmailMessage } = await import('../lib/sheetsEmails')
                        
                        await createOutgoingEmailMessage({
                          token: accessToken,
                          threadId: threadId,
                          migrationId: snapshot.MigrationID,
                          fromEmail: userEmail || 'lucas@loxo.co',
                          toEmails: snapshot.primaryContactEmail || '',
                          subject: `Re: Migration Update - ${snapshot.CustomerName}`,
                          bodyPlain: replyText.trim(),
                        })
                        
                        setToast({ message: 'Email queued to send.', type: 'success' })
                        setReplyText('')
                        setAiDraftBody(null)
                      } catch (e: any) {
                        console.error('[CustomerPage] Error sending email:', e)
                        setToast({ message: `Failed to send email: ${e?.message || 'Unknown error'}`, type: 'error' })
                      }
                    }}
                    disabled={!replyText.trim() || !threadId}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      !replyText.trim() || !threadId
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-[#E01E73] text-white hover:bg-[#B0175B]'
                    }`}
                  >
                    Send
                  </button>
                </div>
              </div>
              
              {/* AI Draft Sandbox Box */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="ai-draft-box" className="block text-sm font-medium text-slate-700">
                    AI Draft Sandbox
                  </label>
                  {aiDraftBody && (
                    <button
                      onClick={() => {
                        setReplyText(aiDraftBody)
                      }}
                      className="text-xs px-3 py-1.5 rounded-md bg-[#E01E73] text-white hover:bg-[#B0175B] transition"
                    >
                      Copy to Reply
                    </button>
                  )}
                </div>
                
                {isGeneratingAiDraft && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#E01E73] border-t-transparent"></div>
                    <span>Generating AI draft...</span>
                  </div>
                )}
                
                {aiError && (
                  <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-700">
                    {aiError}
                  </div>
                )}
                
                <textarea
                  id="ai-draft-box"
                  value={aiDraftBody || ''}
                  onChange={(e) => setAiDraftBody(e.target.value)}
                  placeholder="AI draft will appear here. Edit freely before copying to reply."
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E01E73] resize-none bg-slate-50"
                  disabled={isGeneratingAiDraft}
                />
                
                <div className="flex items-center justify-end gap-2 mt-2">
                  <input
                    type="text"
                    value={aiUserNote}
                    onChange={(e) => setAiUserNote(e.target.value)}
                    placeholder="Tell AI what you want this email to say..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E01E73]"
                    disabled={isGeneratingAiDraft}
                  />
                  <button
                    onClick={async () => {
                      if (!snapshot?.MigrationID || !threadId || isGeneratingAiDraft) return
                      
                      if (!aiUserNote.trim()) {
                        setAiError('Please enter a note for the AI')
                        return
                      }
                      
                      setIsGeneratingAiDraft(true)
                      setAiError(null)
                      setAiDraftBody(null)
                      
                      try {
                        const accessToken = token || getAccessToken()
                        if (!accessToken) {
                          throw new Error('Not authenticated. Please sign in to Google.')
                        }
                        
                        // Build payload for AI webhook
                        const payload = {
                          mode: 'write_with_ai' as const,
                          threadId: threadId,
                          userNote: aiUserNote.trim(),
                          threadMessages: messages.map((msg) => ({
                            direction: msg.Direction,
                            fromEmail: msg.FromEmail,
                            fromName: msg.FromName,
                            subject: msg.Subject,
                            bodyPlain: msg.BodyPlain,
                            sentAt: msg.SentAt,
                            createdAt: msg.CreatedAt,
                          })),
                          migration: snapshot ? {
                            migrationId: snapshot.MigrationID || '',
                            customerName: snapshot.CustomerName,
                            stage: snapshot.Stage,
                            ownerEmail: snapshot.OwnerEmail,
                            previousATS: snapshot.previousATS,
                            dataMethod: snapshot.dataMethod,
                            tier: snapshot.tier,
                            pod: snapshot.pod,
                          } : undefined,
                          customer: profile ? {
                            customerName: profile.CustomerName,
                            primaryContactName: profile.PrimaryContactName,
                            primaryContactEmail: profile.PrimaryContactEmail,
                            previousATS: profile.PreviousATS,
                            customerSegment: profile.CustomerSegment,
                          } : undefined,
                        }
                        
                        // Call Zapier webhook (fire and forget)
                        await requestWriteWithAi(payload)
                        
                        // Start polling for the draft from MH_AiEmailLog
                        const maxAttempts = 15
                        const pollInterval = 1000 // 1 second
                        let attempts = 0
                        let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
                        let isPollingActive = true
                        
                        const pollForDraft = async () => {
                          if (!isPollingActive) return
                          
                          try {
                            const result = await getLatestAiDraft(threadId, accessToken)
                            
                            if (!isPollingActive) return
                            
                            if (result.draftText && result.draftText.trim().length > 0) {
                              // Draft found - set AI draft body
                              setAiDraftBody(result.draftText)
                              setIsGeneratingAiDraft(false)
                              isPollingActive = false
                              if (pollTimeoutId) {
                                clearTimeout(pollTimeoutId)
                              }
                              return
                            }
                            
                            attempts++
                            if (attempts >= maxAttempts) {
                              if (isPollingActive) {
                                setIsGeneratingAiDraft(false)
                                setAiError('AI draft not available yet. Please try again.')
                              }
                              isPollingActive = false
                              return
                            }
                            
                            // Continue polling
                            if (isPollingActive) {
                              pollTimeoutId = setTimeout(pollForDraft, pollInterval)
                            }
                          } catch (e: any) {
                            console.error('[CustomerPage] Error polling for AI draft:', e)
                            attempts++
                            if (attempts >= maxAttempts) {
                              if (isPollingActive) {
                                setIsGeneratingAiDraft(false)
                                setAiError('AI draft not available yet. Please try again.')
                              }
                              isPollingActive = false
                              return
                            }
                            if (isPollingActive) {
                              pollTimeoutId = setTimeout(pollForDraft, pollInterval)
                            }
                          }
                        }
                        
                        // Start polling after a short delay
                        pollTimeoutId = setTimeout(pollForDraft, pollInterval)
                        
                        // Store cleanup function for component unmount
                        ;(window as any).__customerPagePollCleanup = () => {
                          isPollingActive = false
                          if (pollTimeoutId) {
                            clearTimeout(pollTimeoutId)
                          }
                        }
                      } catch (e: any) {
                        const msg = String(e?.message || e)
                        console.error('[CustomerPage] Error generating AI draft:', msg)
                        setAiError(msg)
                        setIsGeneratingAiDraft(false)
                      }
                    }}
                    disabled={!threadId || isGeneratingAiDraft || !aiUserNote.trim()}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      !threadId || isGeneratingAiDraft || !aiUserNote.trim()
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isGeneratingAiDraft ? 'Generating...' : 'Write with AI'}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Controls + Details + Activity */}
        <div className="space-y-6">
          {/* Stage Controls */}
          <NextActionPanel snapshot={snapshot} onRefresh={() => {
            // Reload data
            const loadData = async () => {
              const identifier = migrationId || customerId
              if (!identifier) return
              try {
                if (migrationId) {
                  const snapshotData = await fetchMigrationSnapshotByMigrationId(migrationId)
                  setSnapshot(snapshotData)
                  if (snapshotData?.CustomerID) {
                    const profileData = await fetchCustomerProfile(snapshotData.CustomerID)
                    setProfile(profileData)
                  }
                } else if (customerId) {
                  const [profileData, snapshotData] = await Promise.all([
                    fetchCustomerProfile(customerId),
                    fetchMigrationSnapshot(customerId),
                  ])
                  setProfile(profileData)
                  setSnapshot(snapshotData)
                }
              } catch (e: any) {
                console.error('[CustomerPage] Error refreshing data:', e)
              }
            }
            loadData()
          }} />

          {/* GitHub Status Control */}
          {snapshot && snapshot.MigrationID && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">GitHub Status</h2>
              <div className="flex items-center gap-3">
                {/* Read-only current status display - reads from GH_Status column in MH_View_Migrations */}
                <div className="flex-1">
                  <div className="text-sm text-slate-500 mb-1">Current Status</div>
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-md border text-slate-900 text-sm font-medium ${getGithubStatusClasses(snapshot.ghStatus)}`}>
                    {snapshot.ghStatus || '—'}
                  </div>
                </div>
                {/* Update button */}
                <button
                  onClick={() => {
                    if (!isEditor) {
                      setToast({ message: 'Read-only access. Contact Lucas if you need edit permissions.', type: 'error' })
                      return
                    }
                    // Initialize dropdown to current status from GH_Status column when opening
                    const currentStatus = snapshot.ghStatus || 'Gathering Requirements'
                    setSelectedGitHubStatus(currentStatus)
                    setShowStatusUpdateModal(true)
                  }}
                  disabled={syncingStatus || !isEditor}
                  title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    isEditor && !syncingStatus
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Update GitHub Status
                </button>
              </div>
              
              {/* Status Update Modal */}
              {showStatusUpdateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowStatusUpdateModal(false)}>
                  <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Update GitHub Status</h3>
                    <div className="mb-4">
                      <label htmlFor="status-update-select" className="block text-sm text-slate-500 mb-2">
                        Select new status
                      </label>
                      <select
                        id="status-update-select"
                        value={selectedGitHubStatus}
                        onChange={(e) => setSelectedGitHubStatus(e.target.value)}
                        disabled={syncingStatus}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        {GITHUB_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowStatusUpdateModal(false)}
                        disabled={syncingStatus}
                        className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!snapshot?.MigrationID || !isEditor) {
                            if (!isEditor) {
                              setToast({ message: 'Read-only access. Contact Lucas if you need edit permissions.', type: 'error' })
                            }
                            return
                          }
                          
                          // Don't update if status hasn't changed
                          const currentStatus = snapshot.ghStatus || 'Gathering Requirements'
                          if (selectedGitHubStatus === currentStatus) {
                            setShowStatusUpdateModal(false)
                            return
                          }
                          
                          setSyncingStatus(true)
                          try {
                            await syncMigrationStatusToGitHub({
                              migrationId: snapshot.MigrationID,
                              targetStatus: selectedGitHubStatus,
                              customerId: snapshot.CustomerID,
                              currentStage: snapshot.Stage,
                              updatedByUserEmail: userEmail,
                            })
                            // Optimistically update the local state to reflect new GH_Status value
                            setSnapshot({
                              ...snapshot,
                              ghStatus: selectedGitHubStatus,
                            })
                            setToast({ message: `Status updated to ${selectedGitHubStatus}.`, type: 'success' })
                            setShowStatusUpdateModal(false)
                          } catch (error: any) {
                            console.error('[CustomerPage] Status sync failed:', error)
                            setToast({ message: 'Could not sync status to GitHub. Please try again.', type: 'error' })
                          } finally {
                            setSyncingStatus(false)
                          }
                        }}
                        disabled={syncingStatus || !snapshot?.MigrationID}
                        className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncingStatus ? 'Updating...' : 'Update'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Customer Notes Card */}
          {snapshot && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Notes</h2>
              {!snapshot.customerNotes || !snapshot.customerNotes.trim() ? (
                <div className="text-sm text-slate-400">No customer notes added.</div>
              ) : (
                <div className="space-y-3 mb-4">
                  {(() => {
                    const lines = snapshot.customerNotes.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
                    return lines.map((line, index) => {
                      // Match pattern: [ISO_TIMESTAMP] <email> note text (new format)
                      // or [ISO_TIMESTAMP] note text (old format without email)
                      const match = line.match(/^\[([^\]]+)\]\s*(?:<(.+?)>)?\s*(.*)$/)
                      if (match) {
                        const [, iso, email, text] = match
                        try {
                          const localTime = new Date(iso).toLocaleString()
                          const displayEmail = email || 'unknown'
                          return (
                            <div key={index} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                              <div className="text-xs text-slate-500 mb-1 flex justify-between">
                                <span>{localTime}</span>
                                <span>— {displayEmail}</span>
                              </div>
                              <div className="text-sm text-slate-900 whitespace-pre-wrap">{text}</div>
                            </div>
                          )
                        } catch (e) {
                          // If date parsing fails, render as plain text
                          return (
                            <div key={index} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                              <div className="text-sm text-slate-900 whitespace-pre-wrap">{line}</div>
                            </div>
                          )
                        }
                      } else {
                        // Old format without timestamp - render as plain text
                        return (
                          <div key={index} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                            <div className="text-sm text-slate-900 whitespace-pre-wrap">{line}</div>
                          </div>
                        )
                      }
                    })
                  })()}
                </div>
              )}
              {isEditor && (
                <div className="mt-4">
                  <textarea
                    value={newCustomerNote}
                    onChange={(e) => setNewCustomerNote(e.target.value)}
                    disabled={!isEditor || savingCustomerNotes || !snapshot?.MigrationID}
                    rows={1}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-y disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder={isEditor ? "Enter customer notes..." : "Read-only access. Contact Lucas if you need edit permissions."}
                    title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
                    onKeyDown={(e) => {
                      // Allow Enter to submit if Shift+Enter is not pressed
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        // Trigger Add Note button click
                        const addButton = e.currentTarget.parentElement?.querySelector('button[type="button"]')
                        if (addButton) {
                          (addButton as HTMLButtonElement).click()
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!snapshot?.MigrationID || !isEditor) {
                        if (!isEditor) {
                          setToast({ message: 'Read-only access. Contact Lucas if you need edit permissions.', type: 'error' })
                        }
                        return
                      }
                      
                      const noteText = newCustomerNote.trim()
                      if (!noteText) return
                      
                      setSavingCustomerNotes(true)
                      try {
                        // Build new entry with timestamp and email
                        const nowIso = new Date().toISOString()
                        const email = userEmail ?? 'unknown'
                        const newEntry = `[${nowIso}] <${email}> ${noteText}`
                        
                        // Append to existing notes
                        const existing = snapshot.customerNotes || ''
                        const combined = existing ? `${existing}\n${newEntry}` : newEntry
                        
                        // Save to Sheets
                        await updateMigrationFieldByHeader(snapshot.MigrationID, 'CustomerNotes', combined)
                        
                        // Refresh snapshot to get updated value
                        const identifier = migrationId || customerId
                        if (identifier) {
                          let updatedSnapshot: MigrationSnapshot | null = null
                          if (migrationId) {
                            updatedSnapshot = await fetchMigrationSnapshotByMigrationId(migrationId)
                          } else if (customerId) {
                            updatedSnapshot = await fetchMigrationSnapshot(customerId)
                          }
                          if (updatedSnapshot) {
                            setSnapshot(updatedSnapshot)
                            setNewCustomerNote('') // Clear the input
                          }
                        }
                      } catch (e: any) {
                        console.error('[CustomerPage] Error saving customer notes:', e)
                        setToast({ message: `Failed to save customer notes: ${e?.message || 'Unknown error'}`, type: 'error' })
                      } finally {
                        setSavingCustomerNotes(false)
                      }
                    }}
                    disabled={!isEditor || savingCustomerNotes || !snapshot?.MigrationID || !newCustomerNote.trim()}
                    className="mt-2 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingCustomerNotes ? 'Adding...' : 'Add Note'}
                  </button>
                  {savingCustomerNotes && (
                    <div className="text-xs text-slate-500 mt-1">Saving...</div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Merged Customer Details Card */}
          {snapshot && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Customer Details</h2>
                {!isEditingDetails && (
                  <button
                    onClick={() => {
                      if (!isEditor) {
                        setToast({ message: 'Read-only access. Contact Lucas if you need edit permissions.', type: 'error' })
                        return
                      }
                      // Initialize edit state with current values
                      setEditingDetails({
                        previousATS: snapshot.previousATS || '',
                        payingUsers: snapshot.payingUsers?.toString() || '',
                        customerSegment: snapshot.customerSegment || '',
                        dataMethod: snapshot.dataMethod || '',
                        pod: snapshot.pod || '',
                        tier: snapshot.tier || '',
                        primaryContactName: snapshot.primaryContactName || '',
                        primaryContactEmail: snapshot.primaryContactEmail || '',
                        secondaryContactName: snapshot.secondaryContactName || '',
                        secondaryContactEmail: snapshot.secondaryContactEmail || '',
                        tertiaryContactName: snapshot.tertiaryContactName || '',
                        tertiaryContactEmail: snapshot.tertiaryContactEmail || '',
                      })
                      setIsEditingDetails(true)
                    }}
                    disabled={!isEditor}
                    title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      isEditor
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                {/* Status at top */}
                <div>
                  <div className="text-sm text-slate-500 mb-1">Status</div>
                  <div className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-slate-50 text-slate-700">
                    {snapshot.Status || '—'}
                  </div>
                </div>
                
                {/* Primary Contact */}
                <div>
                  <div className="text-sm text-slate-500 mb-1">Primary Contact</div>
                  <div className="text-sm text-slate-900">
                    {snapshot.primaryContactName || '—'}
                    {snapshot.primaryContactEmail && (
                      <div>
                        <a href={`mailto:${snapshot.primaryContactEmail}`} className="text-blue-600 hover:underline">
                          {snapshot.primaryContactEmail}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-500 mb-1">Previous ATS</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.previousATS || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, previousATS: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.previousATS || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Users</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.payingUsers || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, payingUsers: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.payingUsers ?? '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Segment</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.customerSegment || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, customerSegment: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.customerSegment || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Upload Method</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.dataMethod || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, dataMethod: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.dataMethod || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Pod</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.pod || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, pod: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.pod || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Tier</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.tier || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, tier: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.tier || '—'}</div>
                  )}
                </div>
                
                {/* Attachments */}
                <div>
                  <div className="text-sm text-slate-500 mb-1">Attachments</div>
                  {!snapshot.attachments || !snapshot.attachments.trim() ? (
                    <div className="text-sm text-slate-400">No attachments added.</div>
                  ) : (
                    <div className="space-y-1">
                      {(() => {
                        // Split by newlines first, then by commas, trim, and filter empty
                        const urls = snapshot.attachments
                          .split('\n')
                          .flatMap(line => line.split(','))
                          .map(url => url.trim())
                          .filter(url => url.length > 0)
                        return urls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline block"
                          >
                            {url}
                          </a>
                        ))
                      })()}
                    </div>
                  )}
                </div>
                
                {/* Contact Fields */}
                <div>
                  <div className="text-sm text-slate-500 mb-1">Primary Contact Name</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.primaryContactName || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, primaryContactName: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.primaryContactName || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Primary Contact Email</div>
                  {isEditingDetails ? (
                    <input
                      type="email"
                      value={editingDetails.primaryContactEmail || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, primaryContactEmail: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">
                      {snapshot.primaryContactEmail ? (
                        <a href={`mailto:${snapshot.primaryContactEmail}`} className="text-blue-600 hover:underline">
                          {snapshot.primaryContactEmail}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Secondary Contact Name</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.secondaryContactName || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, secondaryContactName: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.secondaryContactName || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Secondary Contact Email</div>
                  {isEditingDetails ? (
                    <input
                      type="email"
                      value={editingDetails.secondaryContactEmail || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, secondaryContactEmail: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">
                      {snapshot.secondaryContactEmail ? (
                        <a href={`mailto:${snapshot.secondaryContactEmail}`} className="text-blue-600 hover:underline">
                          {snapshot.secondaryContactEmail}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Tertiary Contact Name</div>
                  {isEditingDetails ? (
                    <input
                      type="text"
                      value={editingDetails.tertiaryContactName || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, tertiaryContactName: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">{snapshot.tertiaryContactName || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Tertiary Contact Email</div>
                  {isEditingDetails ? (
                    <input
                      type="email"
                      value={editingDetails.tertiaryContactEmail || ''}
                      onChange={(e) => setEditingDetails({ ...editingDetails, tertiaryContactEmail: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={savingDetails}
                    />
                  ) : (
                    <div className="text-sm text-slate-900">
                      {snapshot.tertiaryContactEmail ? (
                        <a href={`mailto:${snapshot.tertiaryContactEmail}`} className="text-blue-600 hover:underline">
                          {snapshot.tertiaryContactEmail}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  )}
                </div>
                
                
                {/* Save/Cancel buttons for edit mode */}
                {isEditingDetails && (
                  <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                    <button
                      onClick={() => {
                        // Cancel: revert to original values and exit edit mode
                        setIsEditingDetails(false)
                        setEditingDetails({})
                      }}
                      disabled={savingDetails}
                      className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!snapshot?.MigrationID || !isEditor || savingDetails) return
                        
                        setSavingDetails(true)
                        try {
                          // Map field names to sheet header names (try both variants for contact fields)
                          const fieldMappings: Record<string, string[]> = {
                            previousATS: ['PreviousATS'],
                            payingUsers: ['PayingUsers'],
                            customerSegment: ['CustomerSegment'],
                            dataMethod: ['DataMethod'],
                            pod: ['Pod'],
                            tier: ['Tier'],
                            primaryContactName: ['Primary Contact Name', 'PrimaryContactName'],
                            primaryContactEmail: ['Primary Contact Email', 'PrimaryContactEmail'],
                            secondaryContactName: ['Secondary Contact Name', 'SecondaryContactName'],
                            secondaryContactEmail: ['Secondary Contact Email', 'SecondaryContactEmail'],
                            tertiaryContactName: ['Tertiary Contact Name', 'TertiaryContactName'],
                            tertiaryContactEmail: ['Tertiary Contact Email', 'TertiaryContactEmail'],
                          }
                          
                          // Update each field that has changed
                          const updatePromises = Object.entries(editingDetails)
                            .filter(([key, value]) => {
                              const currentValue = snapshot[key as keyof MigrationSnapshot]
                              return value !== (currentValue?.toString() || '')
                            })
                            .map(async ([key, value]) => {
                              const headerVariants = fieldMappings[key]
                              if (!headerVariants) return
                              
                              // Try each variant until one succeeds
                              let lastError: Error | null = null
                              for (const headerName of headerVariants) {
                                try {
                                  await updateMigrationFieldByHeader(snapshot.MigrationID!, headerName, value || '', token)
                                  return // Success, exit loop
                                } catch (e: any) {
                                  lastError = e
                                  // If it's not a "column not found" error, rethrow
                                  if (!e?.message?.includes('not found') && !e?.message?.includes('Column')) {
                                    throw e
                                  }
                                }
                              }
                              // If all variants failed, throw the last error
                              if (lastError) throw lastError
                            })
                          
                          await Promise.all(updatePromises)
                          
                          // Refresh snapshot to get updated values
                          const identifier = migrationId || customerId
                          if (identifier) {
                            let updatedSnapshot: MigrationSnapshot | null = null
                            if (migrationId) {
                              updatedSnapshot = await fetchMigrationSnapshotByMigrationId(migrationId)
                            } else if (customerId) {
                              updatedSnapshot = await fetchMigrationSnapshot(customerId)
                            }
                            if (updatedSnapshot) {
                              setSnapshot(updatedSnapshot)
                            }
                          }
                          
                          setIsEditingDetails(false)
                          setEditingDetails({})
                          setToast({ message: 'Customer details updated successfully.', type: 'success' })
                        } catch (e: any) {
                          console.error('[CustomerPage] Error saving customer details:', e)
                          setToast({ message: `Failed to save: ${e?.message || 'Unknown error'}`, type: 'error' })
                        } finally {
                          setSavingDetails(false)
                        }
                      }}
                      disabled={savingDetails || !snapshot?.MigrationID}
                      className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingDetails ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Activity Feed - Full Width Footer */}
      <div className="mt-6">
        <ActivityFeed migrationId={snapshot?.MigrationID || customerId || ''} />
      </div>
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
