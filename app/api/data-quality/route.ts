import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
const severities = new Set<Severity>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])
const statuses = new Set(['open', 'resolved', 'ignored'])

async function context(request: NextRequest) {
  const db = getSupabaseAdmin()
  const requester = await getRequester(request, db)
  if (!requester) return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  const access = await getCompanyAccess(db, requester.id, requester.email)
  const companyId = typeof access.company?.id === 'string' ? access.company.id : ''
  if (!isUuid(companyId)) return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  return { db, requester, access, companyId }
}

function scoreFrom(rows: Array<{ severity?: string | null }>) {
  let score = 100
  for (const row of rows) {
    if (row.severity === 'CRITICAL') score -= 25
    else if (row.severity === 'HIGH') score -= 10
    else if (row.severity === 'MEDIUM') score -= 4
    else if (row.severity === 'LOW') score -= 1
  }
  return Math.max(0, score)
}

export async function GET(request: NextRequest) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error

  const params = request.nextUrl.searchParams
  const severity = params.get('severity')?.toUpperCase() as Severity | undefined
  const status = params.get('status') || 'open'
  const entity = params.get('entity')?.trim() || ''
  const limit = Math.min(Math.max(Number(params.get('limit') || 100), 1), 250)

  let query = ctx.db
    .from('data_quality_issues')
    .select('id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,metadata,first_seen_at,last_seen_at,resolved_at')
    .eq('company_id', ctx.companyId)
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (severity && severities.has(severity)) query = query.eq('severity', severity)
  if (statuses.has(status)) query = query.eq('status', status)
  if (entity) query = query.eq('entity_type', entity)

  const [{ data, error }, { data: openRows, error: openError }] = await Promise.all([
    query,
    ctx.db.from('data_quality_issues').select('severity,entity_type').eq('company_id', ctx.companyId).eq('status', 'open'),
  ])

  if (error || openError) {
    return NextResponse.json({ error: 'Não foi possível carregar a qualidade dos dados.' }, { status: 500 })
  }

  const open = openRows || []
  const counts = {
    critical: open.filter((row) => row.severity === 'CRITICAL').length,
    high: open.filter((row) => row.severity === 'HIGH').length,
    medium: open.filter((row) => row.severity === 'MEDIUM').length,
    low: open.filter((row) => row.severity === 'LOW').length,
    info: open.filter((row) => row.severity === 'INFO').length,
  }

  return NextResponse.json({
    score: scoreFrom(open),
    open: open.length,
    counts,
    issues: data || [],
  })
}

export async function POST(request: NextRequest) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || '').trim().toLowerCase()

  if (action === 'scan') {
    const { data, error } = await ctx.db.rpc('refresh_company_data_quality', { p_company_id: ctx.companyId })
    if (error) return NextResponse.json({ error: 'O scan de qualidade falhou.' }, { status: 500 })
    return NextResponse.json({ ok: true, result: data })
  }

  if (!ctx.access.canManage) {
    return NextResponse.json({ error: 'Você não tem permissão para revisar qualidade dos dados.' }, { status: 403 })
  }

  const issueId = String(body.issueId || '')
  if (!isUuid(issueId)) return NextResponse.json({ error: 'Issue inválida.' }, { status: 400 })

  const { data: issue, error: issueError } = await ctx.db
    .from('data_quality_issues')
    .select('id,status,auto_fixable,metadata')
    .eq('id', issueId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (issueError) return NextResponse.json({ error: 'Não foi possível validar a issue.' }, { status: 500 })
  if (!issue) return NextResponse.json({ error: 'Issue não encontrada.' }, { status: 404 })

  if (action === 'resolve') {
    const { error } = await ctx.db.from('data_quality_issues').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', issueId).eq('company_id', ctx.companyId)
    if (error) return NextResponse.json({ error: 'Não foi possível resolver a issue.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'ignore') {
    const reason = String(body.reason || '').trim()
    if (reason.length < 3) return NextResponse.json({ error: 'Informe o motivo para ignorar.' }, { status: 422 })
    const metadata = { ...((issue.metadata as Record<string, unknown> | null) || {}), ignored_reason: reason, ignored_by: ctx.requester.id, ignored_at: new Date().toISOString() }
    const { error } = await ctx.db.from('data_quality_issues').update({ status: 'ignored', resolved_at: null, metadata }).eq('id', issueId).eq('company_id', ctx.companyId)
    if (error) return NextResponse.json({ error: 'Não foi possível ignorar a issue.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'fix') {
    if (!issue.auto_fixable) return NextResponse.json({ error: 'Esta correção exige revisão humana.' }, { status: 409 })
    return NextResponse.json({ error: 'Nenhum auto-fix destrutivo está habilitado para esta regra.' }, { status: 409 })
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
