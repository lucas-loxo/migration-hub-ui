/**
 * Vite plugin to handle API endpoints
 * - /api/write-with-ai: Proxies requests to Zapier webhook to avoid CORS issues
 * - /api/migrations/status-sync: Forwards migration status changes to Zapier, which updates the corresponding GitHub issue
 */
import type { Plugin } from 'vite'
import type { Connect } from 'vite'
import { loadEnv } from 'vite'

/**
 * Server-side helper to get Zapier webhook URL from environment
 * Matches the pattern of getWriteWithAiWebhookUrl() in src/config/env.ts
 */
function getWriteWithAiWebhookUrl(env: Record<string, string>): string {
  const url = env.VITE_ZAPIER_WRITE_WITH_AI_WEBHOOK_URL
  if (!url) {
    throw new Error('Write with AI webhook URL is missing. Set VITE_ZAPIER_WRITE_WITH_AI_WEBHOOK_URL in .env.local (dev) or GH Actions secrets (prod).')
  }
  return url
}

export function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      // Load env vars (Vite prefixes client vars with VITE_)
      const env = loadEnv(server.config.mode, server.config.envDir || process.cwd(), '')

      // Handle OPTIONS preflight first
      server.middlewares.use('/api/write-with-ai', (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.writeHead(200)
          res.end()
          return
        }
        next()
      })

      // Handle POST requests
      server.middlewares.use('/api/write-with-ai', async (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        // Only handle POST requests
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          // Read request body
          let body = ''
          req.on('data', (chunk) => {
            body += chunk.toString()
          })

          req.on('end', async () => {
            try {
              // Get Zapier webhook URL using server-side helper
              const zapierUrl = getWriteWithAiWebhookUrl(env)

              // Forward request to Zapier
              const zapierResponse = await fetch(zapierUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: body,
              })

              // Set CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
              
              // Read response body once (can't read twice)
              const contentType = zapierResponse.headers.get('content-type') || ''
              
              // Handle non-2xx responses
              if (!zapierResponse.ok) {
                const errorText = await zapierResponse.text().catch(() => 'Unknown error')
                console.error(`[API Plugin] Zapier returned ${zapierResponse.status}: ${errorText.substring(0, 200)}`)
                res.writeHead(zapierResponse.status || 500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ 
                  error: 'Write with AI Zap failed',
                  status: zapierResponse.status 
                }))
                return
              }

              // Read response body as text first (can parse JSON from text, but can't read twice)
              const responseText = await zapierResponse.text().catch(() => '')
              let zapData: any

              // Parse response based on content type
              if (contentType.includes('application/json')) {
                try {
                  zapData = JSON.parse(responseText)
                } catch (parseError) {
                  // Fallback to text if JSON parse fails
                  zapData = { draftBodyPlain: responseText, model: 'zap-raw' }
                }
              } else {
                // Plain text or other content type
                zapData = { draftBodyPlain: responseText, model: 'zap-raw' }
              }

              // Log response for debugging (truncated)
              const preview = typeof zapData === 'string' 
                ? zapData.substring(0, 200)
                : JSON.stringify(zapData).substring(0, 200)
              console.log(`[API Plugin] Zapier response (${zapierResponse.status}): ${preview}${preview.length >= 200 ? '...' : ''}`)

              // Normalize response to always return { draftBodyPlain, model }
              const result: { draftBodyPlain: string; model: string } = {
                draftBodyPlain: '',
                model: 'gemini-write-with-ai'
              }

              // Extract draftBodyPlain
              if (zapData && typeof zapData === 'object') {
                // Check for draftBodyPlain directly
                if (typeof zapData.draftBodyPlain === 'string' && zapData.draftBodyPlain.trim().length > 0) {
                  result.draftBodyPlain = zapData.draftBodyPlain
                }
                // Check for alternative text fields
                else if (typeof zapData.text === 'string' && zapData.text.trim().length > 0) {
                  result.draftBodyPlain = zapData.text
                }
                else if (typeof zapData.message === 'string' && zapData.message.trim().length > 0) {
                  result.draftBodyPlain = zapData.message
                }
                else if (typeof zapData.body === 'string' && zapData.body.trim().length > 0) {
                  result.draftBodyPlain = zapData.body
                }
                else if (typeof zapData.content === 'string' && zapData.content.trim().length > 0) {
                  result.draftBodyPlain = zapData.content
                }
                // If the whole object is a string value, use it
                else if (Object.keys(zapData).length === 1 && typeof Object.values(zapData)[0] === 'string') {
                  result.draftBodyPlain = String(Object.values(zapData)[0])
                }
              } else if (typeof zapData === 'string' && zapData.trim().length > 0) {
                // If zapData itself is a string
                result.draftBodyPlain = zapData
              }

              // Extract model
              if (zapData && typeof zapData === 'object' && typeof zapData.model === 'string') {
                result.model = zapData.model
              }

              // Return normalized response
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(result))
            } catch (error: any) {
              console.error('[API Plugin] Error proxying to Zapier:', error)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ 
                error: error.message || 'Failed to proxy request to Zapier',
                details: error.message 
              }))
            }
          })
        } catch (error: any) {
          console.error('[API Plugin] Error reading request:', error)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Failed to process request',
            details: error.message 
          }))
        }
      })

      // Handle OPTIONS preflight for status-sync endpoint
      server.middlewares.use('/api/migrations/status-sync', (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.writeHead(200)
          res.end()
          return
        }
        next()
      })

      // Handle POST requests for status-sync endpoint
      // This endpoint forwards migration status changes to Zapier, which updates the corresponding GitHub issue.
      // It is triggered from the migration detail page (CustomerPage) status control.
      server.middlewares.use('/api/migrations/status-sync', async (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          // Read request body
          let body = ''
          req.on('data', (chunk) => {
            body += chunk.toString()
          })

          req.on('end', async () => {
            try {
              // Parse request body
              let requestData: any
              try {
                requestData = JSON.parse(body)
              } catch (parseError) {
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Invalid JSON in request body' }))
                return
              }

              // Validate required fields
              const { migrationId, targetStatus } = requestData
              if (!migrationId || typeof migrationId !== 'string' || migrationId.trim() === '') {
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'migrationId is required and must be a non-empty string' }))
                return
              }
              if (!targetStatus || typeof targetStatus !== 'string' || targetStatus.trim() === '') {
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'targetStatus is required and must be a non-empty string' }))
                return
              }

              // Build payload for Zapier
              const zapierPayload: any = {
                migrationId: String(migrationId).trim(),
                targetStatus: String(targetStatus).trim(),
              }

              // Add optional context fields if provided
              if (requestData.customerId) {
                zapierPayload.customerId = String(requestData.customerId).trim()
              }
              if (requestData.currentStage) {
                zapierPayload.currentStage = String(requestData.currentStage).trim()
              }
              if (requestData.updatedByUserEmail) {
                zapierPayload.updatedByUserEmail = String(requestData.updatedByUserEmail).trim()
              }

              console.log(`[MH-StatusSync] Sending status change to Zapier: migrationId=${zapierPayload.migrationId}, targetStatus=${zapierPayload.targetStatus}`)

              // POST to Zapier Catch Hook
              const zapierUrl = 'https://hooks.zapier.com/hooks/catch/25132117/u8vyvfs/'
              const zapierResponse = await fetch(zapierUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(zapierPayload),
              })

              // Set CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

              // Handle non-2xx responses
              if (!zapierResponse.ok) {
                const errorText = await zapierResponse.text().catch(() => 'Unknown error')
                console.error(`[MH-StatusSync] Zapier webhook failed: ${zapierResponse.status} ${errorText.substring(0, 200)}`)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ 
                  error: 'Failed to sync status to GitHub',
                  status: zapierResponse.status 
                }))
                return
              }

              // Success response
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true }))
            } catch (error: any) {
              console.error('[MH-StatusSync] Error processing status sync:', error)
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ 
                error: error.message || 'Failed to sync status to GitHub',
                details: error.message 
              }))
            }
          })
        } catch (error: any) {
          console.error('[MH-StatusSync] Error reading request:', error)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: 'Failed to process request',
            details: error.message 
          }))
        }
      })

      // Handle OPTIONS preflight for AI drafts endpoint
      server.middlewares.use('/api/ai-drafts/latest', (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.writeHead(200)
          res.end()
          return
        }
        next()
      })

      // Handle GET requests for latest AI draft endpoint
      server.middlewares.use('/api/ai-drafts/latest', async (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        try {
          // Parse query parameters
          const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
          const threadId = url.searchParams.get('threadId')

          if (!threadId || threadId.trim() === '') {
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'threadId query parameter is required' }))
            return
          }

          // Get authorization token from request headers
          const authHeader = req.headers.authorization
          const token = authHeader?.replace('Bearer ', '') || undefined

          // Import the helper function dynamically
          const { getLatestAiDraftForThread } = await import('../src/lib/sheetsAiEmailLog')
          
          // Get the result, passing the token if available
          const result = await getLatestAiDraftForThread(threadId.trim(), token)

          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (error: any) {
          console.error('[API Plugin] Error getting AI draft:', error)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            error: error.message || 'Failed to get AI draft',
            details: error.message 
          }))
        }
      })
    },
  }
}

