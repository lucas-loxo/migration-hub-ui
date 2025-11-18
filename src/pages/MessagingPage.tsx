import React, { useState, useEffect } from 'react'
import { useAuth } from '../state/AuthContext'
import { usePermissions } from '../state/usePermissions'
import { getAllEmailThreads, getMessagesForThread, type EmailThreadRow, type EmailMessageRow } from '../lib/emails'
import { fetchMigrationSnapshotByMigrationId, fetchCustomerProfile, type MigrationSnapshot, type CustomerProfile } from '../lib/sheetsCustomers'
import { createOutgoingEmailMessage } from '../lib/sheetsEmails'
import { getAccessToken } from '../lib/google'
import { requestWriteWithAi } from '../lib/ai'
import { getLatestAiDraft } from '../lib/apiClient'
import Card from '../components/Card.jsx'

export default function MessagingPage() {
  const { authed, token } = useAuth()
  const { isEditor } = usePermissions()
  const [threads, setThreads] = useState<EmailThreadRow[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string>('')
  const [messages, setMessages] = useState<EmailMessageRow[]>([])
  const [migrationSnapshot, setMigrationSnapshot] = useState<MigrationSnapshot | null>(null)
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<string>('')
  const [sending, setSending] = useState(false)
  
  // Write with AI state
  const [aiUserNote, setAiUserNote] = useState<string>('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [lastAiDraft, setLastAiDraft] = useState<string | null>(null)
  const [lastAiModel, setLastAiModel] = useState<string | null>(null)
  const [isGeneratingWithAi, setIsGeneratingWithAi] = useState(false)
  // AI draft display state
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false)
  const [aiDraftBody, setAiDraftBody] = useState<string | null>(null)

  // Load all threads on mount
  useEffect(() => {
    if (!authed) {
      setLoadingThreads(false)
      return
    }

    let active = true

    const loadThreads = async () => {
      setLoadingThreads(true)
      setError(null)
      try {
        const accessToken = token || getAccessToken()
        const data = await getAllEmailThreads(accessToken || undefined)
        if (!active) return
        setThreads(data)
        // Auto-select first thread if available
        if (data.length > 0 && !selectedThreadId) {
          setSelectedThreadId(data[0].ThreadID)
        }
      } catch (e: any) {
        if (!active) return
        const msg = String(e?.message || e)
        console.error('[MessagingPage] Error loading threads:', msg)
        setError(msg)
      } finally {
        if (active) {
          setLoadingThreads(false)
        }
      }
    }

    loadThreads()

    return () => {
      active = false
    }
  }, [authed, token])

  // Cleanup polling on unmount or thread change
  useEffect(() => {
    // Clear AI draft state when thread changes
    setAiDraftBody(null)
    setIsGeneratingAiDraft(false)
    
    return () => {
      // Stop any active polling when component unmounts or thread changes
      if ((window as any).__messagingPollCleanup) {
        ;(window as any).__messagingPollCleanup()
        delete (window as any).__messagingPollCleanup
      }
      setIsGeneratingWithAi(false)
    }
  }, [selectedThreadId])

  // Load messages when thread is selected
  useEffect(() => {
    if (!selectedThreadId || !authed) {
      setMessages([])
      return
    }

    let active = true

    const loadMessages = async () => {
      setLoadingMessages(true)
      try {
        const accessToken = token || getAccessToken()
        const data = await getMessagesForThread(selectedThreadId, accessToken || undefined)
        if (!active) return
        // Sort by SentAt/CreatedAt ascending (oldest first)
        const sorted = data.sort((a, b) => {
          const aTime = a.SentAt ? new Date(a.SentAt).getTime() : (a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0)
          const bTime = b.SentAt ? new Date(b.SentAt).getTime() : (b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0)
          return aTime - bTime
        })
        setMessages(sorted)
      } catch (e: any) {
        if (!active) return
        console.error('[MessagingPage] Error loading messages:', e)
      } finally {
        if (active) {
          setLoadingMessages(false)
        }
      }
    }

    loadMessages()

    return () => {
      active = false
    }
  }, [selectedThreadId, authed, token])

  // Load migration details when thread is selected
  useEffect(() => {
    if (!selectedThreadId || !authed) {
      setMigrationSnapshot(null)
      setCustomerProfile(null)
      return
    }

    const selectedThread = threads.find((t) => t.ThreadID === selectedThreadId)
    if (!selectedThread?.MigrationID) {
      setMigrationSnapshot(null)
      setCustomerProfile(null)
      return
    }

    let active = true

    const loadDetails = async () => {
      setLoadingDetails(true)
      try {
        // Get migration snapshot by MigrationID
        const snapshot = await fetchMigrationSnapshotByMigrationId(selectedThread.MigrationID)
        if (!active) return

        if (snapshot?.CustomerID) {
          // Then fetch customer profile
          const profile = await fetchCustomerProfile(snapshot.CustomerID)
          if (!active) return
          setCustomerProfile(profile)
        }

        setMigrationSnapshot(snapshot)
      } catch (e: any) {
        if (!active) return
        console.error('[MessagingPage] Error loading migration details:', e)
      } finally {
        if (active) {
          setLoadingDetails(false)
        }
      }
    }

    loadDetails()

    return () => {
      active = false
    }
  }, [selectedThreadId, threads, authed])

  const selectedThread = threads.find((t) => t.ThreadID === selectedThreadId)

  // Format date for display
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString()
    } catch {
      return dateStr || ''
    }
  }

  const handleSend = async () => {
    if (!selectedThread || !replyText.trim() || sending) {
      return
    }

    if (!isEditor) {
      setError('Read-only access. Contact Lucas if you need edit permissions.')
      return
    }

    const accessToken = token || getAccessToken()
    if (!accessToken) {
      setError('Not authenticated. Please sign in to Google.')
      return
    }

    setSending(true)
    setError(null)

    try {
      // Get thread and migration info
      const threadId = selectedThread.ThreadID
      // Preserve MigrationID as string exactly as it appears in the thread (no coercion)
      const migrationId = String(selectedThread.MigrationID)
      const subject = selectedThread.Subject || 'Re: Migration Update'
      
      // Get recipient email (default to primary contact if available)
      const toEmails = migrationSnapshot?.primaryContactEmail || selectedThread.PrimaryContactEmail || ''
      
      if (!toEmails) {
        throw new Error('No recipient email found. Please ensure the migration has a primary contact.')
      }

      // For now, hard-code fromEmail (user will make this dynamic later)
      const fromEmail = 'lucas@loxo.co'

      // Determine if this is an AI-originated message
      const isAiDraft = aiDraftBody !== null || lastAiDraft !== null
      const wasEditedByUser = isAiDraft && replyText.trim() !== (aiDraftBody || lastAiDraft)
      // Map AI model string to schema type ('gemini' | 'openai' | null)
      let aiModel: 'gemini' | 'openai' | undefined = undefined
      if (isAiDraft) {
        const modelStr = (lastAiModel || 'gemini_write_with_ai').toLowerCase()
        if (modelStr.includes('gemini')) {
          aiModel = 'gemini'
        } else if (modelStr.includes('openai') || modelStr.includes('gpt')) {
          aiModel = 'openai'
        } else {
          aiModel = 'gemini' // default to gemini
        }
      }

      // Create the message row in MH_EmailMessages
      await createOutgoingEmailMessage({
        token: accessToken,
        threadId,
        migrationId,
        fromEmail,
        toEmails,
        subject,
        bodyPlain: replyText.trim(),
        isAiDraft: isAiDraft,
        aiModel: aiModel,
        aiDraftBodyPlain: aiDraftBody || lastAiDraft || undefined,
        wasEditedByUser: wasEditedByUser,
      })

      // Success: clear compose box and AI draft state
      const messageBody = replyText.trim()
      setReplyText('')
      setAiDraftBody(null)
      setLastAiDraft(null)
      setLastAiModel(null)
      setAiUserNote('')
      console.log('[MessagingPage] Message queued to send')

      // Optimistic update: immediately add the outgoing message to the UI
      const nowIso = new Date().toISOString()
      const newMessage: EmailMessageRow = {
        MessageID: `temp_${Date.now()}`, // Temporary ID until refetch
        ThreadID: threadId,
        MigrationID: migrationId,
        GmailMessageId: null,
        Direction: 'outgoing',
        Status: 'ready_to_send',
        Source: 'mh_ui',
        FromEmail: fromEmail,
        FromName: null,
        ToEmails: toEmails,
        CcEmails: null,
        BccEmails: null,
        Subject: subject,
        BodyPlain: messageBody,
        BodyHtml: null,
        HasAttachments: false,
        GmailThreadUrl: null,
        SentAt: null, // not sent yet
        CreatedAt: nowIso,
        UpdatedAt: nowIso,
        IsAiDraft: isAiDraft,
        AiModel: aiModel || null,
        AiDraftBodyPlain: lastAiDraft,
        WasEditedByUser: wasEditedByUser,
      }

      // Add the new message to the messages state and sort chronologically
      setMessages((prev) => {
        const updated = [...prev, newMessage]
        return updated.sort((a, b) => {
          const aTime = a.SentAt ? new Date(a.SentAt).getTime() : (a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0)
          const bTime = b.SentAt ? new Date(b.SentAt).getTime() : (b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0)
          return aTime - bTime
        })
      })

      // Optionally refetch messages in the background to get the real MessageID from Sheets
      // (but the UI already shows the optimistic message, so this is just for sync)
      setTimeout(async () => {
        try {
          const accessTokenForReload = token || getAccessToken()
          const updatedMessages = await getMessagesForThread(threadId, accessTokenForReload || undefined)
          const sorted = updatedMessages.sort((a, b) => {
            const aTime = a.SentAt ? new Date(a.SentAt).getTime() : (a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0)
            const bTime = b.SentAt ? new Date(b.SentAt).getTime() : (b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0)
            return aTime - bTime
          })
          setMessages(sorted)
        } catch (e) {
          console.warn('[MessagingPage] Background refetch failed, optimistic message still visible:', e)
        }
      }, 1000)
    } catch (e: any) {
      const msg = String(e?.message || e)
      console.error('[MessagingPage] Error sending message:', msg)
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  const handleGenerateAiDraft = async () => {
    if (!selectedThread || !aiUserNote.trim() || isGeneratingAiDraft || isGeneratingWithAi) {
      return
    }

    if (!isEditor) {
      setAiError('Read-only access. Contact Lucas if you need edit permissions.')
      return
    }

    setIsGeneratingAiDraft(true)
    setAiError(null)
    setIsGeneratingWithAi(true)

    try {
      // Build payload for AI webhook - now includes threadId
      const payload = {
        mode: 'write_with_ai' as const,
        threadId: selectedThread.ThreadID,  // Include threadId in payload
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
        migration: migrationSnapshot ? {
          migrationId: migrationSnapshot.MigrationID || selectedThread.MigrationID,
          customerName: migrationSnapshot.CustomerName,
          stage: migrationSnapshot.Stage,
          ownerEmail: migrationSnapshot.OwnerEmail,
          previousATS: migrationSnapshot.previousATS,
          dataMethod: migrationSnapshot.dataMethod,
          tier: migrationSnapshot.tier,
          pod: migrationSnapshot.pod,
        } : undefined,
        customer: customerProfile ? {
          customerName: customerProfile.CustomerName,
          primaryContactName: customerProfile.PrimaryContactName,
          primaryContactEmail: customerProfile.PrimaryContactEmail,
          previousATS: customerProfile.PreviousATS,
          customerSegment: customerProfile.CustomerSegment,
        } : undefined,
      }

      // Call Zapier webhook (fire and forget - don't expect draftBodyPlain in response)
      await requestWriteWithAi(payload)

      // Clear AI draft body to show loading state
      setAiDraftBody(null)

      // Start polling for the draft from MH_AiEmailLog
      const accessToken = token || getAccessToken()
      const currentThreadId = selectedThread.ThreadID
      const maxAttempts = 15
      const pollInterval = 1000 // 1 second
      let attempts = 0
      let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
      let isPollingActive = true

      const pollForDraft = async () => {
        // Check if we should stop polling (thread changed or component unmounted)
        if (!isPollingActive || selectedThreadId !== currentThreadId) {
          return
        }

        try {
          const result = await getLatestAiDraft(currentThreadId, accessToken || undefined)
          
          // Check again after async operation
          if (!isPollingActive || selectedThreadId !== currentThreadId) {
            return
          }
          
          if (result.draftText && result.draftText.trim().length > 0) {
            // Draft found - set AI draft body (not the main reply text)
            setAiDraftBody(result.draftText)
            setIsGeneratingAiDraft(false)
            setIsGeneratingWithAi(false)
            isPollingActive = false
            if (pollTimeoutId) {
              clearTimeout(pollTimeoutId)
            }
            return
          }

          attempts++
          if (attempts >= maxAttempts) {
            // Max attempts reached
            if (isPollingActive && selectedThreadId === currentThreadId) {
              setIsGeneratingAiDraft(false)
              setIsGeneratingWithAi(false)
              setAiError('AI draft not available yet. Please try again.')
            }
            isPollingActive = false
            if (pollTimeoutId) {
              clearTimeout(pollTimeoutId)
            }
            return
          }

          // Continue polling
          if (isPollingActive && selectedThreadId === currentThreadId) {
            pollTimeoutId = setTimeout(pollForDraft, pollInterval)
          }
        } catch (e: any) {
          console.error('[MessagingPage] Error polling for AI draft:', e)
          attempts++
          if (attempts >= maxAttempts) {
            if (isPollingActive && selectedThreadId === currentThreadId) {
              setIsGeneratingAiDraft(false)
              setIsGeneratingWithAi(false)
              setAiError('AI draft not available yet. Please try again.')
            }
            isPollingActive = false
            return
          }
          if (isPollingActive && selectedThreadId === currentThreadId) {
            pollTimeoutId = setTimeout(pollForDraft, pollInterval)
          }
        }
      }

      // Cleanup function to stop polling
      const cleanup = () => {
        isPollingActive = false
        if (pollTimeoutId) {
          clearTimeout(pollTimeoutId)
          pollTimeoutId = null
        }
      }

      // Store cleanup function for component unmount
      ;(window as any).__messagingPollCleanup = cleanup

      // Start polling after a short delay
      pollTimeoutId = setTimeout(pollForDraft, pollInterval)
    } catch (e: any) {
      const msg = String(e?.message || e)
      console.error('[MessagingPage] Error generating AI draft:', msg)
      setAiError(msg)
      setIsGeneratingWithAi(false)
      setIsGeneratingAiDraft(false)
    }
  }

  if (!authed) {
    return (
      <Card className="p-6">
        <div className="text-center text-[#6B647E]">Please sign in to view messages</div>
      </Card>
    )
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-xl shadow-sm border border-[#E3D7E8] overflow-hidden">
      {/* Left: Thread List */}
      <div className="w-64 border-r bg-[#FFF8FC] flex flex-col">
        <div className="p-4 border-b bg-white border-[#E3D7E8]">
          <h2 className="text-sm font-semibold text-[#1B1630] mb-2">Inbox</h2>
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full text-sm rounded-lg border border-[#E3D7E8] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#E01E73]"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="p-4 text-sm text-[#6B647E]">Loading threads...</div>
          ) : error ? (
            <div className="p-4 text-sm text-rose-600">{error}</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-[#6B647E]">No threads found</div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.ThreadID}
                onClick={() => setSelectedThreadId(thread.ThreadID)}
                className={`w-full text-left p-3 border-b border-[#E3D7E8] hover:bg-[#E01E73]/5 transition ${
                  selectedThreadId === thread.ThreadID ? 'bg-[#E01E73]/10 border-l-4 border-[#E01E73]' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-[#1B1630] truncate">
                    {thread.Subject || 'No subject'}
                  </span>
                  {thread.Status === 'needs_action' && (
                    <span className="shrink-0 w-2 h-2 bg-[#E01E73] rounded-full ml-2"></span>
                  )}
                </div>
                <div className="text-xs text-[#6B647E] truncate mb-1">
                  {thread.LastMessageSnippet || 'No preview'}
                </div>
                <div className="text-xs text-[#6B647E]">
                  {formatDate(thread.LastMessageAt)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Center: Thread View */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="border-b bg-white border-[#E3D7E8] p-4">
              <h3 className="text-sm font-semibold text-[#1B1630]">{selectedThread.Subject || 'No subject'}</h3>
              <p className="text-xs text-[#6B647E] mt-1">
                {migrationSnapshot?.CustomerName || 'Loading...'} • {selectedThread.PrimaryContactEmail || ''}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#FFF8FC]">
              {loadingMessages ? (
                <div className="text-sm text-[#6B647E]">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-[#6B647E]">No messages in this thread</div>
              ) : (
                messages.map((msg, index) => {
                  const isIncoming = msg.Direction === 'incoming'
                  const isOutgoing = msg.Direction === 'outgoing'
                  // Show pending indicator if outgoing and (SentAt is empty OR Status is ready_to_send)
                  const isPending = isOutgoing && (!msg.SentAt || msg.Status === 'ready_to_send')
                  
                  // Generate a unique, stable key: use MessageID if present and non-empty, otherwise composite with ThreadID + GmailMessageId or CreatedAt
                  // DO NOT allow an empty string key under any circumstance
                  const messageId = msg.MessageID?.trim() || null
                  const threadId = msg.ThreadID || 'no-thread'
                  const gmailMessageId = msg.GmailMessageId || null
                  const createdAt = msg.CreatedAt || null
                  
                  const key = messageId
                    ? `msg-${messageId}`
                    : gmailMessageId
                      ? `msg-${threadId}-${gmailMessageId}`
                      : `msg-${threadId}-local-${createdAt || index}`
                  
                  return (
                    <div
                      key={key}
                      className={`flex gap-3 ${isIncoming ? 'justify-start' : 'justify-end'}`}
                    >
                      {isIncoming && (
                        <div className="shrink-0 w-8 h-8 rounded-full bg-[#6C3EF2] flex items-center justify-center text-white text-xs font-medium">
                          {(msg.FromName || msg.FromEmail || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-2xl p-3 ${
                          isIncoming
                            ? 'bg-white border border-[#E3D7E8] text-[#1B1630]'
                            : 'bg-[#E01E73]/10 border border-[#E01E73]/40 text-[#1B1630]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{msg.FromName || msg.FromEmail || 'Unknown'}</span>
                          <span className="text-xs text-[#6B647E]">{formatDate(msg.SentAt || msg.CreatedAt)}</span>
                          {isPending && (
                            <span className="text-xs text-amber-600 font-medium">Pending…</span>
                          )}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {msg.BodyPlain || msg.BodyHtml || '(No content)'}
                        </div>
                        {msg.IsAiDraft && (
                          <div className="text-xs text-[#6B647E] mt-2 italic">
                            AI Draft ({msg.AiModel || 'unknown'})
                          </div>
                        )}
                      </div>
                      {isOutgoing && (
                        <div className="shrink-0 w-8 h-8 rounded-full bg-[#E01E73] flex items-center justify-center text-white text-xs font-medium">
                          {(msg.FromName || msg.FromEmail || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Draft Email Section */}
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
                  disabled={sending || !isEditor}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={handleSend}
                    disabled={!selectedThread || !replyText.trim() || sending || !isEditor}
                    title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      !selectedThread || !replyText.trim() || sending || !isEditor
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-[#E01E73] text-white hover:bg-[#B0175B]'
                    }`}
                  >
                    {sending ? 'Sending...' : 'Send'}
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
                  disabled={isGeneratingAiDraft || !isEditor}
                />
                
                <div className="flex items-center justify-end gap-2 mt-2">
                  <input
                    type="text"
                    value={aiUserNote}
                    onChange={(e) => setAiUserNote(e.target.value)}
                    placeholder="Tell AI what you want this email to say..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E01E73]"
                    disabled={isGeneratingAiDraft || !isEditor}
                  />
                  <button
                    onClick={handleGenerateAiDraft}
                    disabled={!selectedThread || isGeneratingAiDraft || !aiUserNote.trim() || !isEditor}
                    title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      !selectedThread || isGeneratingAiDraft || !aiUserNote.trim() || !isEditor
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isGeneratingAiDraft ? 'Generating...' : 'Write with AI'}
                  </button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#6B647E]">
            {loadingThreads ? 'Loading threads...' : 'Select a conversation to view messages'}
          </div>
        )}
      </div>

      {/* Right: Details Panel */}
      {selectedThread && (
        <div className="w-80 border-l bg-[#FFF8FC] border-[#E3D7E8] p-4 space-y-4 overflow-y-auto">
          {loadingDetails ? (
            <div className="text-sm text-[#6B647E]">Loading details...</div>
          ) : (
            <>
              {/* Customer */}
              {customerProfile && (
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-[#1B1630] mb-3">Customer</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#6B647E]">Name:</span>
                      <span className="ml-2 text-[#1B1630]">{customerProfile.CustomerName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[#6B647E]">Primary Contact:</span>
                      <span className="ml-2 text-[#1B1630]">{customerProfile.PrimaryContactName || '—'}</span>
                    </div>
                    {customerProfile.PrimaryContactEmail && (
                      <div>
                        <span className="text-[#6B647E]">Email:</span>
                        <a
                          href={`mailto:${customerProfile.PrimaryContactEmail}`}
                          className="ml-2 text-[#E01E73] hover:underline"
                        >
                          {customerProfile.PrimaryContactEmail}
                        </a>
                      </div>
                    )}
                    {customerProfile.CustomerSegment && (
                      <div>
                        <span className="text-[#6B647E]">Segment:</span>
                        <span className="ml-2 text-[#1B1630]">{customerProfile.CustomerSegment}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Migration Info */}
              {migrationSnapshot && (
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-[#1B1630] mb-3">Migration Info</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#6B647E]">Stage:</span>
                      <span className="ml-2 text-[#1B1630]">{migrationSnapshot.Stage || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[#6B647E]">Owner:</span>
                      <span className="ml-2 text-[#1B1630]">{migrationSnapshot.OwnerEmail || '—'}</span>
                    </div>
                    {migrationSnapshot.tier && (
                      <div>
                        <span className="text-[#6B647E]">Tier:</span>
                        <span className="ml-2 text-[#1B1630]">{migrationSnapshot.tier}</span>
                      </div>
                    )}
                    {migrationSnapshot.pod && (
                      <div>
                        <span className="text-[#6B647E]">Pod:</span>
                        <span className="ml-2 text-[#1B1630]">{migrationSnapshot.pod}</span>
                      </div>
                    )}
                    {migrationSnapshot.previousATS && (
                      <div>
                        <span className="text-[#6B647E]">Previous ATS:</span>
                        <span className="ml-2 text-[#1B1630]">{migrationSnapshot.previousATS}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Thread Info */}
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-[#1B1630] mb-3">Thread Info</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-[#6B647E]">Status:</span>
                    <span className="ml-2 text-[#1B1630]">{selectedThread.Status || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#6B647E]">Last Message:</span>
                    <span className="ml-2 text-[#1B1630]">{formatDate(selectedThread.LastMessageAt)}</span>
                  </div>
                  {selectedThread.OwnerEmail && (
                    <div>
                      <span className="text-[#6B647E]">Owner:</span>
                      <span className="ml-2 text-[#1B1630]">{selectedThread.OwnerEmail}</span>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

    </div>
  )
}
