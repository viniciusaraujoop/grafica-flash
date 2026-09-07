import 'server-only'

import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/orcaly-security'

type RateLimitOptions = {
  scope: string
  limit: number
  windowSeconds: number
  identity?: string
  failOpen?: boolean
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Rate limit sem configuracao segura do Supabase.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function keyFor(scope: string, identity: string) {
  return createHash('sha256')
    .update(`orcaly-rate-limit:v1:${scope}:${identity}`)
    .digest('hex')
}

export async function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
) {
  const identity = String(options.identity || getClientIp(request) || 'unknown')
  const key = keyFor(options.scope, identity)

  try {
    const { data, error } = await adminClient().rpc('orcaly_consume_rate_limit', {
      p_key: key,
      p_limit: Math.max(1, Math.floor(options.limit)),
      p_window_seconds: Math.max(1, Math.floor(options.windowSeconds)),
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    const allowed = row?.allowed === true
    const remaining = Math.max(0, Number(row?.remaining || 0))
    const resetAt = row?.reset_at ? new Date(row.reset_at) : null
    const retryAfter = resetAt
      ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
      : options.windowSeconds

    if (!allowed) {
      const response = NextResponse.json(
        { error: 'Muitas tentativas. Aguarde e tente novamente.' },
        { status: 429 },
      )
      response.headers.set('Retry-After', String(retryAfter))
      response.headers.set('X-RateLimit-Remaining', '0')
      return response
    }

    return null
  } catch (error) {
    console.error(
      'orcaly_rate_limit_error',
      error instanceof Error ? error.message : error,
    )

    if (options.failOpen) return null

    return NextResponse.json(
      { error: 'Protecao temporariamente indisponivel.' },
      { status: 503 },
    )
  }
}
