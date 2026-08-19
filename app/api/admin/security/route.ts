import { NextRequest, NextResponse } from 'next/server'
import { auditPlatformAction, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'security.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const [events, blocklist] = await Promise.all([
    session.supabaseAdmin.from('security_events').select('id,company_id,event_type,severity,source,path,method,ip,user_agent,user_email,description,resolved,resolved_at,resolved_by,metadata,created_at').order('created_at', { ascending: false }).limit(200),
    session.supabaseAdmin.from('security_blocklist').select('id,type,value,reason,created_at').order('created_at', { ascending: false }).limit(200),
  ])
  if (events.error) return NextResponse.json({ error: events.error.message }, { status: 500 })
  return NextResponse.json({ events: events.data || [], blocklist: blocklist.error ? [] : blocklist.data || [] })
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'security.manage')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id || '')
  const action = String(body.action || '')
  const reason = String(body.reason || '').trim()
  if (action !== 'resolve' || !id || reason.length < 8) return NextResponse.json({ error: 'Evento e motivo com pelo menos 8 caracteres são obrigatórios.' }, { status: 400 })
  const { data: before } = await session.supabaseAdmin.from('security_events').select('id,event_type,severity,description,resolved').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (before.resolved) return NextResponse.json({ ok: true, idempotentReplay: true })
  const now = new Date().toISOString()
  const { error } = await session.supabaseAdmin.from('security_events').update({ resolved: true, resolved_at: now, resolved_by: session.admin.email }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await auditPlatformAction(session.admin.email, 'security_event_resolved', { targetType: 'security_event', targetId: id, targetLabel: String(before.event_type || id), payload: { reason, severity: before.severity } })
  return NextResponse.json({ ok: true })
}
