import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, isUuid } from '@/lib/company-access'
import { loadIntegrationCredentials } from '@/lib/integrations/core/credentials'
import { mapResendEventStatus, verifySvixWebhook } from '@/lib/integrations/email/core'
import { recordEmailTimeline } from '@/lib/integrations/email/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params
  if (!isUuid(connectionId)) return NextResponse.json({ ok: false }, { status: 404 })
  const db = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await db.from('integration_connections').select('id,company_id,status').eq('id', connectionId).eq('provider', 'resend').maybeSingle()
  if (connectionError) return NextResponse.json({ ok: false }, { status: 500 })
  if (!connection) return NextResponse.json({ ok: false }, { status: 404 })
  const rawBody = await request.text()
  if (rawBody.length > 1_000_000) return NextResponse.json({ ok: false }, { status: 413 })
  const credentials = await loadIntegrationCredentials(db, String(connection.company_id), connectionId)
  const webhookSecret = typeof credentials?.webhook_secret === 'string' ? credentials.webhook_secret : ''
  if (!webhookSecret) return NextResponse.json({ ok: false }, { status: 503 })
  const svixId = request.headers.get('svix-id')
  const valid = verifySvixWebhook({ rawBody, id: svixId, timestamp: request.headers.get('svix-timestamp'), signature: request.headers.get('svix-signature'), secret: webhookSecret })
  if (!valid) return NextResponse.json({ ok: false }, { status: 401 })
  let payload: unknown
  try { payload = JSON.parse(rawBody) } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ ok: false }, { status: 400 })
  const row = payload as Record<string, unknown>
  const eventType = typeof row.type === 'string' ? row.type : ''
  const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data as Record<string, unknown> : {}
  const providerMessageId = typeof data.email_id === 'string' ? data.email_id : typeof data.id === 'string' ? data.id : ''
  const status = mapResendEventStatus(eventType)
  if (!svixId || !providerMessageId || !status) return NextResponse.json({ ok: true, ignored: true })
  const eventId = `${connectionId}:${svixId}`
  const { error: idemError } = await db.from('event_idempotency').insert({ provider: 'resend', event_id: eventId, company_id: connection.company_id, event_type: eventType, payload_hash: createHash('sha256').update(rawBody).digest('hex'), status: 'received' })
  if (idemError?.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
  if (idemError) return NextResponse.json({ ok: false }, { status: 500 })
  const { data: delivery, error: deliveryError } = await db.from('integration_email_deliveries').select('id,status,template_key').eq('company_id', connection.company_id).eq('connection_id', connectionId).eq('provider_message_id', providerMessageId).maybeSingle()
  if (deliveryError) return NextResponse.json({ ok: false }, { status: 500 })
  if (!delivery) {
    await db.from('event_idempotency').update({ status: 'processed', processed_at: new Date().toISOString(), metadata: { unmatched_provider_message_id: true } }).eq('provider', 'resend').eq('event_id', eventId)
    return NextResponse.json({ ok: true, unmatched: true })
  }
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status, updated_at: now }
  if (status === 'delivered') patch.delivered_at = now
  if (status === 'bounced') patch.bounced_at = now
  if (status === 'failed' || status === 'complained') patch.failed_at = now
  const { error: updateError } = await db.from('integration_email_deliveries').update(patch).eq('id', delivery.id).eq('company_id', connection.company_id)
  if (updateError) return NextResponse.json({ ok: false }, { status: 500 })
  if (['sent','delivered','bounced','failed','complained'].includes(status)) {
    await recordEmailTimeline(db, { companyId: String(connection.company_id), deliveryId: String(delivery.id), eventType: `email.${status}`, title: status === 'delivered' ? 'E-mail entregue' : status === 'bounced' ? 'E-mail devolvido' : status === 'complained' ? 'E-mail marcado como spam' : status === 'failed' ? 'Falha no e-mail' : 'E-mail enviado', metadata: { provider_message_id: providerMessageId, template: delivery.template_key } })
  }
  await db.from('event_idempotency').update({ status: 'processed', processed_at: now }).eq('provider', 'resend').eq('event_id', eventId)
  return NextResponse.json({ ok: true })
}
