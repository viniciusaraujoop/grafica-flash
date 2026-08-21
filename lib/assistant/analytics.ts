import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const ASSISTANT_EVENT_NAMES = [
  'assistant_open',
  'assistant_message_sent',
  'assistant_quick_action',
  'assistant_plan_recommended',
  'assistant_demo_opened',
  'assistant_signup_clicked',
  'assistant_whatsapp_clicked',
  'assistant_lead_created',
  'assistant_feedback',
  'assistant_unanswered',
  'assistant_provider_error',
] as const

export type AssistantEventName = (typeof ASSISTANT_EVENT_NAMES)[number]

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function hashSession(value: unknown) {
  const raw = String(value || '').trim().slice(0, 120)
  if (!raw) return null
  return createHash('sha256').update(`orcaly-assistant-session:v2:${raw}`).digest('hex')
}

function safeText(value: unknown, max = 120) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, max)
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const input = value as Record<string, unknown>
  const allowed = [
    'rating',
    'intent',
    'source',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'pc',
    'ref_present',
    'crm_saved',
  ]
  const result: Record<string, unknown> = {}

  for (const key of allowed) {
    if (!(key in input)) continue
    const item = input[key]
    result[key] = typeof item === 'boolean' || typeof item === 'number'
      ? item
      : safeText(item, 100)
  }

  return result
}

export async function recordAssistantEvent(input: {
  eventName: AssistantEventName
  sessionId?: unknown
  requestId?: string
  pagePath?: unknown
  segment?: unknown
  recommendedPlan?: unknown
  toolName?: unknown
  status?: unknown
  latencyMs?: number
  model?: unknown
  promptTokens?: number
  completionTokens?: number
  metadata?: unknown
}) {
  if (!ASSISTANT_EVENT_NAMES.includes(input.eventName)) return false

  const client = adminClient()
  const sessionHash = hashSession(input.sessionId)
  if (!client || !sessionHash) return false

  try {
    const { error } = await client.from('assistant_events').insert({
      request_id: input.requestId || randomUUID(),
      session_hash: sessionHash,
      event_name: input.eventName,
      page_path: safeText(input.pagePath, 180) || null,
      segment: safeText(input.segment, 80) || null,
      recommended_plan: safeText(input.recommendedPlan, 40) || null,
      tool_name: safeText(input.toolName, 60) || null,
      status: safeText(input.status, 40) || null,
      latency_ms: Number.isFinite(input.latencyMs) ? Math.max(0, Math.floor(input.latencyMs || 0)) : null,
      model: safeText(input.model, 100) || null,
      prompt_tokens: Number.isFinite(input.promptTokens) ? Math.max(0, Math.floor(input.promptTokens || 0)) : null,
      completion_tokens: Number.isFinite(input.completionTokens) ? Math.max(0, Math.floor(input.completionTokens || 0)) : null,
      metadata: safeMetadata(input.metadata),
    })

    if (error) {
      if (!String(error.message || '').includes('assistant_events')) {
        console.error('assistant_event_insert_error', safeText(error.message, 180))
      }
      return false
    }

    return true
  } catch (error) {
    console.error(
      'assistant_event_insert_exception',
      safeText(error instanceof Error ? error.message : error, 180),
    )
    return false
  }
}
