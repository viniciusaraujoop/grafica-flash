import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog } from '@/lib/orcaly-audit'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.ORCALY_AI_MODEL || 'gpt-4o-mini'

    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada.' }, { status: 500 })
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
    const nome = String(body.nome || '').trim()
    const categoria = String(body.categoria || '').trim()
    const tipo = String(body.tipo || 'produto').trim()
    const objetivo = String(body.objetivo || 'descricao').trim()

    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome do produto/serviço.' }, { status: 400 })
    }

    const system = [
      'Você é especialista em catálogo comercial para pequenas e médias empresas brasileiras.',
      'Responda em português do Brasil.',
      'Crie textos prontos para usar no Orçaly.',
      'Seja objetivo, comercial e claro.',
      'Não use promessas enganosas.',
    ].join('\n')

    const prompt = [
      `Empresa: ${access.company.nome || 'Empresa'}`,
      `Segmento: ${access.company.segmento || access.company.modelo_negocio || access.company.site_template || 'geral'}`,
      `Tipo: ${tipo}`,
      `Nome: ${nome}`,
      `Categoria: ${categoria || 'não informada'}`,
      `Objetivo: ${objetivo}`,
      '',
      'Gere:',
      '1. Descrição premium curta',
      '2. Descrição detalhada',
      '3. 5 benefícios',
      '4. Perguntas úteis para orçamento',
      '5. Sugestão de chamada para botão',
    ].join('\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message || 'Erro na OpenAI.' }, { status: 500 })
    }

    const answer = payload.choices?.[0]?.message?.content || ''

    await createAuditLog(supabaseAdmin, {
      company_id: access.company.id,
      user_id: requester.id,
      action: 'ai.product_helper.used',
      entity: 'products',
      details: { nome, categoria, objetivo },
      request,
    })

    return NextResponse.json({ ok: true, answer })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar sugestão de produto.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
