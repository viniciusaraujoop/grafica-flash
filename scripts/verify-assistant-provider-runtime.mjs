const isVercelPreview = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview'

if (!isVercelPreview) {
  console.log('Assistente provider runtime probe: SKIP (not Vercel Preview)')
  process.exit(0)
}

const gatewayKey = process.env.AI_GATEWAY_API_KEY
const openAiKey = process.env.OPENAI_API_KEY

let provider
let endpoint
let apiKey
let model

if (gatewayKey) {
  provider = 'vercel-ai-gateway'
  endpoint = 'https://ai-gateway.vercel.sh/v1/chat/completions'
  apiKey = gatewayKey
  model = process.env.ORCALY_HOME_AI_MODEL || 'openai/gpt-5.6-luna'
  if (!model.includes('/')) model = `openai/${model}`
} else if (openAiKey) {
  provider = 'openai'
  endpoint = 'https://api.openai.com/v1/chat/completions'
  apiKey = openAiKey
  model = process.env.ORCALY_HOME_AI_MODEL || 'gpt-5.6-luna'
  if (model.startsWith('openai/')) model = model.slice('openai/'.length)
} else {
  console.error('Assistente provider runtime probe: FAIL OPENAI_NOT_CONFIGURED')
  process.exit(1)
}

const startedAt = Date.now()
let response

try {
  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
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
  console.error(`Assistente provider runtime probe: FAIL ${name} provider=${provider} model=${model}`)
  process.exit(1)
}

const durationMs = Date.now() - startedAt
const payload = await response.json().catch(() => ({}))

if (!response.ok) {
  const errorType = response.status === 401 || response.status === 403
    ? 'OPENAI_AUTH_ERROR'
    : response.status === 429
      ? 'OPENAI_RATE_LIMIT'
      : response.status >= 500
        ? 'OPENAI_PROVIDER_ERROR'
        : 'VALIDATION_ERROR'
  console.error(`Assistente provider runtime probe: FAIL ${errorType} provider=${provider} status=${response.status} model=${model} duration_ms=${durationMs}`)
  process.exit(1)
}

const answer = String(payload?.choices?.[0]?.message?.content || '').trim()
if (!answer) {
  console.error(`Assistente provider runtime probe: FAIL PARSER_ERROR provider=${provider} status=${response.status} model=${model} duration_ms=${durationMs}`)
  process.exit(1)
}

console.log(`Assistente provider runtime probe: PASS provider=${provider} model=${model} status=${response.status} duration_ms=${durationMs} conversational_text=true`)
