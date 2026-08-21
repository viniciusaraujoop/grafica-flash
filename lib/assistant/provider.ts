import 'server-only'

import { gateway, streamText } from 'ai'

export type AssistantProviderErrorType =
  | 'OPENAI_NOT_CONFIGURED'
  | 'OPENAI_AUTH_ERROR'
  | 'OPENAI_RATE_LIMIT'
  | 'OPENAI_TIMEOUT'
  | 'OPENAI_PROVIDER_ERROR'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'

export type AssistantProviderAuthMode = 'api-key' | 'managed' | 'none'

export type AssistantProviderFailure = {
  errorType: AssistantProviderErrorType
  provider: 'vercel-ai-gateway' | 'none'
  authMode: AssistantProviderAuthMode
  status: number
  model: string
  durationMs: number
}

export type AssistantProviderStream = {
  ok: true
  provider: 'vercel-ai-gateway'
  authMode: Exclude<AssistantProviderAuthMode, 'none'>
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

type FullStreamPart = {
  type?: string
  text?: string
  textDelta?: string
  error?: unknown
}

const DEFAULT_MODEL = 'openai/gpt-5.6-sol'
const DEFAULT_FALLBACK_MODEL = 'openai/gpt-5.4'
const LEGACY_MODEL_IDS = new Set(['gpt-5.6-luna', 'openai/gpt-5.6-luna'])

function gatewayModel(value: string) {
  const model = value.trim()
  if (!model || LEGACY_MODEL_IDS.has(model)) return DEFAULT_MODEL
  return model.includes('/') ? model : `openai/${model}`
}

function configuredAuthMode(): AssistantProviderAuthMode {
  if (process.env.AI_GATEWAY_API_KEY) return 'api-key'
  if (process.env.VERCEL_OIDC_TOKEN) return 'managed'
  return 'none'
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
  if (
    message.includes('api key') ||
    message.includes('authentication') ||
    message.includes('unauthenticated') ||
    message.includes('unauthorized')
  ) {
    return 'OPENAI_AUTH_ERROR'
  }
  if (message.includes('invalid prompt') || message.includes('invalid') || message.includes('schema')) {
    return 'VALIDATION_ERROR'
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

function textFromPart(part: FullStreamPart) {
  if (part.type !== 'text-delta') return ''
  return String(part.text ?? part.textDelta ?? '')
}

async function firstTextChunk(iterator: AsyncIterator<unknown>) {
  while (true) {
    const next = await iterator.next()
    if (next.done) return { done: true as const, text: '' }
    const part = (next.value || {}) as FullStreamPart
    if (part.type === 'error') throw part.error || new Error('Provider stream error')
    const text = textFromPart(part)
    if (text) return { done: false as const, text }
  }
}

function remainingTextStream(
  firstText: string,
  iterator: AsyncIterator<unknown>,
): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      yield firstText
      while (true) {
        const next = await iterator.next()
        if (next.done) return
        const part = (next.value || {}) as FullStreamPart
        if (part.type === 'error') throw part.error || new Error('Provider stream error')
        const text = textFromPart(part)
        if (text) yield text
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
  const authMode = configuredAuthMode()

  if (authMode === 'none') {
    const failure: AssistantProviderFailure = {
      errorType: 'OPENAI_NOT_CONFIGURED',
      provider: 'none',
      authMode,
      status: 0,
      model: requestedModel,
      durationMs: Date.now() - startedAt,
    }
    safeProviderLog({ requestId: input.requestId, failure })
    return { ok: false, failure }
  }

  const instructions = input.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
  const messages = input.messages
    .filter((message): message is ChatMessage & { role: 'assistant' | 'user' } => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }))

  try {
    // AI SDK Gateway reads AI_GATEWAY_API_KEY when configured and can use
    // deployment OIDC when VERCEL_OIDC_TOKEN is available. Application code
    // never forwards either credential to the browser or logs its value.
    const result = streamText({
      model: gateway(requestedModel),
      instructions: instructions || undefined,
      messages,
      maxOutputTokens: 450,
      abortSignal: AbortSignal.timeout(14_000),
      providerOptions: {
        gateway: {
          models: fallbackModel === requestedModel ? [] : [fallbackModel],
          disallowPromptTraining: true,
        },
      },
    })

    const iterator = result.fullStream[Symbol.asyncIterator]()
    const first = await firstTextChunk(iterator)
    if (first.done || !first.text) {
      const failure: AssistantProviderFailure = {
        errorType: 'VALIDATION_ERROR',
        provider: 'vercel-ai-gateway',
        authMode,
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
      authMode,
      requestedModel,
      durationMs: Date.now() - startedAt,
      textStream: remainingTextStream(first.text, iterator),
    }
  } catch (error) {
    const failure: AssistantProviderFailure = {
      errorType: classifyError(error),
      provider: 'vercel-ai-gateway',
      authMode,
      status: statusFromError(error),
      model: requestedModel,
      durationMs: Date.now() - startedAt,
    }
    safeProviderLog({ requestId: input.requestId, failure })
    return { ok: false, failure }
  }
}
