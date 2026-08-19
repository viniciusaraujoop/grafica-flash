import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function clean(value: unknown) {
  return String(value || '').trim()
}

function safeSearch(value: string) {
  return value.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1))
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 40)
    const limit = Math.min(80, Math.max(10, Number.isFinite(requestedLimit) ? requestedLimit : 40))
    const q = safeSearch(clean(request.nextUrl.searchParams.get('q')))
    const status = clean(request.nextUrl.searchParams.get('status'))
    const sort = clean(request.nextUrl.searchParams.get('sort')) || 'recent'
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabaseAdmin
      .from('orders')
      .select(
        'id,nome,telefone,customer_name,customer_phone,customer_email,produto,status,payment_status,paid_at,total,total_amount,valor_total,preco_estimado,created_at,updated_at,prioridade,priority,prazo_entrega,responsavel_id,responsavel_nome,canal_origem,delivery_type,arquivo_url,file_url,observacoes,observacoes_internas',
        { count: 'exact' },
      )
      .eq('company_id', access.company.id)

    if (q) {
      const pattern = `%${q}%`
      query = query.or(`nome.ilike.${pattern},customer_name.ilike.${pattern},telefone.ilike.${pattern},customer_phone.ilike.${pattern},customer_email.ilike.${pattern},produto.ilike.${pattern},status.ilike.${pattern}`)
    }

    if (status && status !== 'todos') query = query.eq('status', status)

    if (sort === 'deadline') query = query.order('prazo_entrega', { ascending: true, nullsFirst: false })
    else if (sort === 'value') query = query.order('valor_total', { ascending: false, nullsFirst: false })
    else query = query.order('created_at', { ascending: false })

    const { data: orders, error, count } = await query.range(from, to)
    if (error) throw error

    const orderIds = (orders || []).map((order) => order.id)
    let tasks: Array<Record<string, unknown>> = []

    if (orderIds.length) {
      const { data } = await supabaseAdmin
        .from('internal_tasks')
        .select('id,order_id,titulo,descricao,status,prioridade,due_at,responsavel_id')
        .eq('company_id', access.company.id)
        .in('order_id', orderIds)
        .not('status', 'in', '(concluido,concluida,concluído,done,cancelado)')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(Math.min(orderIds.length * 3, 180))
      tasks = (data || []) as Array<Record<string, unknown>>
    }

    const nextTaskByOrder = new Map<string, Record<string, unknown>>()
    for (const task of tasks) {
      const orderId = clean(task.order_id)
      if (orderId && !nextTaskByOrder.has(orderId)) nextTaskByOrder.set(orderId, task)
    }

    return NextResponse.json({
      orders: (orders || []).map((order) => ({
        ...order,
        next_action: nextTaskByOrder.get(order.id) || null,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
      company: {
        id: access.company.id,
        business_type: access.company.business_type || access.company.site_template || 'services',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar pedidos.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
