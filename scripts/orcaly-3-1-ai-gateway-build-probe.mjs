const credentials = [
  ['oidc', String(process.env.VERCEL_OIDC_TOKEN || '').trim()],
  ['api-key', String(process.env.AI_GATEWAY_API_KEY || '').trim()],
]

function classify(status) {
  if (status === 401) return 'INVALID_CREDENTIAL'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 429) return 'RATE_LIMIT'
  if (status >= 500) return 'PROVIDER'
  return 'INTERNAL'
}

function safeMessage(raw) {
  return String(raw || '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/vck_[A-Za-z0-9_-]+/g, 'vck_[REDACTED]')
    .replace(/[A-Za-z0-9_-]{80,}/g, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

async function runRequest(source, credential, endpoint, init) {
  if (!credential) {
    return {
      source,
      endpoint,
      configured: false,
      ok: false,
      status: null,
      classification: 'NOT_CONFIGURED',
      latency_ms: 0,
      request_id: null,
      error_type: null,
      message: null,
    }
  }

  const startedAt = Date.now()
  try {
    const response = await fetch(`https://ai-gateway.vercel.sh${endpoint}`, {
      ...init,
      headers: {
        authorization: `Bearer ${credential}`,
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(10_000),
    })
    const rawBody = response.ok ? '' : await response.text().catch(() => '')
    let errorType = null
    let message = null
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody)
        errorType = safeMessage(parsed?.error?.type || parsed?.type || '') || null
        message = safeMessage(parsed?.error?.message || parsed?.message || rawBody) || null
      } catch {
        message = safeMessage(rawBody) || null
      }
    }

    return {
      source,
      endpoint,
      configured: true,
      ok: response.ok,
      status: response.status,
      classification: response.ok ? 'OK' : classify(response.status),
      latency_ms: Date.now() - startedAt,
      request_id: response.headers.get('x-request-id') || response.headers.get('x-vercel-id'),
      error_type: errorType,
      message,
    }
  } catch (error) {
    return {
      source,
      endpoint,
      configured: true,
      ok: false,
      status: null,
      classification: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'INTERNAL',
      latency_ms: Date.now() - startedAt,
      request_id: null,
      error_type: error instanceof Error ? error.name : null,
      message: error instanceof Error ? safeMessage(error.message) : null,
    }
  }
}

const results = []
for (const [source, credential] of credentials) {
  results.push(await runRequest(source, credential, '/v1/credits', { method: 'GET' }))
  results.push(await runRequest(source, credential, '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ORCALY_HOME_AI_MODEL || 'openai/gpt-5.6-luna',
      messages: [{ role: 'user', content: 'Responda somente OK.' }],
      max_tokens: 8,
      stream: false,
    }),
  }))
}

console.log('ORCALY_AI_GATEWAY_BUILD_PROBE', JSON.stringify({
  environment: process.env.VERCEL_ENV || null,
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  results,
}))
