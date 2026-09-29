import { randomUUID, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runEventFabricRelay } from '@/lib/event-fabric/relay'
import { runEventFabricWorker } from '@/lib/event-fabric/worker'
import { sanitizeDiagnosticText } from '@/lib/observability/application-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function eventFabricEnabled() {
  return (
    String(process.env.ORCALY_EVENT_FABRIC_ENABLED || '')
      .trim()
      .toLowerCase() === 'true'
  )
}

function bearerSecret(request: NextRequest) {
  const value = String(request.headers.get('authorization') || '')
  const match = /^Bearer\s+([^\s]+)$/i.exec(value)
  return match?.[1] || ''
}

export function timingSafeSecretEqual(expected: string, supplied: string) {
  const expectedBytes = Buffer.from(expected, 'utf8')
  const suppliedBytes = Buffer.from(supplied, 'utf8')
  if (expectedBytes.length !== suppliedBytes.length) return false
  return timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function GET(request: NextRequest) {
  if (!eventFabricEnabled()) {
    return NextResponse.json(
      { ok: false, state: 'disabled' },
      { status: 503 },
    )
  }

  const configuredSecret = String(
    process.env.ORCALY_EVENT_FABRIC_CRON_SECRET || '',
  )

  if (!configuredSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Event Fabric runtime credential is not configured.',
      },
      { status: 503 },
    )
  }

  const suppliedSecret = bearerSecret(request)

  if (
    !suppliedSecret ||
    !timingSafeSecretEqual(configuredSecret, suppliedSecret)
  ) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 },
    )
  }

  // Privileged DB capability is loaded only after gate + dedicated auth.
  const { getSupabaseAdmin } = await import('@/lib/company-access')
  const db = getSupabaseAdmin()
  const invocationId = randomUUID()
  const workerId = 'event-fabric:' + invocationId

  try {
    const startedAt = Date.now()
    const relay = await runEventFabricRelay(db, 20)
    const worker = await runEventFabricWorker(db, workerId, 20)
    const durationMs = Date.now() - startedAt

    console.info(
      JSON.stringify({
        event: 'event_fabric_tick',
        invocationId,
        environment: String(
          process.env.VERCEL_ENV ||
            process.env.NODE_ENV ||
            'unknown',
        ).slice(0, 40),
        relay,
        worker,
        durationMs,
      }),
    )

    return NextResponse.json({
      ok: true,
      invocationId,
      relay,
      worker,
      durationMs,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'event_fabric_tick_failed',
        invocationId,
        reason: sanitizeDiagnosticText(error, 500),
      }),
    )

    return NextResponse.json(
      {
        ok: false,
        invocationId,
        error: 'Event Fabric execution failed.',
      },
      { status: 500 },
    )
  }
}
