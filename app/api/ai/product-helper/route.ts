import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'
import { createAuditLog } from '@/lib/orcaly-audit'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function text(value: unknown) {
  return String(value || '').trim()
}

function providerErrorMessage(payload: unknown) {
  const root = asRecord(payload)
  const error = asRecord(root?.error)
  return text(error?.message)
}

function providerAnswer(payload: unknown) {
  const root = asRecord(payload)
  const choices = Array.isArray(root?.choices) ? root.choices : []
  const firstChoice = asRecord(choices[0])
  const message = asRecord(firstChoice?.message)
  return text(message?.content)
}

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
    const company = asRecord(access.company)
    const companyId = text(company?.id)

    if (!company || !isUuid(companyId)) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const rawBody: unknown = await request.json().catch(() => null)
    const body = asRecord(rawBody)
    if (!body) {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const nome = text(body.nome)
    const categoria = text(body.categoria)
    const tipo = text(body.tipo || 'produto')
    const objetivo = text(body.objetivo || 'descricao')

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
      `Empresa: ${text(company.nome) || 'Empresa'}`,
      `Segmento: ${text(company.segmento || company.modelo_negocio || company.site_template) || 'geral'}`,
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

    const payload: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json({ error: providerErrorMessage(payload) || 'Erro na OpenAI.' }, { status: 500 })
    }

    const answer = providerAnswer(payload)

    await createAuditLog(supabaseAdmin, {
      company_id: companyId,
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
