import { NextRequest, NextResponse } from 'next/server'
import { isMissingRelation } from '@/lib/admin/optional-schema'
import { auditPlatformAction, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validKey(value: string) { return /^[a-z0-9][a-z0-9._-]{1,79}$/.test(value) }
function scopeValue(scope: string, value: unknown) { return scope === 'global' ? '*' : String(value || '').trim().slice(0, 120) }

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'features.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const { data, error } = await session.supabaseAdmin.from('platform_feature_flags').select('id,key,description,enabled,scope,scope_value,config,created_by,updated_by,created_at,updated_at').order('key').order('scope')
  if (error) {
    if (isMissingRelation(error, 'platform_feature_flags')) return NextResponse.json({ schemaReady: false, rows: [], migration: '20260819230000_admin_control_center_v2.sql' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ schemaReady: true, rows: data || [] })
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'features.manage')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const key = String(body.key || '').trim().toLowerCase()
  const scope = String(body.scope || 'global').trim().toLowerCase()
  const value = scopeValue(scope, body.scopeValue)
  const reason = String(body.reason || '').trim()
  if (!validKey(key)) return NextResponse.json({ error: 'Chave de flag inválida.' }, { status: 400 })
  if (!['global','plan','segment','company'].includes(scope)) return NextResponse.json({ error: 'Escopo inválido.' }, { status: 400 })
  if (scope !== 'global' && !value) return NextResponse.json({ error: 'Informe o valor do escopo.' }, { status: 400 })
  if (reason.length < 8) return NextResponse.json({ error: 'Informe um motivo com pelo menos 8 caracteres.' }, { status: 400 })
  const row = { key, description: String(body.description || '').trim().slice(0, 300) || null, enabled: body.enabled === true, scope, scope_value: value, config: body.config && typeof body.config === 'object' ? body.config : {}, created_by: session.admin.email, updated_by: session.admin.email, updated_at: new Date().toISOString() }
  const { data, error } = await session.supabaseAdmin.from('platform_feature_flags').insert(row).select('id,key,description,enabled,scope,scope_value,config,created_at,updated_at').single()
  if (error) {
    if (isMissingRelation(error, 'platform_feature_flags')) return NextResponse.json({ error: 'Migration do Control Center ainda não aplicada.', schemaReady: false }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 })
  }
  await auditPlatformAction(session.admin.email, 'feature_flag_created', { targetType: 'feature_flag', targetId: String(data.id), targetLabel: key, payload: { reason, scope, scope_value: value, enabled: row.enabled } })
  return NextResponse.json({ ok: true, row: data })
}

export async function PATCH(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'features.manage')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id || '')
  const reason = String(body.reason || '').trim()
  if (!id || reason.length < 8) return NextResponse.json({ error: 'ID e motivo são obrigatórios.' }, { status: 400 })
  const { data: before, error: readError } = await session.supabaseAdmin.from('platform_feature_flags').select('id,key,description,enabled,scope,scope_value,config').eq('id', id).maybeSingle()
  if (readError) {
    if (isMissingRelation(readError, 'platform_feature_flags')) return NextResponse.json({ error: 'Migration do Control Center ainda não aplicada.', schemaReady: false }, { status: 503 })
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }
  if (!before) return NextResponse.json({ error: 'Flag não encontrada.' }, { status: 404 })
  const patch: Record<string, unknown> = { updated_by: session.admin.email, updated_at: new Date().toISOString() }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 300)
  if (body.config && typeof body.config === 'object') patch.config = body.config
  const { data, error } = await session.supabaseAdmin.from('platform_feature_flags').update(patch).eq('id', id).select('id,key,description,enabled,scope,scope_value,config,updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await auditPlatformAction(session.admin.email, 'feature_flag_updated', { targetType: 'feature_flag', targetId: id, targetLabel: String(before.key), payload: { reason, before, after: data } })
  return NextResponse.json({ ok: true, row: data })
}
