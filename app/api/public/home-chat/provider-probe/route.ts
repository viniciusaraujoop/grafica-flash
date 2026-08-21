import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { openAssistantProviderStream } from '@/lib/assistant/provider'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    scope: 'assistant-provider-probe',
    limit: 3,
    windowSeconds: 3600,
    failOpen: false,
  })
  if (limited) return limited

  const requestId = randomUUID()
  const result = await openAssistantProviderStream({
    requestId,
    messages: [
      {
        role: 'system',
        content: 'Responda em português do Brasil e em uma frase curta. Não inclua links.',
      },
      {
        role: 'user',
        content: 'Diga apenas que o Assistente Orçaly está operacional.',
      },
    ],
  })

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      requestId,
      errorType: result.failure.errorType,
      provider: result.failure.provider,
      authMode: result.failure.authMode,
      status: result.failure.status,
      model: result.failure.model,
      durationMs: result.failure.durationMs,
    }, { status: 503 })
  }

  let answer = ''
  try {
    for await (const chunk of result.textStream) {
      answer += chunk
      if (answer.length >= 180) break
    }
  } catch {
    return NextResponse.json({
      ok: false,
      requestId,
      errorType: 'OPENAI_PROVIDER_ERROR',
      provider: result.provider,
      authMode: result.authMode,
      model: result.requestedModel,
      durationMs: result.durationMs,
    }, { status: 503 })
  }

  return NextResponse.json({
    ok: Boolean(answer.trim()),
    requestId,
    provider: result.provider,
    authMode: result.authMode,
    model: result.requestedModel,
    durationMs: result.durationMs,
    answer: answer.trim().slice(0, 180),
  }, { status: answer.trim() ? 200 : 503 })
}
