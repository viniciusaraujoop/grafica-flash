import { NextRequest, NextResponse } from 'next/server'
import { prepareCheckoutPayment } from '@/lib/payments/checkout-service'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

type Context = {
  params: Promise<{ slug: string }>
}

function statusFor(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status?: number }).status || 500)
  }

  return 500
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: `checkout-prepare:${slug}`,
      limit: 35,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const body = await readJsonBody(request, 128 * 1024)
    return NextResponse.json(
      await prepareCheckoutPayment(slug, body as never),
    )
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel calcular o checkout.',
      },
      { status: statusFor(error) },
    )
  }
}
