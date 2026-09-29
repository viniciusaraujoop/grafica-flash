import { IntegrationError, normalizeIntegrationError } from '@/lib/integrations/core/errors'
import { getCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { createIntegrationRuntimeContext } from '@/lib/integrations/runtime'
import { isPlainRecord, isUuid, type JobPayloadResult } from '@/lib/jobs/core'
import type { JobExecutionContext, JobHandler } from '@/lib/jobs/registry'
import { isTransactionalEmailTemplate, renderTransactionalEmail } from '@/lib/integrations/email/core'
import { resendEmailProvider } from '@/lib/integrations/email/resend'
import { recordEmailTimeline } from '@/lib/integrations/email/service'

type EmailSendJobPayload = { deliveryId: string; connectionId: string }

function parsePayload(value: unknown): JobPayloadResult<EmailSendJobPayload> {
  if (!isPlainRecord(value) || !isUuid(value.delivery_id) || !isUuid(value.connection_id)) return { ok: false, error: 'invalid_email_send_payload' }
  return { ok: true, value: { deliveryId: value.delivery_id, connectionId: value.connection_id } }
}

export const emailSendJobHandler: JobHandler<EmailSendJobPayload> = {
  type: 'email.send',
  validate: parsePayload,
  async execute(context: JobExecutionContext, payload) {
    const companyId = context.job.companyId
    if (!companyId) throw new IntegrationError('INVALID_DATA', 'Job de e-mail sem empresa.')
    const connection = await getCompanyIntegrationConnection(context.db, companyId, 'resend')
    if (!connection || connection.id !== payload.connectionId) throw new IntegrationError('INVALID_DATA', 'Conexão Resend não pertence à empresa do job.')
    if (!['CONNECTED','DEGRADED'].includes(connection.status)) throw new IntegrationError('NOT_CONFIGURED', 'Resend não está pronto para envio.')

    const { data: delivery, error: deliveryError } = await context.db.from('integration_email_deliveries').select('*').eq('id', payload.deliveryId).eq('company_id', companyId).eq('connection_id', connection.id).maybeSingle()
    if (deliveryError) throw deliveryError
    if (!delivery) throw new IntegrationError('INVALID_DATA', 'Entrega de e-mail não encontrada.')
    if (['sent','delivered','bounced','complained'].includes(String(delivery.status)) && delivery.provider_message_id) return { delivery_id: delivery.id, duplicate_safe: true }
    if (!isUuid(delivery.outbox_id)) throw new IntegrationError('INVALID_DATA', 'Entrega sem outbox válido.')

    const { data: outbox, error: outboxError } = await context.db.from('transactional_outbox').select('id,event_type,payload,status').eq('id', delivery.outbox_id).eq('company_id', companyId).maybeSingle()
    if (outboxError) throw outboxError
    if (!outbox || !isPlainRecord(outbox.payload)) throw new IntegrationError('INVALID_DATA', 'Outbox de e-mail não encontrado.')
    if (!isTransactionalEmailTemplate(delivery.template_key)) throw new IntegrationError('INVALID_DATA', 'Template de e-mail inválido.')
    const templateData = isPlainRecord(outbox.payload.template_data) ? outbox.payload.template_data : {}
    if (typeof outbox.payload.subject === 'string' && outbox.payload.subject.trim()) templateData.subject = outbox.payload.subject.trim()
    const brandName = typeof connection.config.brand_name === 'string' ? connection.config.brand_name : 'Orçaly'
    const rendered = renderTransactionalEmail(delivery.template_key, templateData, brandName)
    const from = typeof connection.config.from_address === 'string' ? connection.config.from_address : ''
    const replyTo = typeof connection.config.reply_to === 'string' ? connection.config.reply_to : null
    const runtime = createIntegrationRuntimeContext(context.db, { companyId, connection, requestId: context.job.id })
    const credentials = await runtime.loadCredentials()
    if (!credentials) throw new IntegrationError('NOT_CONFIGURED', 'Credenciais Resend ausentes.')

    try {
      const result = await resendEmailProvider.send({ to: String(delivery.to_email), from, replyTo, subject: rendered.subject, html: rendered.html, text: rendered.text, idempotencyKey: String(delivery.idempotency_key) }, credentials)
      const now = new Date().toISOString()
      const { error: updateError } = await context.db.from('integration_email_deliveries').update({ status: 'sent', provider_message_id: result.providerMessageId, sent_at: now, last_error: null, updated_at: now }).eq('id', delivery.id).eq('company_id', companyId)
      if (updateError) throw updateError
      const { error: outboxUpdateError } = await context.db.from('transactional_outbox').update({ status: 'processed', processed_at: now, last_error: null }).eq('id', outbox.id).eq('company_id', companyId)
      if (outboxUpdateError) throw outboxUpdateError
      await recordEmailTimeline(context.db, { companyId, deliveryId: String(delivery.id), eventType: 'email.sent', title: 'E-mail enviado', summary: rendered.subject, metadata: { provider_message_id: result.providerMessageId, template: delivery.template_key } })
      await runtime.emitAudit('email.sent', { delivery_id: delivery.id, provider_message_id: result.providerMessageId, template: delivery.template_key })
      return { delivery_id: delivery.id, provider_message_id: result.providerMessageId }
    } catch (error) {
      const normalized = normalizeIntegrationError(error)
      const status = normalized.retryable ? 'queued' : 'failed'
      await context.db.from('integration_email_deliveries').update({ status, last_error: normalized.code, updated_at: new Date().toISOString() }).eq('id', delivery.id).eq('company_id', companyId)
      throw error
    }
  },
}
