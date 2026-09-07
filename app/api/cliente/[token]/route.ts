import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const supabaseAdmin = getSupabaseAdmin()

    const { data: link, error: linkError } = await supabaseAdmin
      .from('customer_magic_links')
      .select('id,company_id,customer_name,customer_phone,status,last_access_at,created_at,companies(id,nome,logo_url,whatsapp,site_primary_color,site_accent_color)')
      .eq('token', token)
      .eq('status', 'ativo')
      .maybeSingle()

    if (linkError) throw linkError
    if (!link) return NextResponse.json({ error: 'Área do cliente não encontrada.' }, { status: 404 })

    const phone = normalizePhone(link.customer_phone)
    const phoneWithout55 = phone.startsWith('55') ? phone.slice(2) : phone
    const phoneVariants = unique([phone, phoneWithout55, phoneWithout55 ? `55${phoneWithout55}` : ''])
    if (!phoneVariants.length) return NextResponse.json({ error: 'Contato do cliente inválido.' }, { status: 400 })

    const phoneFilter = phoneVariants.flatMap((value) => [`telefone.eq.${value}`, `customer_phone.eq.${value}`]).join(',')
    const proposalPhoneFilter = phoneVariants.map((value) => `cliente_whatsapp.eq.${value}`).join(',')

    const [ordersResult, proposalsResult] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('id,nome,customer_name,produto,status,payment_status,paid_at,total,total_amount,valor_total,preco_estimado,created_at,updated_at,prazo_entrega,delivery_type,endereco_entrega,forma_pagamento,arquivo_url,file_url')
        .eq('company_id', link.company_id)
        .or(phoneFilter)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('proposals')
        .select('id,token,proposta_numero,titulo,status,valor_total,valor_sinal,prazo,valid_until,created_at,updated_at,approved_at,payment_url,imagem_capa_url,preview_image_url')
        .eq('company_id', link.company_id)
        .or(proposalPhoneFilter)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const orders = ordersResult.data || []
    const proposals = proposalsResult.data || []
    const orderIds = orders.map((order) => order.id)

    let timeline: Array<Record<string, unknown>> = []
    let artApprovals: Array<Record<string, unknown>> = []

    if (orderIds.length) {
      const [timelineResult, artResult] = await Promise.all([
        supabaseAdmin
          .from('order_status_history')
          .select('id,order_id,new_status,note,created_at')
          .eq('company_id', link.company_id)
          .in('order_id', orderIds)
          .order('created_at', { ascending: true })
          .limit(300),
        supabaseAdmin
          .from('art_approval_requests')
          .select('id,order_id,proposal_id,token,title,produto_nome,artwork_url,preview_url,status,comentario_cliente,approved_at,requested_changes_at,created_at,expires_at')
          .eq('company_id', link.company_id)
          .in('order_id', orderIds)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
          .limit(80),
      ])
      timeline = timelineResult.data || []
      artApprovals = artResult.data || []
    }

    await Promise.all([
      supabaseAdmin
        .from('customer_magic_links')
        .update({ last_access_at: new Date().toISOString() })
        .eq('id', link.id)
        .eq('company_id', link.company_id),
      supabaseAdmin
        .from('customer_portal_events')
        .insert({
          company_id: link.company_id,
          customer_magic_link_id: link.id,
          event_type: 'portal_viewed',
          metadata: { order_count: orders.length, proposal_count: proposals.length },
        }),
    ])

    return NextResponse.json({
      link: {
        id: link.id,
        customer_name: link.customer_name,
        customer_phone: link.customer_phone,
        last_access_at: link.last_access_at,
      },
      company: link.companies,
      orders,
      proposals,
      timeline,
      artApprovals,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar área do cliente.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
