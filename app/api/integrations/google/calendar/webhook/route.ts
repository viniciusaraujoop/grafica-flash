import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { enqueueIntegrationSync } from '@/lib/integrations/core/sync'
import { secureCalendarChannelTokenMatches } from '@/lib/integrations/google/calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const channelId = String(request.headers.get('x-goog-channel-id') || '').trim()
  const resourceId = String(request.headers.get('x-goog-resource-id') || '').trim()
  const resourceState = String(request.headers.get('x-goog-resource-state') || '').trim()
  const messageNumber = String(request.headers.get('x-goog-message-number') || '').trim()
  const channelToken = request.headers.get('x-goog-channel-token')
  if (!channelId || !resourceId || !messageNumber) return NextResponse.json({ ok: false }, { status: 400 })

  const db = getSupabaseAdmin()
  const { data: channel, error } = await db.from('integration_push_channels')
    .select('company_id,connection_id,resource_id,token_hash,state,expires_at')
    .eq('provider', 'google_calendar')
    .eq('channel_id', channelId)
    .eq('state', 'active')
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false }, { status: 500 })
  if (!channel || String(channel.resource_id) !== resourceId) return NextResponse.json({ ok: false }, { status: 404 })
  if (!secureCalendarChannelTokenMatches(channelToken, String(channel.token_hash || ''))) return NextResponse.json({ ok: false }, { status: 401 })
  if (channel.expires_at && Date.parse(String(channel.expires_at)) <= Date.now()) return NextResponse.json({ ok: false }, { status: 410 })

  const eventId = `${channelId}:${messageNumber}`
  const { error: idemError } = await db.from('event_idempotency').insert({
    provider: 'google_calendar',
    event_id: eventId,
    company_id: channel.company_id,
    event_type: `calendar.${resourceState || 'changed'}`,
    status: 'received',
    metadata: { resource_id: resourceId },
  })
  if (idemError?.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
  if (idemError) return NextResponse.json({ ok: false }, { status: 500 })

  const { data: connection, error: connectionError } = await db.from('integration_connections')
    .select('id,status')
    .eq('id', channel.connection_id)
    .eq('company_id', channel.company_id)
    .eq('provider', 'google_calendar')
    .maybeSingle()
  if (connectionError || !connection || !['CONNECTED','DEGRADED'].includes(String(connection.status))) {
    await db.from('event_idempotency').update({ status: 'failed', last_error: 'connection_unavailable' }).eq('provider', 'google_calendar').eq('event_id', eventId)
    return NextResponse.json({ ok: false }, { status: 409 })
  }

  const queued = await enqueueIntegrationSync(db, {
    companyId: String(channel.company_id),
    connectionId: String(connection.id),
    provider: 'google_calendar',
    requestedBy: null,
    request: { mode: 'incremental', metadata: { source: 'google_watch', resource_state: resourceState } },
  })
  await db.from('event_idempotency').update({ status: 'processed', processed_at: new Date().toISOString(), metadata: { resource_id: resourceId, job_id: queued.job?.id || null } }).eq('provider', 'google_calendar').eq('event_id', eventId)
  return NextResponse.json({ ok: true, queued: queued.queued })
}
