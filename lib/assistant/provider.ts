import 'server-only'

import { streamText } from 'ai'

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
  provider: 'vercel-ai-gateway' | 'none'
  authMode: 'managed' | 'none'
  status: number
  model: string
  durationMs: number
}

export type AssistantProviderStream = {
  ok: true
  provider: 'vercel-ai-gateway'
  authMode: 'managed'
  requestedModel: string
  durationMs: number
  textStream: AsyncIterable<string>
}

export type AssistantProviderOpenResult =
  | AssistantProviderStream
  | { ok: false; failure: AssistantProviderFailure }

type ChatMessage = {
  role: 'system' | 'assistant' | 'user'
  content: string
}

const DEFAULT_MODEL = 'openai/gpt-5.6-sol'
const DEFAULT_FALLBACK_MODEL = 'openai/gpt-5.4'

function gatewayModel(value: string) {
  const model = value.trim()
  if (!model) return DEFAULT_MODEL
  return model.includes('/') ? model : `openai/${model}`
}

function statusFromError(error: unknown) {
  if (!error || typeof error !== 'object') return 0
  const record = error as Record<string, unknown>
  const response = record.response && typeof record.response === 'object'
    ? (record.response as Record<string, unknown>)
    : null
  const candidate = record.statusCode ?? record.status ?? response?.status
  const status = Number(candidate || 0)
  return Number.isFinite(status) ? status : 0
}

function classifyError(error: unknown): AssistantProviderErrorType {
  const status = statusFromError(error)
  if (status === 401 || status === 403) return 'OPENAI_AUTH_ERROR'
  if (status === 429) return 'OPENAI_RATE_LIMIT'
  if (status === 408 || status === 504) return 'OPENAI_TIMEOUT'
  if (status === 400 || status === 404 || status === 422) return 'VALIDATION_ERROR'
  if (status >= 500) return 'OPENAI_PROVIDER_ERROR'

  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (name === 'TimeoutError' || name === 'AbortError' || message.includes('timeout')) {
    return 'OPENAI_TIMEOUT'
  }
  if (message.includes('api key') || message.includes('authentication') || message.includes('unauthorized')) {
    return 'OPENAI_AUTH_ERROR'
  }
  return 'OPENAI_PROVIDER_ERROR'
}

function safeProviderLog(input: {
  requestId: string
  failure: AssistantProviderFailure
}) {
  console.error('assistant_provider_error', JSON.stringify({
    request_id: input.requestId,
    error_type: input.failure.errorType,
    provider: input.failure.provider,
    auth_mode: input.failure.authMode,
    provider_status: input.failure.status,
    model: input.failure.model,
    duration_ms: input.failure.durationMs,
  }))
}

function prependFirstChunk(
  first: IteratorResult<string>,
  iterator: AsyncIterator<string>,
): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      if (!first.done && first.value) yield first.value
      while (true) {
        const next = await iterator.next()
        if (next.done) return
        if (next.value) yield next.value
      }
    },
  }
}

export async function openAssistantProviderStream(input: {
  requestId: string
  messages: ChatMessage[]
}): Promise<AssistantProviderOpenResult> {
  const requestedModel = gatewayModel(process.env.ORCALY_HOME_AI_MODEL || DEFAULT_MODEL)
  const fallbackModel = gatewayModel(
    process.env.ORCALY_HOME_AI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  )
  const startedAt = Date.now()

  try {
    // Model strings use Vercel AI Gateway through the official AI SDK. On a
    // Vercel deployment authentication is managed by the platform instead of
    // manually forwarding AI_GATEWAY_API_KEY/VERCEL_OIDC_TOKEN as raw Bearer
    // credentials, which was the root of the 401/403 incident.
    const result = streamText({
      model: requestedModel,
      messages: input.messages,
      maxOutputTokens: 450,
      abortSignal: AbortSignal.timeout(14_000),
      providerOptions: {
        gateway: {
          models: fallbackModel === requestedModel ? [] : [fallbackModel],
          disallowPromptTraining: true,
        },
      },
    })

    const iterator = result.textStream[Symbol.asyncIterator]()

    // Pull the first chunk before returning the HTTP response. Authentication,
    // invalid-model and immediate provider failures are therefore classified
    // while the route can still return a non-200 status instead of a fake 200.
    const first = await iterator.next()
    if (first.done || !first.value) {
      const failure: AssistantProviderFailure = {
        errorType: 'VALIDATION_ERROR',
        provider: 'vercel-ai-gateway',
        authMode: 'managed',
        status: 0,
        model: requestedModel,
        durationMs: Date.now() - startedAt,
      }
      safeProviderLog({ requestId: input.requestId, failure })
      return { ok: false, failure }
    }

    return {
      ok: true,
      provider: 'vercel-ai-gateway',
      authMode: 'managed',
      requestedModel,
      durationMs: Date.now() - startedAt,
      textStream: prependFirstChunk(first, iterator),
    }
  } catch (error) {
    const failure: AssistantProviderFailure = {
      errorType: classifyError(error),
      provider: 'vercel-ai-gateway',
      authMode: 'managed',
      status: statusFromError(error),
      model: requestedModel,
      durationMs: Date.now() - startedAt,
    }
    safeProviderLog({ requestId: input.requestId, failure })
    return { ok: false, failure }
  }
}
