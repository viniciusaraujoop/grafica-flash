$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
Set-Location $project

New-Item -ItemType Directory -Force "app\api\checkout\plano" | Out-Null

Set-Content -Path "app\api\checkout\plano\route.ts" -Encoding UTF8 -Value @'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PlanoId = 'basico' | 'profissional' | 'premium'

const planos: Record<PlanoId, { nome: string; valor: number }> = {
  basico: {
    nome: 'Básico',
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
    throw new Error('Variáveis do Supabase não configuradas no servidor.')
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

  if (siteUrl && siteUrl.trim()) {
    return siteUrl.trim().replace(/\/$/, '')
  }

  const origin = request.headers.get('origin')

  if (origin && origin.trim()) {
    return origin.trim().replace(/\/$/, '')
  }

  return 'https://grafica-flash-xi.vercel.app'
}

export async function POST(request: NextRequest) {
  try {
    const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      return NextResponse.json(
        { error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' },
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
        { error: 'companyId não informado.' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail não informado.' },
        { status: 400 }
      )
    }

    const plano = planos[planoRecebido]

    if (!plano) {
      return NextResponse.json(
        { error: 'Plano inválido.' },
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
            'Não foi possível registrar o pagamento.',
        },
        { status: 500 }
      )
    }

    const siteUrl = getSiteUrl(request)

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
          raw_payment: {
            mercado_pago_error: mpData,
            sent_payload: preferencePayload,
          },
        })
        .eq('id', pagamento.id)

      return NextResponse.json(
        {
          error: mpData.message || mpData.error || 'Erro ao criar checkout no Mercado Pago.',
          details: mpData,
          sentPayload: preferencePayload,
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
'@

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Rota app/api/checkout/plano/route.ts corrigida sem auto_return." -ForegroundColor Green
Write-Host "Agora pare o servidor com Ctrl+C e rode: npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Checagem: se aparecer algo abaixo, auto_return ainda existe em outro arquivo:" -ForegroundColor Cyan
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "auto_return" -ErrorAction SilentlyContinue
