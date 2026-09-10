import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

export function integrationPayloadHash(rawBody: string) {
  return createHash('sha256').update(rawBody).digest('hex')
}

export async function registerIntegrationWebhook(db: SupabaseClient, input: {
  provider: IntegrationProviderKey
  connectionId: string
  companyId: string
  externalEventId: string
  eventType?: string | null
  rawBody: string
  metadata?: Record<string, unknown>
}) {
  const eventId = `${input.connectionId}:${input.externalEventId}`
  const row = {
    provider: input.provider,
    event_id: eventId,
    company_id: input.companyId,
    event_type: input.eventType || null,
    payload_hash: integrationPayloadHash(input.rawBody),
    status: 'received',
    metadata: { connection_id: input.connectionId, ...(input.metadata || {}) },
  }
  const { data, error } = await db.from('event_idempotency').insert(row).select('id').maybeSingle()
  if (!error) return { duplicate: false, id: data?.id || null }
  if (error.code === '23505') return { duplicate: true, id: null }
  throw error
}

export async function completeIntegrationWebhook(db: SupabaseClient, id: string, status: 'processed' | 'ignored' | 'failed' | 'retrying' | 'needs_attention', lastError?: string | null) {
  const { error } = await db.from('event_idempotency').update({
    status,
    processed_at: status === 'processed' || status === 'ignored' ? new Date().toISOString() : null,
    last_error: lastError || null,
  }).eq('id', id)
  if (error) throw error
}
