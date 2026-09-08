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
  if (!access.canManage) return { error: NextResponse.json({ error: 'Sem permissão para revisar duplicidades.' }, { status: 403 }) }
  return { db, requester, access, companyId }
}

export async function GET(request: NextRequest) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error

  const { data: candidates, error } = await ctx.db
    .from('customer_duplicate_candidates')
    .select('id,left_customer_id,right_customer_id,reasons,confidence,status,created_at')
    .eq('company_id', ctx.companyId)
    .eq('status', 'needs_review')
    .order('confidence', { ascending: false })
    .limit(150)

  if (error) return NextResponse.json({ error: 'Não foi possível carregar duplicidades.' }, { status: 500 })
  const ids = Array.from(new Set((candidates || []).flatMap((row) => [row.left_customer_id, row.right_customer_id])))
  const customers = ids.length
    ? await ctx.db.from('customer_profiles').select('id,display_name,phone_raw,phone_normalized,email_raw,email_normalized,last_activity_at').eq('company_id', ctx.companyId).in('id', ids)
    : { data: [], error: null }
  if (customers.error) return NextResponse.json({ error: 'Não foi possível carregar os clientes candidatos.' }, { status: 500 })
  const customerMap = new Map((customers.data || []).map((row) => [row.id, row]))

  return NextResponse.json({ candidates: (candidates || []).map((row) => ({ ...row, left: customerMap.get(row.left_customer_id), right: customerMap.get(row.right_customer_id) })) })
}

export async function POST(request: NextRequest) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || '').trim().toLowerCase()
  const candidateId = String(body.candidateId || '')
  if (!isUuid(candidateId)) return NextResponse.json({ error: 'Candidato inválido.' }, { status: 400 })

  const { data: candidate, error } = await ctx.db
    .from('customer_duplicate_candidates')
    .select('id,left_customer_id,right_customer_id,status')
    .eq('id', candidateId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Não foi possível validar o candidato.' }, { status: 500 })
  if (!candidate) return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 })
  if (candidate.status !== 'needs_review') return NextResponse.json({ error: 'Este candidato já foi revisado.' }, { status: 409 })

  if (action === 'dismiss') {
    const { error: updateError } = await ctx.db.from('customer_duplicate_candidates').update({ status: 'dismissed', reviewed_by: ctx.requester.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidateId).eq('company_id', ctx.companyId)
    if (updateError) return NextResponse.json({ error: 'Não foi possível marcar como não duplicado.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'merge') {
    const keepId = String(body.keepId || '')
    const mergeId = String(body.mergeId || '')
    const validPair = [candidate.left_customer_id, candidate.right_customer_id]
    if (!isUuid(keepId) || !isUuid(mergeId) || keepId === mergeId || !validPair.includes(keepId) || !validPair.includes(mergeId)) {
      return NextResponse.json({ error: 'Par de merge inválido.' }, { status: 400 })
    }
    const { data, error: mergeError } = await ctx.db.rpc('merge_customer_profiles', { p_company_id: ctx.companyId, p_keep_id: keepId, p_merge_id: mergeId, p_actor_id: ctx.requester.id })
    if (mergeError) {
      const safe = mergeError.message.includes('SAME_COMPANY_REQUIRED') ? 'Merge entre empresas diferentes é proibido.' : 'Não foi possível concluir o merge.'
      return NextResponse.json({ error: safe }, { status: 409 })
    }
    return NextResponse.json({ ok: true, result: data })
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
