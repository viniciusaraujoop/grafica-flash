import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'
import { notifyOrderStatus } from '@/lib/whatsapp-notifications'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const body = await request.json()
    const status = String(body.status || '').trim()
    const orderId = String(body.order_id || '').trim()
    const productionOrderId = String(body.production_order_id || '').trim()
    if (!status) return NextResponse.json({ error: 'Status não informado.' }, { status: 400 })

    let order: any = null

    if (isUuid(orderId)) {
      const { data } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).eq('company_id', access.company.id).maybeSingle()
      order = data
    }

    if (!order && isUuid(productionOrderId)) {
      const { data: prod } = await supabaseAdmin.from('production_orders').select('*').eq('id', productionOrderId).eq('company_id', access.company.id).maybeSingle()
      if (prod?.order_id) {
        const { data } = await supabaseAdmin.from('orders').select('*').eq('id', prod.order_id).eq('company_id', access.company.id).maybeSingle()
        order = data || { id: prod.order_id, nome: prod.customer_name, telefone: prod.customer_whatsapp, valor_total: prod.total_value }
      } else if (prod) {
        order = { id: prod.id, nome: prod.customer_name, telefone: prod.customer_whatsapp, valor_total: prod.total_value }
      }
    }

    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    await notifyOrderStatus(supabaseAdmin, { company: access.company, order, status, source: body.source || 'manual' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao notificar status.' }, { status: 500 })
  }
}
