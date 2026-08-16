import { after, NextRequest, NextResponse } from 'next/server'
import {
  recordCustomerPortalAccess,
  resolveCustomerPortalOrder,
} from '@/lib/customer-portal/access.server'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

const privateHeaders = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
}

function unavailable() {
  return NextResponse.json(
    { error: 'Não foi possível acessar este acompanhamento.' },
    { status: 404, headers: privateHeaders },
  )
}

export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: 'customer-portal-resolve',
      limit: 30,
      windowSeconds: 300,
    })
    if (blocked) {
      for (const [key, value] of Object.entries(privateHeaders)) {
        blocked.headers.set(key, value)
      }
      return blocked
    }

    const body = await readJsonBody<{ token?: unknown }>(request, 4096)
    const resolved = await resolveCustomerPortalOrder(body.token)
    if (!resolved) return unavailable()

    after(async () => {
      try {
        await recordCustomerPortalAccess(
          resolved.accessId,
          resolved.tokenHash,
        )
      } catch (error) {
        console.error('portal_access_activity_failed', {
          error: error instanceof Error ? error.message : 'unknown_error',
        })
      }
    })

    return NextResponse.json(
      { order: resolved.dto },
      { headers: privateHeaders },
    )
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) {
      for (const [key, value] of Object.entries(privateHeaders)) {
        bodyError.headers.set(key, value)
      }
      return bodyError
    }

    console.error('portal_access_failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })

    return NextResponse.json(
      { error: 'Não foi possível acessar este acompanhamento.' },
      { status: 503, headers: privateHeaders },
    )
  }
}
