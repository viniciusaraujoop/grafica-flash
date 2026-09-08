import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function context(request: NextRequest) {
  const db = getSupabaseAdmin()
  const requester = await getRequester(request, db)
  if (!requester) return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  const access = await getCompanyAccess(db, requester.id, requester.email)
  const companyId = typeof access.company?.id === 'string' ? access.company.id : ''
  if (!isUuid(companyId)) return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  return { db, requester, access, companyId }
}

export async function GET(request: NextRequest) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error
  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 100), 1), 250)

  let query = ctx.db
    .from('customer_profiles')
    .select('id,display_name,phone_raw,phone_normalized,email_raw,email_normalized,source,source_id,last_activity_at,created_at,updated_at,archived,metadata')
    .eq('company_id', ctx.companyId)
    .eq('archived', false)
    .is('merged_into_id', null)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (q) {
    const safe = q.replace(/[,%()]/g, ' ').trim()
    if (safe) query = query.or(`display_name.ilike.%${safe}%,phone_raw.ilike.%${safe}%,email_raw.ilike.%${safe}%`)
  }

  const [{ data, error }, { data: duplicates, error: duplicateError }] = await Promise.all([
    query,
    ctx.db.from('customer_duplicate_candidates').select('left_customer_id,right_customer_id,status,confidence').eq('company_id', ctx.companyId).eq('status', 'needs_review'),
  ])

  if (error || duplicateError) return NextResponse.json({ error: 'Não foi possível carregar o diretório de clientes.' }, { status: 500 })

  const duplicateCounts = new Map<string, number>()
  for (const row of duplicates || []) {
    duplicateCounts.set(row.left_customer_id, (duplicateCounts.get(row.left_customer_id) || 0) + 1)
    duplicateCounts.set(row.right_customer_id, (duplicateCounts.get(row.right_customer_id) || 0) + 1)
  }

  return NextResponse.json({
    customers: (data || []).map((row) => ({ ...row, duplicateSignals: duplicateCounts.get(row.id) || 0 })),
    duplicateCandidates: (duplicates || []).length,
  })
}

export async function POST(request: NextRequest) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || '').trim().toLowerCase()

  if (action === 'refresh') {
    const { data, error } = await ctx.db.rpc('refresh_customer_directory', { p_company_id: ctx.companyId })
    if (error) return NextResponse.json({ error: 'Não foi possível atualizar o diretório.' }, { status: 500 })
    return NextResponse.json({ ok: true, result: data })
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
