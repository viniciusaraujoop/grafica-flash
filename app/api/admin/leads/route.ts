import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

function montarMensagem(lead: any) {
  const nome = lead.nome_responsavel || 'tudo bem'
  const empresa = lead.empresa_nome || 'sua empresa'

  if (lead.status === 'pago') {
    return `Oi, ${nome}! Aqui é do Orçaly. Vi que o pagamento da ${empresa} foi aprovado, mas a conta ainda não foi finalizada. Posso te ajudar a concluir e colocar seu site no ar?`
  }

  if (lead.followup_count === 0) {
    return `Oi, ${nome}! Aqui é do Orçaly. Vi que você começou a criar o site da ${empresa}, mas não finalizou. Muita empresa perde pedidos por deixar tudo solto no WhatsApp. Quer que eu te ajude a colocar seu site e pedidos organizados no ar?`
  }

  if (lead.followup_count === 1) {
    return `Oi, ${nome}! Passando só para lembrar: com o Orçaly, a ${empresa} pode ter site profissional, pedido inteligente e proposta organizada. Isso ajuda a passar mais confiança e reduzir vendas perdidas no atendimento.`
  }

  return `Oi, ${nome}! Último lembrete por aqui: se ainda fizer sentido para a ${empresa}, posso te ajudar a ativar o Orçaly e transformar WhatsApp bagunçado em site, pedidos e propostas. Se não quiser receber mensagens, responda SAIR.`
}

function whatsappLink(numero: string, mensagem: string) {
  const limpo = String(numero || '').replace(/\D/g, '')
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`

  return `https://wa.me/${final}?text=${encodeURIComponent(mensagem)}`
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { data, error } = await admin.supabaseAdmin
    .from('admin_signup_leads_overview')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const leads = (data || []).map((lead: any) => {
    const mensagem = montarMensagem(lead)

    return {
      ...lead,
      suggested_message: mensagem,
      whatsapp_url: lead.whatsapp ? whatsappLink(lead.whatsapp, mensagem) : null,
    }
  })

  return NextResponse.json({ leads })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const body = await request.json()
  const leadId = String(body.lead_id || '')
  const action = String(body.action || 'mark_sent')
  const message = String(body.message || '')

  if (!leadId) {
    return NextResponse.json({ error: 'lead_id ausente' }, { status: 400 })
  }

  if (action === 'opt_out') {
    const { error } = await admin.supabaseAdmin
      .from('signup_leads')
      .update({
        status: 'opt_out',
        next_followup_at: null,
      })
      .eq('id', leadId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  if (action === 'lost') {
    const { error } = await admin.supabaseAdmin
      .from('signup_leads')
      .update({
        status: 'perdido',
        next_followup_at: null,
      })
      .eq('id', leadId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  const { data: lead, error: leadError } = await admin.supabaseAdmin
    .from('signup_leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  const nextCount = Number(lead.followup_count || 0) + 1

  await admin.supabaseAdmin.from('signup_lead_followups').insert({
    lead_id: leadId,
    channel: 'whatsapp',
    status: 'enviado_manual',
    message,
    sent_at: new Date().toISOString(),
    admin_email: admin.email,
  })

  const { error } = await admin.supabaseAdmin
    .from('signup_leads')
    .update({
      followup_count: nextCount,
      last_followup_at: new Date().toISOString(),
      next_followup_at: nextCount >= 3 ? null : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: lead.status === 'lead' ? 'checkout_criado' : lead.status,
    })
    .eq('id', leadId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
