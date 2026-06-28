import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.ORCALY_AI_MODEL || 'gpt-4o-mini'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não configurada.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const body = await request.json()
    const prompt = String(body.prompt || '').trim()

    if (!prompt) {
      return NextResponse.json({ error: 'Digite uma solicitação.' }, { status: 400 })
    }

    const system = [
      'Você é o assistente interno do Orçaly.',
      'Ajude empresas brasileiras a configurar site, catálogo, produtos, cupons, atendimento, propostas e operação.',
      'Responda em português do Brasil.',
      'Seja prático, organizado e pronto para copiar.',
      'Não invente dados sensíveis.',
      'Quando criar produtos, traga nomes, descrições, preços sugeridos e campos úteis.',
    ].join('\n')

    const context = {
      empresa: {
        nome: access.company.nome,
        segmento: access.company.segmento || access.company.modelo_negocio || access.company.site_template,
        cidade: access.company.cidade,
        estado: access.company.estado,
        plano: access.company.assinatura_plano || access.company.plano,
      },
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Contexto da empresa:\n${JSON.stringify(context, null, 2)}\n\nPedido do usuário:\n${prompt}` },
        ],
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message || 'Erro na OpenAI.' },
        { status: 500 }
      )
    }

    const answer = payload.choices?.[0]?.message?.content || ''

    return NextResponse.json({ ok: true, answer })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar assistente.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
