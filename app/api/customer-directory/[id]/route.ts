import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

async function context(request: NextRequest) {
  const db = getSupabaseAdmin()
  const requester = await getRequester(request, db)
  if (!requester) return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  const access = await getCompanyAccess(db, requester.id, requester.email)
  const companyId = typeof access.company?.id === 'string' ? access.company.id : ''
  if (!isUuid(companyId)) return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  return { db, requester, access, companyId }
}

function money(row: Record<string, unknown>) {
  const value = Number(row.total_amount ?? row.total ?? row.valor_total ?? row.preco_estimado ?? 0)
  return Number.isFinite(value) ? value : 0
}

function customerHealth(orders: Array<Record<string, unknown>>, followups: Array<Record<string, unknown>>, issues: number, lastActivity?: string | null) {
  const now = Date.now()
  const recencyDays = lastActivity ? Math.max(0, Math.floor((now - new Date(lastActivity).getTime()) / 86_400_000)) : 9999
  const frequency = orders.length
  const monetary = orders.reduce((sum, order) => sum + money(order), 0)
  const overdue = followups.filter((row) => row.status !== 'concluido' && row.due_at && new Date(String(row.due_at)).getTime() < now).length
  let score = 100
  if (recencyDays > 90) score -= 35
  else if (recencyDays > 60) score -= 25
  else if (recencyDays > 30) score -= 12
  if (frequency === 0) score -= 20
  else if (frequency >= 3) score += 5
  if (monetary <= 0) score -= 5
  if (overdue > 0) score -= Math.min(25, overdue * 8)
  score -= Math.min(20, issues * 4)
  score = Math.max(0, Math.min(100, score))
  const reasons = [
    `${recencyDays === 9999 ? 'Sem atividade registrada' : `Última atividade há ${recencyDays} dia(s)`}`,
    `${frequency} pedido(s) · valor histórico ${monetary.toFixed(2)}`,
    overdue ? `${overdue} follow-up(s) atrasado(s)` : 'Sem follow-up atrasado',
    issues ? `${issues} sinal(is) de qualidade/duplicidade` : 'Sem sinal de qualidade aberto ligado ao perfil',
  ]
  return { score, reasons, metrics: { recencyDays, frequency, monetary, overdue, issues } }
}

export async function GET(request: NextRequest, route: RouteContext) {
  const ctx = await context(request)
  if ('error' in ctx) return ctx.error
  const { id } = await route.params
  if (!isUuid(id)) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 })

  const { data: customer, error: customerError } = await ctx.db
    .from('customer_profiles')
    .select('*')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .is('merged_into_id', null)
    .maybeSingle()

  if (customerError) return NextResponse.json({ error: 'Não foi possível carregar o cliente.' }, { status: 500 })
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const [orders, proposals, leads, notes, followups, finance, timeline, duplicates, quality] = await Promise.all([
    ctx.db.from('orders').select('id,nome,produto,status,total,total_amount,valor_total,preco_estimado,payment_status,created_at,updated_at').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('created_at', { ascending: false }).limit(100),
    ctx.db.from('proposals').select('id,titulo,status,valor_total,valor_sinal,created_at,updated_at,valid_until').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('created_at', { ascending: false }).limit(100),
    ctx.db.from('crm_leads').select('id,nome,etapa,status,valor_estimado,proximo_contato_em,tags,created_at,updated_at').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('updated_at', { ascending: false }).limit(100),
    ctx.db.from('customer_notes').select('id,tipo,conteudo,created_at,created_by').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('created_at', { ascending: false }).limit(100),
    ctx.db.from('customer_followups').select('id,titulo,descricao,status,prioridade,due_at,completed_at,created_at').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('created_at', { ascending: false }).limit(100),
    ctx.db.from('financial_transactions').select('id,tipo,type,descricao,description,valor,amount,status,due_date,vencimento,paid_at,created_at').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('created_at', { ascending: false }).limit(100),
    ctx.db.from('timeline_events').select('id,event_type,source,aggregate_type,aggregate_id,actor_user_id,payload,occurred_at').eq('company_id', ctx.companyId).eq('customer_profile_id', id).order('occurred_at', { ascending: false }).limit(100),
    ctx.db.from('customer_duplicate_candidates').select('id,left_customer_id,right_customer_id,reasons,confidence,status,created_at').eq('company_id', ctx.companyId).or(`left_customer_id.eq.${id},right_customer_id.eq.${id}`).order('confidence', { ascending: false }).limit(100),
    ctx.db.from('data_quality_issues').select('id,rule_key,severity,title,status,last_seen_at').eq('company_id', ctx.companyId).eq('entity_type', 'customer').eq('entity_id', id).eq('status', 'open').limit(100),
  ])

  const firstError = [orders, proposals, leads, notes, followups, finance, timeline, duplicates, quality].find((result) => result.error)?.error
  if (firstError) return NextResponse.json({ error: 'Não foi possível montar o Customer 360.' }, { status: 500 })

  const duplicateRows = duplicates.data || []
  const counterpartIds = Array.from(new Set(duplicateRows.map((row) => row.left_customer_id === id ? row.right_customer_id : row.left_customer_id)))
  const counterpartResult = counterpartIds.length
    ? await ctx.db.from('customer_profiles').select('id,display_name,phone_normalized,email_normalized').eq('company_id', ctx.companyId).in('id', counterpartIds)
    : { data: [], error: null }
  if (counterpartResult.error) return NextResponse.json({ error: 'Não foi possível carregar sinais de duplicidade.' }, { status: 500 })
  const counterpartMap = new Map((counterpartResult.data || []).map((row) => [row.id, row]))

  const health = customerHealth(orders.data || [], followups.data || [], (quality.data || []).length + duplicateRows.length, customer.last_activity_at)

  return NextResponse.json({
    customer,
    health,
    tags: Array.from(new Set((leads.data || []).flatMap((lead) => Array.isArray(lead.tags) ? lead.tags : []))),
    orders: orders.data || [],
    proposals: proposals.data || [],
    crm: leads.data || [],
    notes: notes.data || [],
    followups: followups.data || [],
    finance: ctx.access.canFinance ? (finance.data || []) : [],
    timeline: timeline.data || [],
    quality: quality.data || [],
    duplicates: duplicateRows.map((row) => ({
      ...row,
      counterpart: counterpartMap.get(row.left_customer_id === id ? row.right_customer_id : row.left_customer_id) || null,
    })),
  })
}
