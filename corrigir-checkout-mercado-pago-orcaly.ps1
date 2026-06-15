$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path $project)) {
  Write-Host "Projeto não encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

Write-Host "Corrigindo rotas e páginas do checkout..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force "app\api\checkout\plano" | Out-Null
New-Item -ItemType Directory -Force "app\api\mercado-pago\webhook" | Out-Null
New-Item -ItemType Directory -Force "app\checkout\sucesso" | Out-Null
New-Item -ItemType Directory -Force "app\checkout\falha" | Out-Null
New-Item -ItemType Directory -Force "app\checkout\pendente" | Out-Null

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
'@

Set-Content -Path "app\api\mercado-pago\webhook\route.ts" -Encoding UTF8 -Value @'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

function somarDias(data: Date, dias: number) {
  const novaData = new Date(data)
  novaData.setDate(novaData.getDate() + dias)
  return novaData
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

    const url = new URL(request.url)
    const body = await request.json().catch(() => ({}))

    const paymentId =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get('id') ||
      url.searchParams.get('data.id')

    const topic =
      body?.type ||
      body?.topic ||
      url.searchParams.get('topic') ||
      url.searchParams.get('type')

    const supabaseAdmin = getSupabaseAdmin()

    if (!paymentId) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Nenhum paymentId recebido.',
        topic,
      })
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
        },
      }
    )

    const paymentData = await paymentResponse.json()

    if (!paymentResponse.ok) {
      return NextResponse.json(
        {
          error: paymentData.message || 'Erro ao consultar pagamento.',
          details: paymentData,
        },
        { status: 500 }
      )
    }

    const paymentRowId = paymentData.external_reference
    const status = paymentData.status
    const companyId = paymentData.metadata?.company_id
    const plano = paymentData.metadata?.plano
    const payerEmail = paymentData.payer?.email

    if (!paymentRowId) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Pagamento sem external_reference.',
        paymentId,
        status,
      })
    }

    await supabaseAdmin
      .from('plan_payments')
      .update({
        status: status || 'desconhecido',
        mercado_pago_payment_id: String(paymentId),
        raw_webhook: body,
        raw_payment: paymentData,
        paid_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .eq('id', paymentRowId)

    if (status === 'approved' && companyId) {
      const agora = new Date()
      const expiraEm = somarDias(agora, 30)

      await supabaseAdmin
        .from('companies')
        .update({
          ativo: true,
          assinatura_status: 'ativa',
          assinatura_plano: plano || 'profissional',
          assinatura_inicio: agora.toISOString(),
          assinatura_expira_em: expiraEm.toISOString(),
          assinatura_ultimo_pagamento: agora.toISOString(),
          mercado_pago_customer_email: payerEmail || null,
        })
        .eq('id', companyId)
    }

    return NextResponse.json({
      received: true,
      paymentId,
      status,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido no webhook.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
'@

Set-Content -Path "app\checkout\sucesso\page.tsx" -Encoding UTF8 -Value @'
import Link from 'next/link'

export default function CheckoutSucessoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-lg rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
        <img
          src="/logo-orcaly.png"
          alt="Orçaly"
          className="mx-auto mb-6 h-14 w-auto object-contain"
        />

        <h1 className="text-3xl font-black text-[#071b3a]">
          Pagamento aprovado
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          Seu acesso será liberado automaticamente após a confirmação do Mercado Pago.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
        >
          Ir para login
        </Link>
      </div>
    </main>
  )
}
'@

Set-Content -Path "app\checkout\falha\page.tsx" -Encoding UTF8 -Value @'
import Link from 'next/link'

export default function CheckoutFalhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
        <img
          src="/logo-orcaly.png"
          alt="Orçaly"
          className="mx-auto mb-6 h-14 w-auto object-contain"
        />

        <h1 className="text-3xl font-black text-[#071b3a]">
          Pagamento não concluído
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          O pagamento foi recusado, cancelado ou não finalizado. Volte ao cadastro e tente novamente.
        </p>

        <Link
          href="/cadastro"
          className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
        >
          Voltar ao cadastro
        </Link>
      </div>
    </main>
  )
}
'@

Set-Content -Path "app\checkout\pendente\page.tsx" -Encoding UTF8 -Value @'
import Link from 'next/link'

export default function CheckoutPendentePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-lg rounded-[2rem] border border-amber-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
        <img
          src="/logo-orcaly.png"
          alt="Orçaly"
          className="mx-auto mb-6 h-14 w-auto object-contain"
        />

        <h1 className="text-3xl font-black text-[#071b3a]">
          Pagamento pendente
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          Assim que o Mercado Pago confirmar o pagamento, o sistema libera o acesso automaticamente.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
        >
          Ir para login
        </Link>
      </div>
    </main>
  )
}
'@

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Arquivos corrigidos. Agora rode: npm run build" -ForegroundColor Green
