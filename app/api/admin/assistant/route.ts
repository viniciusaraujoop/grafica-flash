import { NextRequest, NextResponse } from 'next/server'
import { requireOfficialPlatformOwner } from '@/lib/platform-admin'

function rangeDays(value: string | null) {
  const parsed = Number(value || 30)
  return [7, 30, 90].includes(parsed) ? parsed : 30
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = String(getKey(item) || '').trim()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }))
}

export async function GET(request: NextRequest) {
  const session = await requireOfficialPlatformOwner(request)
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status })
  }

  const days = rangeDays(new URL(request.url).searchParams.get('days'))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: leads, error: leadsError } = await session.supabaseAdmin
    .from('signup_leads')
    .select('id,created_at,segmento,plano,status,lead_source,converted_company_id,raw_data')
    .eq('lead_source', 'assistant_orcaly')
    .gte('created_at', since)
    .limit(5000)

  if (leadsError) {
    return NextResponse.json({ error: 'Não foi possível carregar os leads do Assistente.' }, { status: 500 })
  }

  const { data: events, error: eventsError } = await session.supabaseAdmin
    .from('assistant_events')
    .select('event_name,session_hash,segment,recommended_plan,tool_name,status,latency_ms,model,prompt_tokens,completion_tokens,metadata,created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (eventsError) {
    return NextResponse.json({
      available: false,
      days,
      reason: 'assistant_events_not_migrated',
      leads: {
        generated: leads?.length || 0,
        converted: (leads || []).filter((lead) => Boolean(lead.converted_company_id)).length,
      },
      message: 'A migration de analytics do Assistente ainda não foi aplicada neste banco.',
    })
  }

  const rows = events || []
  const eventCount = (name: string) => rows.filter((row) => row.event_name === name).length
  const uniqueUsers = new Set(rows.map((row) => row.session_hash).filter(Boolean)).size
  const latencies = rows.map((row) => Number(row.latency_ms || 0)).filter((value) => value > 0)
  const averageLatency = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : 0
  const promptTokens = rows.reduce((sum, row) => sum + Number(row.prompt_tokens || 0), 0)
  const completionTokens = rows.reduce((sum, row) => sum + Number(row.completion_tokens || 0), 0)

  const unanswered = rows
    .filter((row) => row.event_name === 'assistant_unanswered')
    .map((row) => String((row.metadata as Record<string, unknown> | null)?.intent || '').trim())
    .filter(Boolean)

  const feedbackRows = rows.filter((row) => row.event_name === 'assistant_feedback')
  const positive = feedbackRows.filter((row) => (row.metadata as Record<string, unknown> | null)?.rating === 'up').length
  const negative = feedbackRows.filter((row) => (row.metadata as Record<string, unknown> | null)?.rating === 'down').length

  return NextResponse.json({
    available: true,
    days,
    summary: {
      conversations: eventCount('assistant_open'),
      uniqueUsers,
      messages: eventCount('assistant_message_sent') + eventCount('assistant_plan_recommended'),
      demosOpened: eventCount('assistant_demo_opened'),
      planRecommendations: eventCount('assistant_plan_recommended'),
      leadsGenerated: eventCount('assistant_lead_created'),
      signupClicks: eventCount('assistant_signup_clicked'),
      whatsappHandoffs: eventCount('assistant_whatsapp_clicked'),
      providerErrors: eventCount('assistant_provider_error'),
      unanswered: eventCount('assistant_unanswered'),
      averageLatencyMs: averageLatency,
      promptTokens,
      completionTokens,
    },
    funnel: [
      { step: 'Assistente aberto', value: eventCount('assistant_open') },
      { step: 'Conversa iniciada', value: eventCount('assistant_message_sent') + eventCount('assistant_plan_recommended') },
      { step: 'Plano recomendado', value: eventCount('assistant_plan_recommended') },
      { step: 'CTA cadastro', value: eventCount('assistant_signup_clicked') },
      { step: 'Lead criado', value: eventCount('assistant_lead_created') },
    ],
    segments: countBy(rows, (row) => row.segment).slice(0, 10),
    plans: countBy(rows, (row) => row.recommended_plan).slice(0, 10),
    tools: countBy(rows, (row) => row.tool_name).slice(0, 10),
    models: countBy(rows, (row) => row.model).slice(0, 10),
    unanswered: countBy(unanswered, (item) => item).slice(0, 20),
    feedback: { positive, negative, total: feedbackRows.length },
    leads: {
      generated: leads?.length || 0,
      converted: (leads || []).filter((lead) => Boolean(lead.converted_company_id)).length,
      bySegment: countBy(leads || [], (lead) => lead.segmento).slice(0, 10),
      byPlan: countBy(leads || [], (lead) => lead.plano).slice(0, 10),
    },
  })
}
