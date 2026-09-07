import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CredentialKind = 'oidc' | 'api-key'

type ProbeResult = {
  configured: boolean
  source: CredentialKind
  ok: boolean
  status: number | null
  classification: 'OK' | 'NOT_CONFIGURED' | 'AUTH' | 'RATE_LIMIT' | 'PROVIDER' | 'TIMEOUT' | 'INTERNAL'
  latency_ms: number
  request_id: string | null
}

function classify(status: number) {
  if (status === 401 || status === 403) return 'AUTH' as const
  if (status === 429) return 'RATE_LIMIT' as const
  if (status >= 500) return 'PROVIDER' as const
  return 'INTERNAL' as const
}

async function probe(kind: CredentialKind, credential: string): Promise<ProbeResult> {
  if (!credential) {
    return {
      configured: false,
      source: kind,
      ok: false,
      status: null,
      classification: 'NOT_CONFIGURED',
      latency_ms: 0,
      request_id: null,
    }
  }

  const startedAt = Date.now()
  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credential}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ORCALY_HOME_AI_MODEL || 'openai/gpt-5.6-luna',
        messages: [
          { role: 'system', content: 'Responda somente OK.' },
          { role: 'user', content: 'healthcheck' },
        ],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    return {
      configured: true,
      source: kind,
      ok: response.ok,
      status: response.status,
      classification: response.ok ? 'OK' : classify(response.status),
      latency_ms: Date.now() - startedAt,
      request_id: response.headers.get('x-request-id') || response.headers.get('x-vercel-id'),
    }
  } catch (error) {
    return {
      configured: true,
      source: kind,
      ok: false,
      status: null,
      classification: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'INTERNAL',
      latency_ms: Date.now() - startedAt,
      request_id: null,
    }
  }
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const oidc = String(process.env.VERCEL_OIDC_TOKEN || '').trim()
  const apiKey = String(process.env.AI_GATEWAY_API_KEY || '').trim()
  const results = await Promise.all([
    probe('oidc', oidc),
    probe('api-key', apiKey),
  ])

  return NextResponse.json(
    {
      environment: 'preview',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      provider: 'vercel-ai-gateway',
      results,
    },
    {
      headers: {
        'cache-control': 'private, no-store, no-cache, max-age=0',
      },
    },
  )
}
