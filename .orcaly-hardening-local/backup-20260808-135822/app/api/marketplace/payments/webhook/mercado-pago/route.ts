/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { getMarketplaceWebhookSecret } from '@/lib/payments/marketplace/config'
import {
  getMercadoPagoPayment,
  mapMercadoPagoStatus,
  unprotectMercadoPagoToken,
  verifyMercadoPagoWebhookSignature,
} from '@/lib/mercado-pago'

function extractPaymentId(body: any, url: URL) {
  return String(
    body?.data?.id ||
      body?.id ||
      url.searchParams.get('data.id') ||
      url.searchParams.get('data_id') ||
      url.searchParams.get('id') ||
      '',
  )
}

function parseExternalReference(value: unknown) {
  const parts = String(value || '').split(':')
  if (parts.length === 4 && parts[0] === 'orcaly') {
    return {
      companyId: parts[1],
      orderId: parts[2],
      marketplacePaymentId: parts[3],
    }
  }

  return {
    companyId: '',
    orderId: '',
    marketplacePaymentId: '',
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const paymentId = extractPaymentId(body, url)
  const marketplacePaymentIdFromUrl = String(
    url.searchParams.get('marketplace_payment_id') || '',
  )
  const companyIdFromUrl = String(
    url.searchParams.get('company_id') || '',
  )

  try {
    const secret = getMarketplaceWebhookSecret()

    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook nao configurado.' },
        { status: 503 },
      )
    }

    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    const signatureDataIdRaw = String(
      url.searchParams.get('data.id') ||
        url.searchParams.get('data_id') ||
        paymentId ||
        '',
    )
    const signatureDataId = /[a-z]/i.test(signatureDataIdRaw)
      ? signatureDataIdRaw.toLowerCase()
      : signatureDataIdRaw

    if (!xSignature || !xRequestId) {
      return NextResponse.json({
        ok: true,
        ignored: 'Notificacao legada sem assinatura.',
      })
    }

    const signatureOk = verifyMercadoPagoWebhookSignature({
      xSignature,
      xRequestId,
      dataId: signatureDataId,
      secret,
    })

    if (!signatureOk) {
      return NextResponse.json(
        { error: 'Assinatura invalida.' },
        { status: 401 },
      )
    }

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: 'Sem payment id.' })
    }

    let marketplacePayment: any = null

    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {
      const { data } = await supabaseAdmin
        .from('marketplace_payments')
        .select('*')
        .eq('id', marketplacePaymentIdFromUrl)
        .eq('company_id', companyIdFromUrl)
        .eq('provider', 'mercado_pago')
        .maybeSingle()
      marketplacePayment = data
    }

    if (!marketplacePayment) {
      const { data } = await supabaseAdmin
        .from('marketplace_payments')
        .select('*')
        .eq('provider', 'mercado_pago')
        .eq('provider_payment_id', paymentId)
        .maybeSingle()
      marketplacePayment = data
    }

    if (!marketplacePayment?.company_id) {
      return NextResponse.json({
        ok: true,
        ignored: 'Pagamento ainda nao registrado no Orcaly.',
      })
    }

    if (
      marketplacePayment.provider_payment_id &&
      String(marketplacePayment.provider_payment_id) !== paymentId
    ) {
      return NextResponse.json(
        { error: 'Pagamento divergente.' },
        { status: 409 },
      )
    }

    const { data: setting, error: settingError } = await supabaseAdmin
      .from('marketplace_payment_settings')
      .select('access_token')
      .eq('company_id', marketplacePayment.company_id)
      .eq('provider', 'mercado_pago')
      .maybeSingle()

    if (settingError) throw settingError
    if (!setting?.access_token) {
      throw new Error('Empresa sem access_token Mercado Pago.')
    }

    const mpPayment: any = await getMercadoPagoPayment(
      unprotectMercadoPagoToken(setting.access_token),
      paymentId,
    )
    const parsed = parseExternalReference(mpPayment.external_reference)

    if (
      parsed.companyId &&
      parsed.companyId !== String(marketplacePayment.company_id)
    ) {
      return NextResponse.json(
        { error: 'Empresa divergente no pagamento.' },
        { status: 409 },
      )
    }

    if (
      parsed.orderId &&
      parsed.orderId !== String(marketplacePayment.order_id)
    ) {
      return NextResponse.json(
        { error: 'Pedido divergente no pagamento.' },
        { status: 409 },
      )
    }

    if (
      parsed.marketplacePaymentId &&
      parsed.marketplacePaymentId !== String(marketplacePayment.id)
    ) {
      return NextResponse.json(
        { error: 'Transacao divergente.' },
        { status: 409 },
      )
    }

    const companyId = String(marketplacePayment.company_id)
    const orderId = String(marketplacePayment.order_id)
    const marketplacePaymentId = String(marketplacePayment.id)
    const mappedStatus = mapMercadoPagoStatus(
      String(mpPayment.status || ''),
    )
    const paidAt =
      mappedStatus === 'paid'
        ? mpPayment.date_approved || new Date().toISOString()
        : null
    const grossAmount = Number(
      mpPayment.transaction_amount ||
        marketplacePayment.amount ||
        0,
    )
    const feeDetails = Array.isArray(mpPayment.fee_details)
      ? mpPayment.fee_details
      : []
    const chargesDetails = Array.isArray(mpPayment.charges_details)
      ? mpPayment.charges_details
      : []
    const applicationFeeFromFees = feeDetails.reduce(
      (total: number, fee: any) =>
        String(fee?.type || '').toLowerCase() === 'application_fee'
          ? total + Math.max(0, Number(fee?.amount || 0))
          : total,
      0,
    )
    const applicationFeeFromCharges = chargesDetails.reduce(
      (total: number, charge: any) => {
        const name = String(charge?.name || '').toLowerCase()
        const from = String(charge?.accounts?.from || '').toLowerCase()
        const to = String(charge?.accounts?.to || '').toLowerCase()

        if (
          name !== 'third_payment' ||
          from !== 'collector' ||
          to !== 'marketplace_owner'
        ) {
          return total
        }

        return total + Math.max(
          0,
          Number(charge?.amounts?.original || 0),
        )
      },
      0,
    )
    const applicationFeeAmount = Math.max(
      applicationFeeFromFees,
      applicationFeeFromCharges,
    )
    const providerFeeAmount = feeDetails.reduce(
      (total: number, fee: any) =>
        String(fee?.type || '').toLowerCase() !== 'application_fee'
          ? total + Math.max(0, Number(fee?.amount || 0))
          : total,
      0,
    )
    const expectedCommissionAmount = Math.max(
      0,
      Number(
        marketplacePayment.platform_fee_amount ||
          marketplacePayment.commission_amount ||
          0,
      ),
    )
    const reportedNetAmount = Number(
      mpPayment.transaction_details?.net_received_amount || 0,
    )
    const sellerNetAmount =
      reportedNetAmount > 0
        ? Number(reportedNetAmount.toFixed(2))
        : Math.max(
            0,
            Number(
              (
                grossAmount -
                providerFeeAmount -
                applicationFeeAmount
              ).toFixed(2),
            ),
          )
    const splitApplied =
      mappedStatus !== 'paid' ||
      expectedCommissionAmount <= 0 ||
      (
        applicationFeeAmount > 0 &&
        applicationFeeAmount + 0.005 >=
          expectedCommissionAmount
      )
    const splitStatus =
      mappedStatus === 'paid'
        ? splitApplied
          ? 'applied'
          : 'missing'
        : 'pending'
    const effectiveStatus =
      mappedStatus === 'paid' && !splitApplied
        ? 'pending'
        : mappedStatus
    const effectivePaidAt =
      effectiveStatus === 'paid'
        ? paidAt
        : null

    const { error: stockError } = await supabaseAdmin.rpc(
      'settle_marketplace_stock',
      {
        p_company_id: companyId,
        p_marketplace_payment_id: marketplacePaymentId,
        p_payment_status: effectiveStatus,
        p_reason: splitApplied
          ? String(mpPayment.status || effectiveStatus)
          : 'payment_paid_without_confirmed_application_fee',
      },
    )

    if (stockError) throw stockError

    await Promise.all([
      supabaseAdmin
        .from('marketplace_payments')
        .update({
          provider_payment_id: String(mpPayment.id || paymentId),
          provider_status: String(mpPayment.status || '') || null,
          status: effectiveStatus,
          amount: grossAmount,
          provider_fee_amount: Number(providerFeeAmount.toFixed(2)),
          provider_net_amount: sellerNetAmount,
          platform_fee_amount: Number(applicationFeeAmount.toFixed(2)),
          seller_net_amount: sellerNetAmount,
          split_status: splitStatus,
          last_error:
            mappedStatus === 'paid' && !splitApplied
              ? 'Pagamento aprovado sem confirmaÃ§Ã£o da taxa do marketplace.'
              : null,
          raw_payload: mpPayment,
          paid_at: effectivePaidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', marketplacePaymentId)
        .eq('company_id', companyId),
      supabaseAdmin
        .from('orders')
        .update({
          payment_provider: 'mercado_pago',
          payment_status: effectiveStatus,
          status:
            effectiveStatus === 'paid'
              ? 'Recebido'
              : 'pending_payment',
          paid_at: effectivePaidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('company_id', companyId),
      supabaseAdmin
        .from('order_payments')
        .update({
          provider: 'mercado_pago',
          provider_payment_id: String(mpPayment.id || paymentId),
          status: effectiveStatus,
          paid_amount:
            effectiveStatus === 'paid'
              ? Number(mpPayment.transaction_amount || 0)
              : 0,
          remaining_amount:
            effectiveStatus === 'paid'
              ? 0
              : Number(mpPayment.transaction_amount || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('company_id', companyId),
    ])

    if (mappedStatus === 'paid' && splitApplied) {
      const { error: couponError } = await supabaseAdmin.rpc(
        'consume_marketplace_coupon',
        {
          p_company_id: companyId,
          p_order_id: orderId,
        },
      )

      if (couponError) throw couponError

      await supabaseAdmin
        .from('marketplace_commissions')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('marketplace_payment_id', marketplacePaymentId)
        .eq('company_id', companyId)
        .neq('status', 'confirmed')
    } else if (
      ['failed', 'canceled', 'refunded', 'charged_back'].includes(
        mappedStatus,
      )
    ) {
      await supabaseAdmin
        .from('marketplace_commissions')
        .update({
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('marketplace_payment_id', marketplacePaymentId)
        .eq('company_id', companyId)
        .neq('status', 'confirmed')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {
      await supabaseAdmin
        .from('marketplace_payments')
        .update({
          last_error:
            error instanceof Error
              ? error.message
              : 'Erro no webhook.',
          raw_payload: body,
        })
        .eq('id', marketplacePaymentIdFromUrl)
        .eq('company_id', companyIdFromUrl)
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro no webhook Mercado Pago.',
      },
      { status: 500 },
    )
  }
}
