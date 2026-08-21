import 'server-only'

export type AssistantProviderErrorType =
  | 'OPENAI_NOT_CONFIGURED'
  | 'OPENAI_AUTH_ERROR'
  | 'OPENAI_RATE_LIMIT'
  | 'OPENAI_TIMEOUT'
  | 'OPENAI_PROVIDER_ERROR'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'

export type AssistantProviderFailure = {
  errorType: AssistantProviderErrorType
  provider: 'vercel-ai-gateway' | 'openai' | 'none'
  status: number
  model: string
  durationMs: number
}

export type AssistantProviderStream = {
  ok: true
  response: Response
  provider: 'vercel-ai-gateway' | 'openai'
  requestedModel: string
  durationMs: number
}

export type AssistantProviderOpenResult =
  | AssistantProviderStream
  | { ok: false; failure: AssistantProviderFailure }

type ChatMessage = {
  role: 'system' | 'assistant' | 'user'
  content: string
}

type ProviderCandidate = {
  provider: 'vercel-ai-gateway' | 'openai'
  endpoint: string
  apiKey: string
  models: string[]
}

function normalizeGatewayModel(value: string) {
  const model = value.trim()
  if (!model) return 'openai/gpt-5.6-luna'
  return model.includes('/') ? model : `openai/${model}`
}

function normalizeOpenAiModel(value: string) {
  const model = value.trim()
  if (!model) return 'gpt-5.6-luna'
  return model.startsWith('openai/') ? model.slice('openai/'.length) : model
}

function classifyStatus(status: number): AssistantProviderErrorType {
  if (status === 401 || status === 403) return 'OPENAI_AUTH_ERROR'
  if (status === 429) return 'OPENAI_RATE_LIMIT'
  if (status === 408 || status === 504) return 'OPENAI_TIMEOUT'
  if (status === 400 || status === 404 || status === 422) return 'VALIDATION_ERROR'
  if (status >= 500) return 'OPENAI_PROVIDER_ERROR'
  return 'OPENAI_PROVIDER_ERROR'
}

function providerCandidates() {
  const configuredModel = process.env.ORCALY_HOME_AI_MODEL || 'openai/gpt-5.6-luna'
  const configuredFallback = process.env.ORCALY_HOME_AI_FALLBACK_MODEL || 'openai/gpt-5.4'
  const candidates: ProviderCandidate[] = []

  // Raw AI Gateway REST calls require the Gateway credential. VERCEL_OIDC_TOKEN
  // is intentionally not used here: production logs proved it returns 401 in
  // this integration path.
  if (process.env.AI_GATEWAY_API_KEY) {
    candidates.push({
      provider: 'vercel-ai-gateway',
      endpoint: 'https://ai-gateway.vercel.sh/v1/chat/completions',
      apiKey: process.env.AI_GATEWAY_API_KEY,
      models: Array.from(new Set([
        normalizeGatewayModel(configuredModel),
        normalizeGatewayModel(configuredFallback),
      ])),
    })
  }

  // The project already supports OPENAI_API_KEY for other server-side AI
  // functionality. When present, use it as a real provider fallback rather
  // than pretending the assistant worked with a static response.
  if (process.env.OPENAI_API_KEY) {
    candidates.push({
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      models: Array.from(new Set([
        normalizeOpenAiModel(configuredModel),
        normalizeOpenAiModel(configuredFallback),
      ])),
    })
  }

  return candidates
}

function safeProviderLog(input: {
  requestId: string
  failure: AssistantProviderFailure
}) {
  console.error('assistant_provider_error', JSON.stringify({
    request_id: input.requestId,
    error_type: input.failure.errorType,
    provider: input.failure.provider,
    provider_status: input.failure.status,
    model: input.failure.model,
    duration_ms: input.failure.durationMs,
  }))
}

export async function openAssistantProviderStream(input: {
  requestId: string
  messages: ChatMessage[]
}) : Promise<AssistantProviderOpenResult> {
  const candidates = providerCandidates()

  if (!candidates.length) {
    const failure: AssistantProviderFailure = {
      errorType: 'OPENAI_NOT_CONFIGURED',
      provider: 'none',
      status: 0,
      model: '',
      durationMs: 0,
    }
    safeProviderLog({ requestId: input.requestId, failure })
    return { ok: false, failure }
  }

  let lastFailure: AssistantProviderFailure = {
    errorType: 'INTERNAL_ERROR',
    provider: 'none',
    status: 0,
    model: '',
    durationMs: 0,
  }

  for (const candidate of candidates) {
    for (const model of candidate.models) {
      const startedAt = Date.now()
      try {
        const response = await fetch(candidate.endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${candidate.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: input.messages,
            max_tokens: 450,
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: AbortSignal.timeout(14_000),
        })

        const durationMs = Date.now() - startedAt
        if (response.ok && response.body) {
          return {
            ok: true,
            response,
            provider: candidate.provider,
            requestedModel: model,
            durationMs,
          }
        }

        lastFailure = {
          errorType: classifyStatus(response.status),
          provider: candidate.provider,
          status: response.status,
          model,
          durationMs,
        }
        safeProviderLog({ requestId: input.requestId, failure: lastFailure })

        // 400/401/403/404/422 are configuration or contract failures. Trying
        // another model on the same credential only hides the actual problem.
        if (['OPENAI_AUTH_ERROR', 'VALIDATION_ERROR'].includes(lastFailure.errorType)) {
          break
        }
      } catch (error) {
        const durationMs = Date.now() - startedAt
        const name = error instanceof Error ? error.name : ''
        const timeout = name === 'TimeoutError' || name === 'AbortError'
        lastFailure = {
          errorType: timeout ? 'OPENAI_TIMEOUT' : 'OPENAI_PROVIDER_ERROR',
          provider: candidate.provider,
          status: 0,
          model,
          durationMs,
        }
        safeProviderLog({ requestId: input.requestId, failure: lastFailure })
      }
    }
  }

  return { ok: false, failure: lastFailure }
}
