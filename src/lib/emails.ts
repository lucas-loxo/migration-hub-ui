import { safeGetRows } from './sheets'

// Validator type matching schema.ts pattern
type Validator<T> = {
  parse: (data: any) => T
}

// Re-export validator functions from schema.ts pattern
function createValidator<T>(parseFn: (data: any) => T): Validator<T> {
  return { parse: parseFn }
}

function string(): Validator<string> {
  return createValidator((v: any) => String(v ?? ''))
}

function nullable<T>(validator: Validator<T>): Validator<T | null> {
  return createValidator((v: any) => {
    if (v == null || v === '') return null
    return validator.parse(v)
  })
}

function boolean(): Validator<boolean> {
  return createValidator((v: any) => {
    if (v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1') return true
    if (v === false || v === 'false' || v === 'FALSE' || v === 0 || v === '0') return false
    return false
  })
}

function nullableBoolean(): Validator<boolean | null> {
  return createValidator((v: any) => {
    if (v == null || v === '') return null
    if (v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1') return true
    if (v === false || v === 'false' || v === 'FALSE' || v === 0 || v === '0') return false
    return null
  })
}

function enumValidator<T extends string>(allowedValues: readonly T[]): Validator<T> {
  return createValidator((v: any) => {
    const str = String(v ?? '').trim()
    if (allowedValues.includes(str as T)) {
      return str as T
    }
    // Default to first allowed value if invalid
    return allowedValues[0]
  })
}

function nullableEnum<T extends string>(allowedValues: readonly T[]): Validator<T | null> {
  return createValidator((v: any) => {
    if (v == null || v === '') return null
    const str = String(v ?? '').trim()
    if (allowedValues.includes(str as T)) {
      return str as T
    }
    return null
  })
}

function object<T extends Record<string, any>>(shape: Record<keyof T, Validator<any>>): Validator<T> {
  return createValidator((data: any) => {
    const result: any = {}
    for (const [key, validator] of Object.entries(shape)) {
      try {
        result[key] = validator.parse(data[key])
      } catch (e) {
        // Skip invalid fields
      }
    }
    return result as T
  })
}

// Type definitions
export type EmailThreadRow = {
  ThreadID: string
  MigrationID: string
  GmailThreadId: string | null
  Subject: string | null
  PrimaryContactEmail: string | null
  OtherContactEmails: string | null
  ParticipantEmails: string | null
  OwnerEmail: string | null
  LastMessageAt: string | null
  LastMessageDirection: 'incoming' | 'outgoing' | 'internal' | null
  LastMessageSnippet: string | null
  Status: 'needs_action' | 'waiting_response' | 'snoozed' | 'closed' | null
  CreatedAt: string | null
  UpdatedAt: string | null
}

export type EmailMessageRow = {
  MessageID: string
  ThreadID: string
  MigrationID: string
  GmailMessageId: string | null
  Direction: 'incoming' | 'outgoing' | 'internal'
  Status: 'received' | 'sent' | 'draft' | 'ai_draft' | 'ready_to_send' | 'failed'
  Source: 'gmail' | 'mh_ui' | 'ai'
  FromEmail: string | null
  FromName: string | null
  ToEmails: string | null
  CcEmails: string | null
  BccEmails: string | null
  Subject: string | null
  BodyPlain: string | null
  BodyHtml: string | null
  HasAttachments: boolean | null
  GmailThreadUrl: string | null
  SentAt: string | null
  CreatedAt: string | null
  UpdatedAt: string | null
  IsAiDraft: boolean | null
  AiModel: 'gemini' | 'openai' | null
  AiDraftBodyPlain: string | null
  WasEditedByUser: boolean | null
}

// Validators (schemas)
const DirectionEnum = ['incoming', 'outgoing', 'internal'] as const
const MessageStatusEnum = ['received', 'sent', 'draft', 'ai_draft', 'ready_to_send', 'failed'] as const
const SourceEnum = ['gmail', 'mh_ui', 'ai'] as const
const ThreadStatusEnum = ['needs_action', 'waiting_response', 'snoozed', 'closed'] as const
const AiModelEnum = ['gemini', 'openai'] as const

export const ZEmailThreadRow = object<EmailThreadRow>({
  ThreadID: string(),
  MigrationID: string(),
  GmailThreadId: nullable(string()),
  Subject: nullable(string()),
  PrimaryContactEmail: nullable(string()),
  OtherContactEmails: nullable(string()),
  ParticipantEmails: nullable(string()),
  OwnerEmail: nullable(string()),
  LastMessageAt: nullable(string()),
  LastMessageDirection: nullableEnum(DirectionEnum),
  LastMessageSnippet: nullable(string()),
  Status: nullableEnum(ThreadStatusEnum),
  CreatedAt: nullable(string()),
  UpdatedAt: nullable(string()),
})

export const ZEmailMessageRow = object<EmailMessageRow>({
  MessageID: string(),
  ThreadID: string(),
  MigrationID: string(),
  GmailMessageId: nullable(string()),
  Direction: enumValidator(DirectionEnum),
  Status: enumValidator(MessageStatusEnum),
  Source: enumValidator(SourceEnum),
  FromEmail: nullable(string()),
  FromName: nullable(string()),
  ToEmails: nullable(string()),
  CcEmails: nullable(string()),
  BccEmails: nullable(string()),
  Subject: nullable(string()),
  BodyPlain: nullable(string()),
  BodyHtml: nullable(string()),
  HasAttachments: nullableBoolean(),
  GmailThreadUrl: nullable(string()),
  SentAt: nullable(string()),
  CreatedAt: nullable(string()),
  UpdatedAt: nullable(string()),
  IsAiDraft: nullableBoolean(),
  AiModel: nullableEnum(AiModelEnum),
  AiDraftBodyPlain: nullable(string()),
  WasEditedByUser: nullableBoolean(),
})

// Data fetch helpers
export async function getAllEmailThreads(
  token?: string
): Promise<EmailThreadRow[]> {
  try {
    const rows = await safeGetRows<EmailThreadRow>(
      'MH_EmailThreads',
      ZEmailThreadRow,
      {
        aliases: {
          MigrationID: ['MigrationID', 'Migration Id', 'migration_id'],
          ThreadID: ['ThreadID', 'Thread Id', 'thread_id'],
        },
        token,
      }
    )

    // Sort by LastMessageAt descending (most recent first)
    return rows.sort((a, b) => {
      const aTime = a.LastMessageAt ? new Date(a.LastMessageAt).getTime() : 0
      const bTime = b.LastMessageAt ? new Date(b.LastMessageAt).getTime() : 0
      return bTime - aTime
    })
  } catch (e: any) {
    const msg = String(e?.message || e)
    console.error('[emails] Error loading all email threads:', msg)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/not found/i.test(msg) || /Unable to parse range/i.test(msg)) {
      console.warn('[emails] MH_EmailThreads tab not found')
      return []
    }
    throw e
  }
}

export async function getEmailThreadsForMigration(
  migrationId: string,
  token?: string
): Promise<EmailThreadRow[]> {
  try {
    const rows = await safeGetRows<EmailThreadRow>(
      'MH_EmailThreads',
      ZEmailThreadRow,
      {
        aliases: {
          MigrationID: ['MigrationID', 'Migration Id', 'migration_id'],
        },
        token,
      }
    )

    // Filter by MigrationID
    return rows.filter((row) => {
      const rowMigrationId = String(row.MigrationID || '').trim()
      return rowMigrationId.toLowerCase() === migrationId.toLowerCase()
    })
  } catch (e: any) {
    const msg = String(e?.message || e)
    console.error('[emails] Error loading email threads:', msg)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/not found/i.test(msg) || /Unable to parse range/i.test(msg)) {
      console.warn('[emails] MH_EmailThreads tab not found')
      return []
    }
    throw e
  }
}

export async function getMessagesForThread(
  threadId: string,
  token?: string
): Promise<EmailMessageRow[]> {
  try {
    const rows = await safeGetRows<EmailMessageRow>(
      'MH_EmailMessages',
      ZEmailMessageRow,
      {
        aliases: {
          ThreadID: ['ThreadID', 'Thread Id', 'thread_id'],
        },
        token,
      }
    )

    // Filter by ThreadID
    return rows.filter((row) => {
      const rowThreadId = String(row.ThreadID || '').trim()
      return rowThreadId.toLowerCase() === threadId.toLowerCase()
    })
  } catch (e: any) {
    const msg = String(e?.message || e)
    console.error('[emails] Error loading email messages:', msg)
    if (/401/.test(msg)) {
      throw new Error('Not authenticated. Please sign in to Google.')
    }
    if (/not found/i.test(msg) || /Unable to parse range/i.test(msg)) {
      console.warn('[emails] MH_EmailMessages tab not found')
      return []
    }
    throw e
  }
}

