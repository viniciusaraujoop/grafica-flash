/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { getMercadoPagoPayment, mapMercadoPagoStatus, verifyMercadoPagoWebhookSignature } from '@/lib/mercado-pago'

function extractPaymentId(body: any, url: URL) {
  return String(
    body?.data?.id ||
    body?.id ||
    url.searchParams.get('data.id') ||
    url.searchParams.get('data_id') ||
    url.searchParams.get('id') ||
    ''
  )
}

function parseExternalReference(value: unknown) {
  const parts = String(value || '').split(':')
  if (parts.length === 4 && parts[0] === 'orcaly') {
    return { companyId: parts[1], orderId: parts[2], marketplacePaymentId: parts[3] }
  }
  return { companyId: '', orderId: '', marketplacePaymentId: '' }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const paymentId = extractPaymentId(body, url)
  const marketplacePaymentIdFromUrl = String(url.searchParams.get('marketplace_payment_id') || '')
  const companyIdFromUrl = String(url.searchParams.get('company_id') || '')

  try {
    const signatureOk = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId: paymentId,
      secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    })

    if (!signatureOk) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })

    if (!paymentId) return NextResponse.json({ ok: true, ignored: 'Sem payment id.' })

    let marketplacePayment: any = null

    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {
      const { data } = await supabaseAdmin
        .from('marketplace_payments')
        .select('*')
        .eq('id', marketplacePaymentIdFromUrl)
        .eq('company_id', companyIdFromUrl)
        .maybeSingle()
      marketplacePayment = data
    }

    if (!marketplacePayment) {
      const { data } = await supabaseAdmin
        .from('marketplace_payments')
        .select('*')
        .eq('provider_payment_id', paymentId)
        .maybeSingle()
      marketplacePayment = data
    }

    if (!marketplacePayment?.company_id) {
      return NextResponse.json({ ok: true, ignored: 'Pagamento ainda não registrado no Orçaly.' })
    }

    const { data: setting, error: settingError } = await supabaseAdmin
      .from('marketplace_payment_settings')
      .select('access_token')
      .eq('company_id', marketplacePayment.company_id)
      .eq('provider', 'mercado_pago')
      .maybeSingle()

    if (settingError) throw settingError
    if (!setting?.access_token) throw new Error('Empresa sem access_token Mercado Pago.')

    const mpPayment = await getMercadoPagoPayment(setting.access_token, paymentId)
    const parsedRef = parseExternalReference(mpPayment.external_reference)
    const companyId = parsedRef.companyId || marketplacePayment.company_id
    const orderId = parsedRef.orderId || marketplacePayment.order_id
    const marketplacePaymentId = parsedRef.marketplacePaymentId || marketplacePayment.id
    const mappedStatus = mapMercadoPagoStatus(mpPayment.status)
    const paidAt = mappedStatus === 'paid' ? (mpPayment.date_approved || new Date().toISOString()) : null
    const grossAmount = Number(mpPayment.transaction_amount || marketplacePayment.amount || 0)
    const feeDetails = Array.isArray(mpPayment.fee_details) ? mpPayment.fee_details : []
    const providerFeeAmount = feeDetails.reduce(
      (total: number, fee: any) => total + Math.max(0, Number(fee?.amount || 0)),
      0
    )
    const commissionAmount = Math.max(0, Number(marketplacePayment.commission_amount || 0))
    const reportedNetAmount = Number(mpPayment.transaction_details?.net_received_amount || 0)
    const netAmount = reportedNetAmount > 0
      ? reportedNetAmount
      : Math.max(0, Number((grossAmount - providerFeeAmount - commissionAmount).toFixed(2)))

    await supabaseAdmin
      .from('marketplace_payments')
      .update({
        provider_payment_id: String(mpPayment.id || paymentId),
        provider_status: mpPayment.status || null,
        status: mappedStatus,
        amount: grossAmount,
        provider_fee_amount: Number(providerFeeAmount.toFixed(2)),
        net_amount: Number(netAmount.toFixed(2)),
        raw_payload: mpPayment,
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', marketplacePaymentId)
      .eq('company_id', companyId)

    await supabaseAdmin
      .from('orders')
      .update({
        payment_provider: 'mercado_pago',
        payment_status: mappedStatus,
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('company_id', companyId)

    await supabaseAdmin
      .from('order_payments')
      .update({
        provider: 'mercado_pago',
        provider_payment_id: String(mpPayment.id || paymentId),
        status: mappedStatus,
        paid_amount: mappedStatus === 'paid' ? Number(mpPayment.transaction_amount || 0) : 0,
        remaining_amount: mappedStatus === 'paid' ? 0 : Number(mpPayment.transaction_amount || 0),
      })
      .eq('order_id', orderId)
      .eq('company_id', companyId)

    if (mappedStatus === 'paid') {
      await supabaseAdmin
        .from('marketplace_commissions')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('marketplace_payment_id', marketplacePaymentId)
        .eq('company_id', companyId)
        .neq('status', 'confirmed')
    } else if (['failed', 'canceled', 'refunded', 'charged_back'].includes(mappedStatus)) {
      await supabaseAdmin
        .from('marketplace_commissions')
        .update({ status: mappedStatus, updated_at: new Date().toISOString() })
        .eq('marketplace_payment_id', marketplacePaymentId)
        .eq('company_id', companyId)
        .neq('status', 'confirmed')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {
      await supabaseAdmin
        .from('marketplace_payments')
        .update({ last_error: error instanceof Error ? error.message : 'Erro no webhook.', raw_payload: body })
        .eq('id', marketplacePaymentIdFromUrl)
        .eq('company_id', companyIdFromUrl)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro no webhook Mercado Pago.' }, { status: 500 })
  }
}
