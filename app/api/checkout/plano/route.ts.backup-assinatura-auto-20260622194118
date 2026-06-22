import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PlanoId = 'basico' | 'profissional' | 'premium'

const planos: Record<PlanoId, { nome: string; valor: number }> = {
  basico: {
    nome: 'Essencial',
    valor: 49.9,
  },
  profissional: {
    nome: 'Profissional',
    valor: 99.9,
  },
  premium: {
    nome: 'Premium',
    valor: 149.9,
  },
}

function normalizarPlano(valor: unknown): PlanoId {
  if (valor === 'basico' || valor === 'profissional' || valor === 'premium') {
    return valor
  }

  return 'profissional'
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis do Supabase não configuradas no servidor.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    if (!mercadoPagoToken) {
      return NextResponse.json(
        { error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' },
        { status: 500 }
      )
    }

    const body = await request.json()

    const companyId = body.companyId
    const email = body.email
    const nomeEmpresa = body.nomeEmpresa || 'Empresa'
    const planoRecebido = normalizarPlano(body.plano)
    const plano = planos[planoRecebido]

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId é obrigatório.' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'email é obrigatório.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    await supabaseAdmin
      .from('companies')
      .update({
        assinatura_plano: planoRecebido,
        plano: planoRecebido,
      })
      .eq('id', companyId)

    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from('plan_payments')
      .insert({
        company_id: companyId,
        plano: planoRecebido,
        valor: plano.valor,
        status: 'pendente',
        email,
        nome_empresa: nomeEmpresa,
      })
      .select('id')
      .single()

    if (pagamentoError) {
      return NextResponse.json(
        { error: pagamentoError.message },
        { status: 500 }
      )
    }

    const preferencePayload = {
      items: [
        {
          id: planoRecebido,
          title: `Plano ${plano.nome} - Orçaly`,
          description: `Assinatura mensal do plano ${plano.nome}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: plano.valor,
        },
      ],
      payer: {
        email,
      },
      external_reference: pagamento.id,
      metadata: {
        payment_id: pagamento.id,
        company_id: companyId,
        plano: planoRecebido,
      },
      back_urls: {
        success: `${siteUrl}/checkout/sucesso`,
        failure: `${siteUrl}/checkout/falha`,
        pending: `${siteUrl}/checkout/pendente`,
      },
      notification_url: `${siteUrl}/api/mercado-pago/webhook`,
    }

    const mercadoPagoResponse = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencePayload),
      }
    )

    const mercadoPagoData = await mercadoPagoResponse.json()

    if (!mercadoPagoResponse.ok) {
      return NextResponse.json(
        {
          error:
            mercadoPagoData.message ||
            mercadoPagoData.error ||
            'Erro ao criar checkout no Mercado Pago.',
          details: mercadoPagoData,
        },
        { status: 500 }
      )
    }

    await supabaseAdmin
      .from('plan_payments')
      .update({
        mercado_pago_preference_id: mercadoPagoData.id,
        checkout_url: mercadoPagoData.init_point || mercadoPagoData.sandbox_init_point,
      })
      .eq('id', pagamento.id)

    return NextResponse.json({
      id: mercadoPagoData.id,
      init_point: mercadoPagoData.init_point,
      sandbox_init_point: mercadoPagoData.sandbox_init_point,
      checkout_url: mercadoPagoData.init_point || mercadoPagoData.sandbox_init_point,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido ao criar checkout.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
