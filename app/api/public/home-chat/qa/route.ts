import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { openAssistantProviderStream } from '@/lib/assistant/provider'

export const dynamic = 'force-dynamic'

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function readStreamText(stream: AsyncIterable<string>) {
  let answer = ''
  for await (const chunk of stream) {
    answer += chunk
    if (answer.length >= 300) break
  }
  return answer.trim().slice(0, 300)
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') return notFound()
  if (request.nextUrl.searchParams.get('probe') !== 'assistant-runtime-v2') return notFound()

  const result = await openAssistantProviderStream({
    requestId: randomUUID(),
    messages: [
      {
        role: 'system',
        content: 'Você está executando uma sonda de saúde. Responda em português com uma frase curta confirmando que o provider de IA está operacional.',
      },
      {
        role: 'user',
        content: 'Confirme que você consegue responder a uma mensagem conversacional.',
      },
    ],
  })

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      errorType: result.failure.errorType,
      provider: result.failure.provider,
      authMode: result.failure.authMode,
      providerStatus: result.failure.status,
      model: result.failure.model || null,
    }, { status: 503 })
  }

  const answer = await readStreamText(result.textStream)
  return NextResponse.json({
    ok: Boolean(answer),
    provider: result.provider,
    authMode: result.authMode,
    model: result.requestedModel,
    hasConversationalText: Boolean(answer),
    answerPreview: answer,
  }, { status: answer ? 200 : 502 })
}
