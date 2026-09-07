import { NextRequest, NextResponse } from 'next/server'
import { isMissingRelation } from '@/lib/admin/optional-schema'
import { auditPlatformAction, canPlatform, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const statuses = new Set(['new','in_progress','waiting_customer','resolved','closed'])
const priorities = new Set(['low','medium','high','urgent'])

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'support.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const status = String(request.nextUrl.searchParams.get('status') || 'open')
  const priority = String(request.nextUrl.searchParams.get('priority') || '')
  let query = session.supabaseAdmin.from('platform_support_tickets').select('id,company_id,user_id,subject,category,priority,status,assignee_admin_id,created_by,first_response_at,resolved_at,closed_at,created_at,updated_at,companies(nome,email,assinatura_plano,assinatura_status)').order('updated_at', { ascending: false }).limit(100)
  if (status === 'open') query = query.in('status', ['new','in_progress','waiting_customer'])
  else if (statuses.has(status)) query = query.eq('status', status)
  if (priorities.has(priority)) query = query.eq('priority', priority)
  const { data, error } = await query
  if (error) {
    if (isMissingRelation(error, 'platform_support_tickets')) return NextResponse.json({ schemaReady: false, rows: [], migration: '20260819230000_admin_control_center_v2.sql' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ schemaReady: true, rows: data || [], canWrite: canPlatform(session.admin, 'support.write') })
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'support.write')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const subject = String(body.subject || '').trim().slice(0, 180)
  const description = String(body.description || '').trim().slice(0, 5000)
  const priority = String(body.priority || 'medium')
  if (subject.length < 4 || description.length < 8 || !priorities.has(priority)) return NextResponse.json({ error: 'Assunto, descrição e prioridade válidos são obrigatórios.' }, { status: 400 })
  const row = { company_id: body.companyId || null, user_id: body.userId || null, subject, category: String(body.category || 'geral').trim().slice(0, 80), priority, description, status: 'new', created_by: session.admin.email, assignee_admin_id: session.admin.id, updated_at: new Date().toISOString() }
  const { data, error } = await session.supabaseAdmin.from('platform_support_tickets').insert(row).select('id,company_id,subject,category,priority,status,created_at,updated_at').single()
  if (error) {
    if (isMissingRelation(error, 'platform_support_tickets')) return NextResponse.json({ error: 'Migration do Control Center ainda não aplicada.', schemaReady: false }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await session.supabaseAdmin.from('platform_support_ticket_events').insert({ ticket_id: data.id, admin_id: session.admin.id, event_type: 'created', message: description.slice(0, 1000), to_status: 'new' })
  await auditPlatformAction(session.admin.email, 'support_ticket_created', { targetType: 'support_ticket', targetId: String(data.id), targetLabel: subject, payload: { company_id: body.companyId || null, priority } })
  return NextResponse.json({ ok: true, row: data })
}

export async function PATCH(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'support.write')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id || '')
  const status = String(body.status || '')
  const reason = String(body.reason || '').trim()
  if (!id || !statuses.has(status) || reason.length < 3) return NextResponse.json({ error: 'Ticket, status e nota são obrigatórios.' }, { status: 400 })
  const { data: before, error: readError } = await session.supabaseAdmin.from('platform_support_tickets').select('id,subject,status,first_response_at').eq('id', id).maybeSingle()
  if (readError) {
    if (isMissingRelation(readError, 'platform_support_tickets')) return NextResponse.json({ error: 'Migration do Control Center ainda não aplicada.', schemaReady: false }, { status: 503 })
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }
  if (!before) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status, updated_at: now, assignee_admin_id: session.admin.id }
  if (!before.first_response_at && status !== 'new') patch.first_response_at = now
  if (status === 'resolved') patch.resolved_at = now
  if (status === 'closed') patch.closed_at = now
  const { data, error } = await session.supabaseAdmin.from('platform_support_tickets').update(patch).eq('id', id).select('id,subject,status,priority,updated_at,first_response_at,resolved_at,closed_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await session.supabaseAdmin.from('platform_support_ticket_events').insert({ ticket_id: id, admin_id: session.admin.id, event_type: 'status_changed', message: reason.slice(0, 1000), from_status: before.status, to_status: status })
  await auditPlatformAction(session.admin.email, 'support_ticket_status_changed', { targetType: 'support_ticket', targetId: id, targetLabel: String(before.subject), payload: { reason, from: before.status, to: status } })
  return NextResponse.json({ ok: true, row: data })
}
