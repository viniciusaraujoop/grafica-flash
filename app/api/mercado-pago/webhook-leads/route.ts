import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
})

function getPaymentIdFromUrl(request: NextRequest) {
  const url = new URL(request.url)

  return (
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    url.searchParams.get('payment_id') ||
    ''
  )
}

async function processPayment(paymentId: string) {
  if (!paymentId) return { ok: false, reason: 'payment_id ausente' }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${mercadoPagoToken}`,
    },
  })

  const payment = await response.json()

  if (!response.ok) {
    return { ok: false, reason: 'erro mercado pago', payment }
  }

  const metadata = payment.metadata || {}
  const externalReference = String(payment.external_reference || '')
  const leadId = metadata.lead_id || externalReference.replace('lead:', '')

  if (!leadId) {
    return { ok: false, reason: 'lead_id ausente', payment }
  }

  const status = String(payment.status || '')
  const paid = status === 'approved'

  const updatePayload: Record<string, any> = {
    mercado_pago_payment_id: String(payment.id || paymentId),
    payment_status: status,
    raw_data: {
      mercado_pago_payment: payment,
    },
  }

  if (paid) {
    updatePayload.status = 'pago'
    updatePayload.paid_at = new Date().toISOString()
    updatePayload.next_followup_at = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
  }

  await supabaseAdmin
    .from('signup_leads')
    .update(updatePayload)
    .eq('id', leadId)

  return { ok: true, lead_id: leadId, status }
}

export async function GET(request: NextRequest) {
  const paymentId = getPaymentIdFromUrl(request)
  const result = await processPayment(paymentId)

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  let paymentId = getPaymentIdFromUrl(request)

  if (!paymentId) {
    try {
      const body = await request.json()
      paymentId = body?.data?.id || body?.id || body?.payment_id || ''
    } catch {}
  }

  const result = await processPayment(String(paymentId || ''))

  return NextResponse.json(result)
}
