const credentials = [
  ['oidc', String(process.env.VERCEL_OIDC_TOKEN || '').trim()],
  ['api-key', String(process.env.AI_GATEWAY_API_KEY || '').trim()],
]

function classify(status) {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 429) return 'RATE_LIMIT'
  if (status >= 500) return 'PROVIDER'
  return 'INTERNAL'
}

async function probe(source, credential) {
  if (!credential) {
    return { source, configured: false, ok: false, status: null, classification: 'NOT_CONFIGURED', latency_ms: 0, request_id: null }
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
        messages: [{ role: 'user', content: 'Responda somente OK.' }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    return {
      source,
      configured: true,
      ok: response.ok,
      status: response.status,
      classification: response.ok ? 'OK' : classify(response.status),
      latency_ms: Date.now() - startedAt,
      request_id: response.headers.get('x-request-id') || response.headers.get('x-vercel-id'),
    }
  } catch (error) {
    return {
      source,
      configured: true,
      ok: false,
      status: null,
      classification: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'INTERNAL',
      latency_ms: Date.now() - startedAt,
      request_id: null,
    }
  }
}

const results = []
for (const [source, credential] of credentials) {
  results.push(await probe(source, credential))
}

console.log('ORCALY_AI_GATEWAY_BUILD_PROBE', JSON.stringify({
  environment: process.env.VERCEL_ENV || null,
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  results,
}))
