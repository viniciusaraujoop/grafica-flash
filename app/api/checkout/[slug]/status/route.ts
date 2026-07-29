import { NextRequest, NextResponse } from 'next/server'
import { getCheckoutPaymentStatus } from '@/lib/payments/checkout-service'
import { enforceRateLimit } from '@/lib/security/rate-limit'

type Context = {
  params: Promise<{ slug: string }>
}

function statusFor(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status?: number }).status || 500)
  }

  return 500
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: `checkout-status:${slug}`,
      limit: 90,
      windowSeconds: 60,
      failOpen: true,
    })
    if (blocked) return blocked

    const paymentId = String(
      request.nextUrl.searchParams.get('paymentId') || '',
    ).trim()

    if (!/^\d{1,32}$/.test(paymentId)) {
      return NextResponse.json(
        { error: 'Pagamento invalido.' },
        { status: 400 },
      )
    }

    return NextResponse.json(
      await getCheckoutPaymentStatus(slug, paymentId),
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel consultar o pagamento.',
      },
      { status: statusFor(error) },
    )
  }
}
