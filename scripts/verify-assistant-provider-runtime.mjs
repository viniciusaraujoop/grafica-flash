const isVercelPreview = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview'

if (!isVercelPreview) {
  console.log('Assistente provider runtime probe: SKIP (not Vercel Preview)')
  process.exit(0)
}

const configuredModel = process.env.ORCALY_HOME_AI_MODEL || 'openai/gpt-5.6-luna'
const configuredFallback = process.env.ORCALY_HOME_AI_FALLBACK_MODEL || 'openai/gpt-5.4'

function gatewayModel(value) {
  return value.includes('/') ? value : `openai/${value}`
}

function openAiModel(value) {
  return value.startsWith('openai/') ? value.slice('openai/'.length) : value
}

const candidates = []

// Test deployment-native OIDC independently. A stale explicit Gateway key
// must not prevent us from proving whether OIDC itself is healthy.
if (process.env.VERCEL_OIDC_TOKEN) {
  candidates.push({
    provider: 'vercel-ai-gateway-oidc',
    endpoint: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    apiKey: process.env.VERCEL_OIDC_TOKEN,
    models: [...new Set([gatewayModel(configuredModel), gatewayModel(configuredFallback)])],
  })
}

if (process.env.AI_GATEWAY_API_KEY) {
  candidates.push({
    provider: 'vercel-ai-gateway-api-key',
    endpoint: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    apiKey: process.env.AI_GATEWAY_API_KEY,
    models: [...new Set([gatewayModel(configuredModel), gatewayModel(configuredFallback)])],
  })
}

if (process.env.OPENAI_API_KEY) {
  candidates.push({
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY,
    models: [...new Set([openAiModel(configuredModel), openAiModel(configuredFallback)])],
  })
}

console.log(`Assistente provider runtime probe: configured oidc=${Boolean(process.env.VERCEL_OIDC_TOKEN)} gateway_key=${Boolean(process.env.AI_GATEWAY_API_KEY)} openai=${Boolean(process.env.OPENAI_API_KEY)}`)

if (!candidates.length) {
  console.error('Assistente provider runtime probe: FAIL OPENAI_NOT_CONFIGURED')
  process.exit(1)
}

let lastFailure = 'OPENAI_PROVIDER_ERROR'

for (const candidate of candidates) {
  for (const model of candidate.models) {
    const startedAt = Date.now()
    let response

    try {
      response = await fetch(candidate.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${candidate.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Sonda de saúde do Assistente Orçaly. Responda somente com uma frase curta em português confirmando que consegue responder.',
            },
            {
              role: 'user',
              content: 'Confirme que o provider está operacional.',
            },
          ],
          max_tokens: 40,
          stream: false,
        }),
        signal: AbortSignal.timeout(15000),
      })
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError'
      lastFailure = name === 'TimeoutError' || name === 'AbortError' ? 'OPENAI_TIMEOUT' : 'OPENAI_PROVIDER_ERROR'
      console.error(`Assistente provider runtime probe: candidate FAIL ${lastFailure} provider=${candidate.provider} model=${model}`)
      continue
    }

    const durationMs = Date.now() - startedAt
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      lastFailure = response.status === 401 || response.status === 403
        ? 'OPENAI_AUTH_ERROR'
        : response.status === 429
          ? 'OPENAI_RATE_LIMIT'
          : response.status >= 500
            ? 'OPENAI_PROVIDER_ERROR'
            : 'VALIDATION_ERROR'
      console.error(`Assistente provider runtime probe: candidate FAIL ${lastFailure} provider=${candidate.provider} status=${response.status} model=${model} duration_ms=${durationMs}`)
      if (lastFailure === 'OPENAI_AUTH_ERROR' || lastFailure === 'VALIDATION_ERROR') break
      continue
    }

    const answer = String(payload?.choices?.[0]?.message?.content || '').trim()
    if (!answer) {
      lastFailure = 'PARSER_ERROR'
      console.error(`Assistente provider runtime probe: candidate FAIL PARSER_ERROR provider=${candidate.provider} status=${response.status} model=${model} duration_ms=${durationMs}`)
      continue
    }

    console.log(`Assistente provider runtime probe: PASS provider=${candidate.provider} model=${model} status=${response.status} duration_ms=${durationMs} conversational_text=true`)
    process.exit(0)
  }
}

console.error(`Assistente provider runtime probe: FAIL ${lastFailure} no working provider candidate`)
process.exit(1)
