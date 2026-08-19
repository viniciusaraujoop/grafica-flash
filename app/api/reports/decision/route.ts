import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function valueOf(row: any) {
  return Number(row.total_amount || row.total || row.valor_total || row.preco_estimado || 0)
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function completed(status: unknown) {
  const value = normalize(status)
  return ['entregue', 'concluido', 'concluído', 'finalizado', 'atendido'].some((term) => value.includes(term))
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const rawDays = Number(request.nextUrl.searchParams.get('days') || 30)
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const companyId = access.company.id

    const [ordersResult, proposalsResult, leadsResult, historyResult] = await Promise.all([
      supabaseAdmin.from('orders')
        .select('id,nome,customer_name,telefone,customer_phone,produto,status,payment_status,paid_at,total,total_amount,valor_total,preco_estimado,created_at,updated_at')
        .eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('proposals')
        .select('id,status,valor_total,created_at,approved_at').eq('company_id', companyId).gte('created_at', since).limit(400),
      supabaseAdmin.from('crm_leads')
        .select('id,etapa,status,valor_estimado,created_at,updated_at').eq('company_id', companyId).gte('created_at', since).limit(400),
      supabaseAdmin.from('order_status_history')
        .select('order_id,new_status,created_at').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending: true }).limit(1000),
    ])

    if (ordersResult.error) throw ordersResult.error
    const orders = ordersResult.data || []
    const proposals = proposalsResult.data || []
    const leads = leadsResult.data || []
    const history = historyResult.data || []
    const paidOrders = orders.filter((order) => Boolean(order.paid_at) || ['paid', 'approved', 'pago'].includes(normalize(order.payment_status)))
    const revenue = paidOrders.reduce((sum, order) => sum + valueOf(order), 0)
    const averageTicket = paidOrders.length ? revenue / paidOrders.length : 0

    const approvedProposals = proposals.filter((proposal) => ['aprovado', 'aprovada', 'approved'].includes(normalize(proposal.status))).length
    const conversion = proposals.length ? (approvedProposals / proposals.length) * 100 : 0
    const closedLeads = leads.filter((lead) => ['fechado', 'recorrente'].includes(normalize(lead.etapa))).length

    const customerCounts = new Map<string, number>()
    for (const order of orders.filter((order) => completed(order.status))) {
      const phone = String(order.telefone || order.customer_phone || '').replace(/\D/g, '')
      const name = normalize(order.nome || order.customer_name)
      const key = phone || name
      if (key) customerCounts.set(key, (customerCounts.get(key) || 0) + 1)
    }
    const recurringCustomers = [...customerCounts.values()].filter((count) => count > 1).length

    const productMap = new Map<string, { name: string; orders: number; value: number }>()
    for (const order of orders) {
      const name = String(order.produto || 'Sem produto').trim() || 'Sem produto'
      const key = normalize(name)
      const current = productMap.get(key) || { name, orders: 0, value: 0 }
      current.orders += 1
      current.value += valueOf(order)
      productMap.set(key, current)
    }
    const topProducts = [...productMap.values()].sort((a, b) => b.orders - a.orders || b.value - a.value).slice(0, 8)

    const firstEvent = new Map<string, number>()
    const lastCompleted = new Map<string, number>()
    for (const event of history) {
      const time = new Date(event.created_at).getTime()
      if (!Number.isFinite(time)) continue
      if (!firstEvent.has(event.order_id)) firstEvent.set(event.order_id, time)
      if (completed(event.new_status)) lastCompleted.set(event.order_id, time)
    }
    const completionDurations = [...lastCompleted.entries()].flatMap(([orderId, end]) => {
      const start = firstEvent.get(orderId)
      return start && end >= start ? [end - start] : []
    })
    const avgCompletionHours = completionDurations.length
      ? completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length / 3_600_000
      : null

    return NextResponse.json({
      periodDays: days,
      generatedAt: new Date().toISOString(),
      metrics: {
        revenue,
        averageTicket,
        orders: orders.length,
        paidOrders: paidOrders.length,
        proposalConversion: conversion,
        proposals: proposals.length,
        approvedProposals,
        leads: leads.length,
        closedLeads,
        recurringCustomers,
        avgCompletionHours,
      },
      topProducts,
      partial: Boolean(proposalsResult.error || leadsResult.error || historyResult.error),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao gerar relatório.' }, { status: 500 })
  }
}
