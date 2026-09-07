import { NextRequest, NextResponse } from 'next/server'
import { auditPlatformAction, canPlatform, requirePlatformAdmin } from '@/lib/platform-admin'

type RouteContext = { params: Promise<{ id: string }> }
type JsonRecord = Record<string, unknown>

function days(value: unknown, max = 30) {
  const parsed = Math.trunc(Number(value || 0))
  return Number.isFinite(parsed) ? Math.max(1, Math.min(max, parsed)) : 1
}

function date(value: unknown) {
  const parsed = value ? new Date(String(value)) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
}

function addDays(base: Date, amount: number) {
  const result = new Date(base)
  result.setUTCDate(result.getUTCDate() + amount)
  return result
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requirePlatformAdmin(request, 'companies.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as JsonRecord
  const action = String(body.action || '').trim().toLowerCase()
  const reason = String(body.reason || '').trim()
  const idempotencyKey = String(request.headers.get('idempotency-key') || body.idempotencyKey || '').trim().slice(0, 120)
  if (reason.length < 8) return NextResponse.json({ error: 'Informe um motivo com pelo menos 8 caracteres.' }, { status: 400 })

  const blockActions = new Set(['block', 'unblock'])
  const billingActions = new Set(['extend_trial', 'courtesy'])
  if (blockActions.has(action) && !canPlatform(session.admin, 'companies.block')) return NextResponse.json({ error: 'Sem permissão para bloquear/desbloquear empresas.' }, { status: 403 })
  if (billingActions.has(action) && !canPlatform(session.admin, 'billing.manage')) return NextResponse.json({ error: 'Sem permissão para alterações manuais de billing.' }, { status: 403 })
  if (!blockActions.has(action) && !billingActions.has(action)) return NextResponse.json({ error: 'Ação administrativa não suportada com segurança.' }, { status: 400 })
  if (billingActions.has(action) && !idempotencyKey) return NextResponse.json({ error: 'Idempotency-Key é obrigatório para esta ação.' }, { status: 400 })

  if (idempotencyKey) {
    const prior = await session.supabaseAdmin.from('admin_audit_logs').select('id,created_at').eq('action', `company_${action}`).eq('target_id', id).contains('payload', { idempotency_key: idempotencyKey }).limit(1).maybeSingle()
    if (!prior.error && prior.data) return NextResponse.json({ ok: true, action, idempotentReplay: true, auditId: prior.data.id })
  }

  const { data: company, error: companyError } = await session.supabaseAdmin.from('companies').select('id,nome,ativo,assinatura_status,trial_ends_at,access_until,assinatura_expira_em,assinatura_plano,plano').eq('id', id).maybeSingle()
  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 })
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  const now = new Date()
  const before = { ativo: company.ativo, assinatura_status: company.assinatura_status, trial_ends_at: company.trial_ends_at, access_until: company.access_until, assinatura_expira_em: company.assinatura_expira_em }
  let patch: JsonRecord = {}
  let subscriptionEvent: JsonRecord | null = null

  if (action === 'block') patch = { ativo: false, updated_at: now.toISOString() }
  if (action === 'unblock') patch = { ativo: true, updated_at: now.toISOString() }
  if (action === 'extend_trial') {
    const currentStatus = String(company.assinatura_status || '').toLowerCase()
    if (['ativa', 'active', 'paid', 'authorized'].includes(currentStatus)) return NextResponse.json({ error: 'Empresa paga não pode receber extensão de trial.' }, { status: 409 })
    const amount = days(body.days, 30)
    const currentEnd = date(company.trial_ends_at)
    const base = currentEnd && currentEnd > now ? currentEnd : now
    const end = addDays(base, amount)
    patch = { ativo: true, assinatura_status: 'trialing', trial_ends_at: end.toISOString(), access_until: end.toISOString(), updated_at: now.toISOString() }
    subscriptionEvent = { company_id: id, event_type: 'admin_trial_extended', old_status: company.assinatura_status || null, new_status: 'trialing', provider: 'admin_manual', provider_reference: `admin:${idempotencyKey}`, metadata: { days: amount, reason, admin_email: session.admin.email }, created_at: now.toISOString() }
  }
  if (action === 'courtesy') {
    const amount = days(body.days, 30)
    const currentAccess = date(company.access_until || company.assinatura_expira_em)
    const base = currentAccess && currentAccess > now ? currentAccess : now
    const end = addDays(base, amount)
    patch = { ativo: true, access_until: end.toISOString(), assinatura_expira_em: end.toISOString(), updated_at: now.toISOString() }
    subscriptionEvent = { company_id: id, event_type: 'admin_courtesy_added', old_status: company.assinatura_status || null, new_status: company.assinatura_status || null, provider: 'admin_manual', provider_reference: `admin:${idempotencyKey}`, metadata: { days: amount, reason, admin_email: session.admin.email }, created_at: now.toISOString() }
  }

  const { data: updated, error } = await session.supabaseAdmin.from('companies').update(patch).eq('id', id).select('id,nome,ativo,assinatura_status,trial_ends_at,access_until,assinatura_expira_em').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (subscriptionEvent) {
    const eventResult = await session.supabaseAdmin.from('subscription_events').insert(subscriptionEvent)
    if (eventResult.error) return NextResponse.json({ error: `Empresa alterada, mas o evento de assinatura não pôde ser registrado: ${eventResult.error.message}` }, { status: 500 })
  }

  await auditPlatformAction(session.admin.email, `company_${action}`, {
    targetType: 'company', targetId: id, targetLabel: String(company.nome || id),
    payload: { reason, idempotency_key: idempotencyKey || null, before, after: updated },
  })
  return NextResponse.json({ ok: true, action, company: updated })
}
