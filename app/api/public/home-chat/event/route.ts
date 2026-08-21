import { NextRequest, NextResponse } from 'next/server'
import {
  ASSISTANT_EVENT_NAMES,
  recordAssistantEvent,
  type AssistantEventName,
} from '@/lib/assistant/analytics'
import { enforceRateLimit } from '@/lib/security/rate-limit'

const PUBLIC_EVENTS = new Set<AssistantEventName>([
  'assistant_open',
  'assistant_quick_action',
  'assistant_demo_opened',
  'assistant_signup_clicked',
  'assistant_whatsapp_clicked',
  'assistant_feedback',
])

function clean(value: unknown, max = 180) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    scope: 'public-assistant-events-v2',
    limit: 80,
    windowSeconds: 3600,
    failOpen: true,
  })
  if (limited) return limited

  try {
    const body = (await request.json()) as Record<string, unknown>
    const eventName = clean(body.eventName, 60) as AssistantEventName
    const sessionId = clean(body.sessionId, 120).replace(/[^a-zA-Z0-9_-]/g, '')

    if (!ASSISTANT_EVENT_NAMES.includes(eventName) || !PUBLIC_EVENTS.has(eventName)) {
      return NextResponse.json({ error: 'Evento não permitido.' }, { status: 400 })
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 400 })
    }

    await recordAssistantEvent({
      eventName,
      sessionId,
      requestId: clean(body.requestId, 64) || undefined,
      pagePath: clean(body.pagePath, 180),
      segment: clean(body.segment, 80),
      recommendedPlan: clean(body.recommendedPlan, 40),
      status: 'ok',
      metadata: {
        rating: body.rating,
        intent: body.intent,
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
        pc: body.pc,
        ref_present: Boolean(body.ref_present),
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })
  }
}
