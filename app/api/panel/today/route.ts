import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

type AttentionItem = {
  id: string
  type: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'normal' | 'info'
  href: string
  dueAt?: string | null
  value?: number | null
}

function text(value: unknown) {
  return String(value || '').trim()
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function localDayBounds(offsetMinutes: number) {
  const now = new Date()
  const localMs = now.getTime() - offsetMinutes * 60_000
  const local = new Date(localMs)
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const start = new Date(startLocal + offsetMinutes * 60_000)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end, now }
}

function isOpenStatus(value: unknown) {
  const status = text(value).toLowerCase()
  return !['entregue', 'concluido', 'concluído', 'cancelado', 'canceled', 'cancelled', 'finalizado', 'fechado', 'perdido'].includes(status)
}

function isPendingPayment(value: unknown) {
  const status = text(value).toLowerCase()
  return Boolean(status) && !['paid', 'approved', 'pago', 'aprovado', 'authorized'].includes(status)
}

function priorityForDeadline(value: string | null | undefined, now: Date) {
  if (!value) return 'normal' as const
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'normal' as const
  if (date.getTime() < now.getTime()) return 'critical' as const
  if (date.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) return 'high' as const
  return 'normal' as const
}

async function access(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)
  if (!requester) return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }), supabaseAdmin }

  const companyAccess = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
  if (!companyAccess.company?.id) {
    return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }), supabaseAdmin }
  }

  return { supabaseAdmin, requester, companyAccess }
}

