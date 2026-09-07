import { NextRequest, NextResponse } from 'next/server'
import { processSubscriptionCheckoutWebhook } from '@/lib/subscription-checkout-payment'
import { verifyMercadoPagoWebhookSignature } from '@/lib/mercado-pago'
import { getSubscriptionWebhookSecret } from '@/lib/payments/subscription/mercado-pago'

export const runtime = 'nodejs'

function paymentIdFrom(
  request: NextRequest,
  body: Record<string, unknown>,
) {
  const data =
    body.data &&
    typeof body.data === 'object' &&
    !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {}

  return String(
    data.id ||
      body.id ||
      request.nextUrl.searchParams.get('data.id') ||
      request.nextUrl.searchParams.get('id') ||
      '',
  ).trim()
}

export async function POST(request: NextRequest) {
  try {
    const secret = getSubscriptionWebhookSecret()

    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook nao configurado.' },
        { status: 503 },
      )
    }

    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>
    const paymentId = paymentIdFrom(request, body)
    const valid = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId: paymentId || null,
      secret,
    })

    if (!valid) {
      return NextResponse.json(
        { error: 'Assinatura invalida.' },
        { status: 401 },
      )
    }

    return NextResponse.json(
      await processSubscriptionCheckoutWebhook(paymentId),
    )
  } catch (error) {
    console.error(
      'orcaly_subscription_checkout_webhook_error',
      error instanceof Error ? error.message : error,
    )

    return NextResponse.json(
      { error: 'Nao foi possivel processar o webhook.' },
      { status: 500 },
    )
  }
}
