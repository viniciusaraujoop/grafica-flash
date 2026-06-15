import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PlanoId = 'basico' | 'profissional' | 'premium'

const planos: Record<PlanoId, { nome: string; valor: number }> = {
  basico: {
    nome: 'BÃ¡sico',
    valor: 49,
  },
  profissional: {
    nome: 'Profissional',
    valor: 99,
  },
  premium: {
    nome: 'Premium',
    valor: 199,
  },
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('VariÃ¡veis do Supabase nÃ£o configuradas no servidor.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function getSiteUrl(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (siteUrl) {
    return siteUrl.replace(/\/$/, '')
  }

  const origin = request.headers.get('origin')

  if (origin) {
    return origin.replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  try {
    const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      return NextResponse.json(
        { error: 'MERCADO_PAGO_ACCESS_TOKEN nÃ£o configurado.' },
        { status: 500 }
      )
    }

    const body = await request.json()

    const planoRecebido = String(body.plano || 'profissional') as PlanoId
    const companyId = String(body.companyId || '')
    const email = String(body.email || '')
    const nomeEmpresa = String(body.nomeEmpresa || 'Empresa')

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId nÃ£o informado.' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail nÃ£o informado.' },
        { status: 400 }
      )
    }

    const plano = planos[planoRecebido]

    if (!plano) {
      return NextResponse.json(
        { error: 'Plano invÃ¡lido.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

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

    if (pagamentoError || !pagamento) {
      return NextResponse.json(
        {
          error:
            pagamentoError?.message ||
            'NÃ£o foi possÃ­vel registrar o pagamento.',
        },
        { status: 500 }
      )
    }

    const siteUrl = getSiteUrl(request)

    const preferencePayload = {
      items: [
        {
          id: planoRecebido,
          title: `Plano ${plano.nome} - OrÃ§aly`,
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
      auto_return: 'approved',
    }

    const mpResponse = await fetch(
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

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      await supabaseAdmin
        .from('plan_payments')
        .update({
          status: 'erro',
          raw_payment: mpData,
        })
        .eq('id', pagamento.id)

      return NextResponse.json(
        {
          error: mpData.message || 'Erro ao criar checkout no Mercado Pago.',
          details: mpData,
        },
        { status: 500 }
      )
    }

    const checkoutUrl = mpData.init_point || mpData.sandbox_init_point

    await supabaseAdmin
      .from('plan_payments')
      .update({
        mercado_pago_preference_id: mpData.id,
        checkout_url: checkoutUrl,
      })
      .eq('id', pagamento.id)

    return NextResponse.json({
      paymentId: pagamento.id,
      preferenceId: mpData.id,
      checkoutUrl,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido no checkout.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