export async function GET(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const company = result.companyAccess!.company
    const companyId = company.id
    const rawOffset = Number(request.nextUrl.searchParams.get('offset') || 0)
    const offset = Number.isFinite(rawOffset) && Math.abs(rawOffset) <= 14 * 60 ? rawOffset : 0
    const { start, end, now } = localDayBounds(offset)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [
      recentOrdersResult,
      ordersTodayCountResult,
      paidTodayResult,
      proposalsResult,
      tasksResult,
      followupsResult,
      artsResult,
      productsResult,
      leadsResult,
      receiptsResult,
    ] = await Promise.all([
      result.supabaseAdmin
        .from('orders')
        .select('id,nome,produto,status,payment_status,paid_at,total,total_amount,valor_total,preco_estimado,prazo_entrega,prioridade,created_at,delivery_type')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(80),
      result.supabaseAdmin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      result.supabaseAdmin
        .from('orders')
        .select('id,total,total_amount,valor_total,preco_estimado,paid_at')
        .eq('company_id', companyId)
        .gte('paid_at', startIso)
        .lt('paid_at', endIso)
        .limit(150),
      result.supabaseAdmin
        .from('proposals')
        .select('id,cliente_nome,status,valor_total,valid_until,sent_at,created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(70),
      result.supabaseAdmin
        .from('internal_tasks')
        .select('id,titulo,descricao,status,prioridade,due_at,order_id,proposal_id,crm_lead_id')
        .eq('company_id', companyId)
        .neq('status', 'concluida')
        .neq('status', 'concluído')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(80),
      result.supabaseAdmin
        .from('customer_followups')
        .select('id,cliente_nome,cliente_telefone,titulo,descricao,status,prioridade,due_at')
        .eq('company_id', companyId)
        .neq('status', 'concluido')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(60),
      result.supabaseAdmin
        .from('art_approval_requests')
        .select('id,order_id,proposal_id,title,produto_nome,cliente_nome,status,created_at,expires_at')
        .eq('company_id', companyId)
        .in('status', ['pending', 'pendente', 'aguardando', 'sent', 'enviado'])
        .order('created_at', { ascending: false })
        .limit(50),
      result.supabaseAdmin
        .from('products')
        .select('id,nome,estoque,ativo,available,is_active')
        .eq('company_id', companyId)
        .not('estoque', 'is', null)
        .lte('estoque', 5)
        .limit(40),
      result.supabaseAdmin
        .from('crm_leads')
        .select('id,nome,etapa,valor_estimado,proximo_contato_em,status')
        .eq('company_id', companyId)
        .eq('status', 'ativo')
        .order('updated_at', { ascending: false })
        .limit(100),
      result.supabaseAdmin
        .from('financial_transactions')
        .select('id,valor,amount,status,tipo,type,paid_at,created_at')
        .eq('company_id', companyId)
        .or(`paid_at.gte.${startIso},created_at.gte.${startIso}`)
        .limit(120),
    ])

    const orders = recentOrdersResult.data || []
    const proposals = proposalsResult.data || []
    const tasks = tasksResult.data || []
    const followups = followupsResult.data || []
    const arts = artsResult.data || []
    const products = productsResult.data || []
    const leads = leadsResult.data || []
    const attention: AttentionItem[] = []

    for (const order of orders) {
      if (!isOpenStatus(order.status)) continue

      if (order.prazo_entrega) {
        const due = new Date(order.prazo_entrega)
        if (!Number.isNaN(due.getTime()) && due.getTime() < end.getTime()) {
          attention.push({
            id: `order-deadline-${order.id}`,
            type: 'order_deadline',
            title: due.getTime() < now.getTime() ? 'Pedido atrasado' : 'Pedido vence hoje',
            description: `${order.nome || 'Cliente'} · ${order.produto || 'Pedido'}`,
            priority: priorityForDeadline(order.prazo_entrega, now),
            href: `/painel/pedidos/${order.id}`,
            dueAt: order.prazo_entrega,
          })
        }
      }

      if (isPendingPayment(order.payment_status)) {
        attention.push({
          id: `payment-${order.id}`,
          type: 'payment',
          title: 'Pagamento pendente',
          description: `${order.nome || 'Cliente'} · ${order.produto || 'Pedido'}`,
          priority: 'high',
          href: `/painel/pedidos/${order.id}`,
          value: numberValue(order.total_amount || order.total || order.valor_total || order.preco_estimado),
        })
      }

      const status = text(order.status).toLowerCase()
      if (['recebido', 'novo', 'pendente'].includes(status)) {
        attention.push({
          id: `new-order-${order.id}`,
          type: 'new_order',
          title: 'Pedido novo',
          description: `${order.nome || 'Cliente'} · ${order.produto || 'Pedido'}`,
          priority: 'normal',
          href: `/painel/pedidos/${order.id}`,
        })
      }
    }

    for (const proposal of proposals) {
      const status = text(proposal.status).toLowerCase()
      if (['approved', 'aprovada', 'aprovado', 'rejected', 'recusada', 'cancelada', 'expired', 'expirada'].includes(status)) continue
      const validUntil = proposal.valid_until ? new Date(proposal.valid_until) : null
      const expiring = validUntil && !Number.isNaN(validUntil.getTime()) && validUntil.getTime() <= end.getTime()
      const staleSent = proposal.sent_at && now.getTime() - new Date(proposal.sent_at).getTime() >= 48 * 60 * 60 * 1000

      if (expiring || staleSent) {
        attention.push({
          id: `proposal-${proposal.id}`,
          type: 'proposal',
          title: expiring ? 'Proposta vencendo' : 'Proposta sem resposta',
          description: proposal.cliente_nome || 'Cliente não identificado',
          priority: expiring ? 'high' : 'normal',
          href: `/painel/proposta/${proposal.id}`,
          dueAt: proposal.valid_until,
          value: numberValue(proposal.valor_total),
        })
      }
    }

    for (const task of tasks) {
      if (!task.due_at) continue
      const due = new Date(task.due_at)
      if (Number.isNaN(due.getTime()) || due.getTime() >= end.getTime()) continue
      attention.push({
        id: `task-${task.id}`,
        type: 'task',
        title: due.getTime() < now.getTime() ? 'Tarefa vencida' : 'Próxima ação de hoje',
        description: task.titulo,
        priority: priorityForDeadline(task.due_at, now),
        href: task.order_id ? `/painel/pedidos/${task.order_id}` : task.proposal_id ? `/painel/proposta/${task.proposal_id}` : '/painel/tarefas',
        dueAt: task.due_at,
      })
    }

    for (const followup of followups) {
      if (!followup.due_at) continue
      const due = new Date(followup.due_at)
      if (Number.isNaN(due.getTime()) || due.getTime() >= end.getTime()) continue
      attention.push({
        id: `followup-${followup.id}`,
        type: 'followup',
        title: due.getTime() < now.getTime() ? 'Follow-up atrasado' : 'Follow-up previsto',
        description: `${followup.cliente_nome || 'Cliente'} · ${followup.titulo}`,
        priority: priorityForDeadline(followup.due_at, now),
        href: '/painel/follow-up',
        dueAt: followup.due_at,
      })
    }

    for (const art of arts) {
      attention.push({
        id: `art-${art.id}`,
        type: 'art',
        title: 'Arte aguardando aprovação',
        description: `${art.cliente_nome || 'Cliente'} · ${art.produto_nome || art.title || 'Arte'}`,
        priority: art.expires_at ? priorityForDeadline(art.expires_at, now) : 'normal',
        href: '/painel/aprovacao-arte',
        dueAt: art.expires_at,
      })
    }

    for (const product of products) {
      const stock = numberValue(product.estoque)
      const active = product.ativo !== false && product.available !== false && product.is_active !== false
      if (!active) continue
      attention.push({
        id: `stock-${product.id}`,
        type: 'stock',
        title: stock <= 0 ? 'Produto sem estoque' : 'Estoque baixo',
        description: `${product.nome} · ${stock} unidade(s)`,
        priority: stock <= 0 ? 'critical' : 'high',
        href: `/painel/produtos/${product.id}`,
      })
    }

    for (const lead of leads) {
      if (!lead.proximo_contato_em) continue
      const due = new Date(lead.proximo_contato_em)
      if (Number.isNaN(due.getTime()) || due.getTime() >= end.getTime()) continue
      attention.push({
        id: `lead-${lead.id}`,
        type: 'lead',
        title: due.getTime() < now.getTime() ? 'Cliente precisa de retorno' : 'Contato previsto hoje',
        description: lead.nome,
        priority: priorityForDeadline(lead.proximo_contato_em, now),
        href: `/painel/crm?lead=${lead.id}`,
        dueAt: lead.proximo_contato_em,
        value: numberValue(lead.valor_estimado),
      })
    }

    const priorityWeight = { critical: 0, high: 1, normal: 2, info: 3 }
    attention.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || String(a.dueAt || '').localeCompare(String(b.dueAt || '')))

    const paidToday = paidTodayResult.data || []
    const salesToday = paidToday.reduce((sum, row) => sum + numberValue(row.total_amount || row.total || row.valor_total || row.preco_estimado), 0)
    const openProposals = proposals.filter((proposal) => !['approved', 'aprovada', 'aprovado', 'rejected', 'recusada', 'cancelada', 'expired', 'expirada'].includes(text(proposal.status).toLowerCase()))
    const opportunityValue = leads.reduce((sum, lead) => sum + numberValue(lead.valor_estimado), 0)
    const receipts = (receiptsResult.data || []).filter((entry) => {
      const type = text(entry.tipo || entry.type).toLowerCase()
      const status = text(entry.status).toLowerCase()
      return ['entrada', 'receita', 'income'].includes(type) && (!status || ['pago', 'paid', 'recebido', 'concluido'].includes(status))
    }).reduce((sum, entry) => sum + numberValue(entry.valor || entry.amount), 0)

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      company: {
        id: companyId,
        name: company.nome || 'Empresa Orçaly',
        businessType: company.business_type || company.site_template || 'services',
      },
      attention: attention.slice(0, 30),
      totals: {
        attention: attention.length,
        critical: attention.filter((item) => item.priority === 'critical').length,
        high: attention.filter((item) => item.priority === 'high').length,
      },
      summary: {
        salesToday,
        ordersToday: ordersTodayCountResult.count || 0,
        receiptsToday: receipts,
        openProposals: openProposals.length,
        tasksToday: tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < end.getTime()).length,
        deliveries: orders.filter((order) => isOpenStatus(order.status) && Boolean(order.delivery_type)).length,
        customersWaiting: followups.filter((followup) => followup.due_at && new Date(followup.due_at).getTime() < end.getTime()).length,
        opportunityValue,
      },
      dataHealth: {
        orders: recentOrdersResult.error?.message || null,
        proposals: proposalsResult.error?.message || null,
        tasks: tasksResult.error?.message || null,
        followups: followupsResult.error?.message || null,
        arts: artsResult.error?.message || null,
        products: productsResult.error?.message || null,
        leads: leadsResult.error?.message || null,
        receipts: receiptsResult.error?.message || null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao montar a Central do Dia.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
