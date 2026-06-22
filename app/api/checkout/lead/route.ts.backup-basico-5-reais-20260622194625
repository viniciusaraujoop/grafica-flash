import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN!
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
})

const planos: Record<string, { nome: string; valor: number }> = {
  essencial: { nome: 'Essencial', valor: 49.9 },
  basico: { nome: 'Essencial', valor: 49.9 },
  profissional: { nome: 'Profissional', valor: 99.9 },
  premium: { nome: 'Premium', valor: 149.9 },
}

function criarSlug(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || `empresa-${Date.now()}`
}

function telefoneLimpo(valor: string) {
  return valor.replace(/\D/g, '')
}

function erro(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return erro('Supabase service role não configurada.', 500)
    }

    if (!mercadoPagoToken) {
      return erro('MERCADO_PAGO_ACCESS_TOKEN não configurado.', 500)
    }

    const body = await request.json()

    const nome_responsavel = String(body.nome_responsavel || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const whatsapp = telefoneLimpo(String(body.whatsapp || ''))
    const empresa_nome = String(body.empresa_nome || '').trim()
    const segmento = String(body.segmento || '').trim()
    const modelo_negocio = String(body.modelo_negocio || segmento || 'outros').trim()
    const cidade = String(body.cidade || '').trim()
    const estado = String(body.estado || '').trim().toUpperCase()
    const plano = String(body.plano || 'profissional').trim().toLowerCase()
    const marketing_opt_in = Boolean(body.marketing_opt_in)

    if (!nome_responsavel) return erro('Informe seu nome.')
    if (!email || !email.includes('@')) return erro('Informe um e-mail válido.')
    if (!whatsapp || whatsapp.length < 10) return erro('Informe um WhatsApp válido.')
    if (!empresa_nome) return erro('Informe o nome da empresa.')
    if (!marketing_opt_in) return erro('Para receber lembretes pelo WhatsApp, confirme a autorização.')

    const planoSelecionado = planos[plano] || planos.profissional
    const slug_sugerido = criarSlug(empresa_nome)

    const { data: leadExistente } = await supabaseAdmin
      .from('signup_leads')
      .select('*')
      .eq('email', email)
      .in('status', ['lead', 'checkout_criado', 'pago'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let leadId = leadExistente?.id as string | undefined

    if (leadId) {
      const { error: updateError } = await supabaseAdmin
        .from('signup_leads')
        .update({
          nome_responsavel,
          whatsapp,
          empresa_nome,
          slug_sugerido,
          segmento,
          modelo_negocio,
          cidade,
          estado,
          plano,
          status: leadExistente.status === 'pago' ? 'pago' : 'checkout_criado',
          marketing_opt_in,
          marketing_opt_in_text: 'Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.',
          next_followup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          raw_data: body,
        })
        .eq('id', leadId)

      if (updateError) throw updateError
    } else {
      const { data: lead, error: insertError } = await supabaseAdmin
        .from('signup_leads')
        .insert({
          nome_responsavel,
          email,
          whatsapp,
          empresa_nome,
          slug_sugerido,
          segmento,
          modelo_negocio,
          cidade,
          estado,
          plano,
          status: 'checkout_criado',
          marketing_opt_in,
          marketing_opt_in_text: 'Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.',
          next_followup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          raw_data: body,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      leadId = lead.id
    }

    const preferencePayload = {
      items: [
        {
          title: `Orçaly - Plano ${planoSelecionado.nome}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: planoSelecionado.valor,
        },
      ],
      payer: {
        name: nome_responsavel,
        email,
      },
      back_urls: {
        success: `${siteUrl}/checkout/sucesso?lead_id=${leadId}`,
        failure: `${siteUrl}/checkout/falha?lead_id=${leadId}`,
        pending: `${siteUrl}/checkout/pendente?lead_id=${leadId}`,
      },
      notification_url: `${siteUrl}/api/mercado-pago/webhook-leads`,
      external_reference: `lead:${leadId}`,
      metadata: {
        lead_id: leadId,
        plano,
        email,
        empresa_nome,
      },
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mercadoPagoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      await supabaseAdmin
        .from('signup_leads')
        .update({
          status: 'lead',
          raw_data: {
            ...body,
            mercado_pago_error: mpData,
          },
        })
        .eq('id', leadId)

      return NextResponse.json({ error: 'Erro ao criar checkout.', details: mpData }, { status: 500 })
    }

    await supabaseAdmin
      .from('signup_leads')
      .update({
        checkout_url: mpData.init_point || mpData.sandbox_init_point,
        mercado_pago_preference_id: mpData.id,
      })
      .eq('id', leadId)

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      checkout_url: mpData.init_point || mpData.sandbox_init_point,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao iniciar assinatura.' },
      { status: 500 }
    )
  }
}
