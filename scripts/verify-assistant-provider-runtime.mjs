import { generateText } from 'ai'

const isVercelPreview = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview'

if (!isVercelPreview) {
  console.log('Assistente provider runtime probe: SKIP (not Vercel Preview)')
  process.exit(0)
}

const model = process.env.ORCALY_HOME_AI_MODEL || 'openai/gpt-5.6-sol'
const fallbackModel = process.env.ORCALY_HOME_AI_FALLBACK_MODEL || 'openai/gpt-5.4'

function statusFromError(error) {
  if (!error || typeof error !== 'object') return 0
  const response = error.response && typeof error.response === 'object' ? error.response : null
  const status = Number(error.statusCode || error.status || response?.status || 0)
  return Number.isFinite(status) ? status : 0
}

function classify(error) {
  const status = statusFromError(error)
  if (status === 401 || status === 403) return 'OPENAI_AUTH_ERROR'
  if (status === 429) return 'OPENAI_RATE_LIMIT'
  if (status === 408 || status === 504) return 'OPENAI_TIMEOUT'
  if ([400, 404, 422].includes(status)) return 'VALIDATION_ERROR'
  if (status >= 500) return 'OPENAI_PROVIDER_ERROR'
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('timeout')) return 'OPENAI_TIMEOUT'
  if (message.includes('api key') || message.includes('authentication') || message.includes('unauthorized')) return 'OPENAI_AUTH_ERROR'
  return 'OPENAI_PROVIDER_ERROR'
}

const startedAt = Date.now()

try {
  const result = await generateText({
    model,
    prompt: 'Sonda de saúde do Assistente Orçaly. Responda somente com uma frase curta em português confirmando que consegue responder.',
    maxOutputTokens: 40,
    abortSignal: AbortSignal.timeout(15_000),
    providerOptions: {
      gateway: {
        models: fallbackModel === model ? [] : [fallbackModel],
        disallowPromptTraining: true,
      },
    },
  })

  const answer = String(result.text || '').trim()
  if (!answer) {
    console.error(`Assistente provider runtime probe: FAIL PARSER_ERROR provider=vercel-ai-gateway-sdk model=${model}`)
    process.exit(1)
  }

  console.log(`Assistente provider runtime probe: PASS provider=vercel-ai-gateway-sdk model=${model} duration_ms=${Date.now() - startedAt} conversational_text=true`)
} catch (error) {
  const errorType = classify(error)
  const status = statusFromError(error)
  console.error(`Assistente provider runtime probe: FAIL ${errorType} provider=vercel-ai-gateway-sdk status=${status} model=${model} duration_ms=${Date.now() - startedAt}`)
  process.exit(1)
}
