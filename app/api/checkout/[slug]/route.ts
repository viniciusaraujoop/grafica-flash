import { NextRequest, NextResponse } from 'next/server'
import {
  createCheckoutPayment,
  getCheckoutCatalog,
} from '@/lib/payments/checkout-service'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

type Context = {
  params: Promise<{ slug: string }>
}

function errorStatus(error: unknown) {
  return Number(
    error && typeof error === 'object' && 'status' in error
      ? (error as { status?: number }).status || 500
      : 500,
  )
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: `checkout-catalog:${slug}`,
      limit: 120,
      windowSeconds: 60,
      failOpen: true,
    })
    if (blocked) return blocked

    return NextResponse.json(await getCheckoutCatalog(slug))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel carregar o checkout.',
      },
      { status: errorStatus(error) },
    )
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: `checkout-create:${slug}`,
      limit: 8,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const idempotencyKey = String(
      request.headers.get('idempotency-key') || '',
    ).trim()

    if (
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      return NextResponse.json(
        { error: 'Chave de idempotencia invalida.' },
        { status: 400 },
      )
    }

    const body = await readJsonBody(request, 160 * 1024)
    return NextResponse.json(
      await createCheckoutPayment(slug, body as never, request),
    )
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel criar o pagamento.',
      },
      { status: errorStatus(error) },
    )
  }
}
