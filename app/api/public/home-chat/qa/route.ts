import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { openAssistantProviderStream } from '@/lib/assistant/provider'

export const dynamic = 'force-dynamic'

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function readStreamText(response: Response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  while (answer.length < 300) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const chunk = JSON.parse(data)
        const content = chunk?.choices?.[0]?.delta?.content
        if (typeof content === 'string') answer += content
      } catch {
        // Probe only needs to confirm that valid text is emitted.
      }
    }
  }

  try { await reader.cancel() } catch {}
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
      providerStatus: result.failure.status,
      model: result.failure.model || null,
    }, { status: 503 })
  }

  const answer = await readStreamText(result.response)
  return NextResponse.json({
    ok: Boolean(answer),
    provider: result.provider,
    model: result.requestedModel,
    hasConversationalText: Boolean(answer),
    answerPreview: answer,
  }, { status: answer ? 200 : 502 })
}
