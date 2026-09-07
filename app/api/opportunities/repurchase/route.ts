import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'
import { buildRepurchaseOpportunities, normalizeRepurchasePhone } from '@/lib/repurchase-opportunities'

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)
  if (!requester) return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
  if (!access.company?.id) return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  return { supabaseAdmin, requester, access }
}

export async function GET(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const companyId = result.access!.company.id
    const now = Date.now()
    const oldest = new Date(now - 365 * 86_400_000).toISOString()
    const recent = new Date(now - 90 * 86_400_000).toISOString()

    const [ordersResult, lostResult, ignoredResult] = await Promise.all([
      result.supabaseAdmin.from('orders')
        .select('id,nome,customer_name,telefone,customer_phone,produto,status,total,total_amount,valor_total,preco_estimado,created_at,updated_at')
        .eq('company_id', companyId)
        .gte('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(350),
      result.supabaseAdmin.from('crm_leads')
        .select('telefone,updated_at')
        .eq('company_id', companyId)
        .eq('etapa', 'perdido')
        .gte('updated_at', recent)
        .limit(120),
      result.supabaseAdmin.from('recurring_orders')
        .select('original_order_id,status')
        .eq('company_id', companyId)
        .eq('status', 'ignorado')
        .limit(200),
    ])

    if (ordersResult.error) throw ordersResult.error

    const blockedPhones = new Set(
      (lostResult.data || []).map((lead) => normalizeRepurchasePhone(lead.telefone)).filter(Boolean),
    )
    const ignoredOrderIds = new Set(
      (ignoredResult.data || []).map((row) => String(row.original_order_id || '')).filter(Boolean),
    )

    const opportunities = buildRepurchaseOpportunities({
      orders: ordersResult.data || [],
      blockedPhones,
      ignoredOrderIds,
      now,
    }).slice(0, 30)

    return NextResponse.json({ opportunities, generatedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao analisar recompra.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error
    const body = await request.json().catch(() => ({}))
    const orderId = String(body.order_id || '').trim()
    if (!isUuid(orderId) || body.action !== 'ignore') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })

    const { data: order, error: orderError } = await result.supabaseAdmin.from('orders')
      .select('id,nome,customer_name,telefone,customer_phone,produto')
      .eq('id', orderId)
      .eq('company_id', result.access!.company.id)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    const { error } = await result.supabaseAdmin.from('recurring_orders').insert({
      company_id: result.access!.company.id,
      original_order_id: order.id,
      customer_name: order.nome || order.customer_name || null,
      customer_phone: order.telefone || order.customer_phone || null,
      title: order.produto || 'Oportunidade de recompra',
      frequency: 'suggestion',
      status: 'ignorado',
      notes: 'Sugestão de recompra ignorada manualmente.',
      created_by: result.requester!.id,
    })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao ignorar sugestão.' }, { status: 500 })
  }
}
