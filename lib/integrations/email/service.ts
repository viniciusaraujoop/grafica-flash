import type { SupabaseClient } from '@supabase/supabase-js'
import { isTransactionalEmailTemplate, normalizeEmailAddress, type TransactionalEmailTemplateKey } from '@/lib/integrations/email/core'

export async function enqueueTransactionalEmail(db: SupabaseClient, input: {
  companyId: string
  connectionId: string
  template: TransactionalEmailTemplateKey
  to: string
  subject?: string | null
  data?: Record<string, unknown>
  idempotencyKey: string
}) {
  const to = normalizeEmailAddress(input.to)
  if (!to) throw new Error('Destinatário de e-mail inválido.')
  if (!isTransactionalEmailTemplate(input.template)) throw new Error('Template de e-mail inválido.')
  const key = input.idempotencyKey.trim().slice(0, 240)
  if (!key) throw new Error('Idempotency key obrigatória.')
  const { data, error } = await db.rpc('enqueue_integration_email', {
    p_company_id: input.companyId,
    p_connection_id: input.connectionId,
    p_template_key: input.template,
    p_to_email: to,
    p_subject: input.subject?.trim().slice(0, 240) || null,
    p_template_data: input.data || {},
    p_idempotency_key: key,
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Fila de e-mail retornou resposta inválida.')
  const row = data as Record<string, unknown>
  return { deliveryId: typeof row.delivery_id === 'string' ? row.delivery_id : null, jobId: typeof row.job_id === 'string' ? row.job_id : null, queued: row.queued === true }
}

export async function recordEmailTimeline(db: SupabaseClient, input: { companyId: string; deliveryId: string; eventType: string; title: string; summary?: string | null; metadata?: Record<string, unknown> }) {
  const { error } = await db.from('timeline_events').insert({
    company_id: input.companyId,
    event_type: input.eventType,
    entity_type: 'email_delivery',
    entity_id: input.deliveryId,
    actor_type: 'system',
    source: 'resend',
    title: input.title,
    summary: input.summary || null,
    metadata: input.metadata || {},
  })
  if (error) throw error
}
