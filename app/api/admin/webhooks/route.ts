import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: string) { return value.trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 100) }

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'webhooks.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const status = clean(request.nextUrl.searchParams.get('status') || '')
  const provider = clean(request.nextUrl.searchParams.get('provider') || '')
  const eventId = clean(request.nextUrl.searchParams.get('event') || '')
  let query = session.supabaseAdmin.from('payment_webhook_events').select('id,provider,provider_event_id,event_type,provider_object_id,company_id,payload_hash,payload_sanitized,processing_status,attempts,received_at,processed_at,error_message').order('received_at', { ascending: false }).limit(eventId ? 1 : 100)
  if (status) query = query.eq('processing_status', status)
  if (provider) query = query.eq('provider', provider)
  if (eventId) query = query.eq('id', eventId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data || [], retrySupported: false, retryBlockedReason: 'O handler atual de assinatura pode estender acesso novamente em replay. Retry administrativo permanece bloqueado até o processamento ser extraído para uma operação comprovadamente idempotente.' })
}
