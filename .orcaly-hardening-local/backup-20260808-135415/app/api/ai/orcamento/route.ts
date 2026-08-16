import { enforceRateLimit } from '@/lib/security/rate-limit'
import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'
// ORCALY_AI_LIMITS_V1
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function heuristic(text: string) {
  const lower = text.toLowerCase()
  const quantityMatch = lower.match(/(\d+)\s*(camisas|camisetas|cartões|cartoes|adesivos|canecas|unidades|peças|pecas)?/)
  const quantity = quantityMatch ? Number(quantityMatch[1]) : null

  const product =
    lower.includes('camisa') || lower.includes('camiseta') ? 'camisa personalizada'
    : lower.includes('cart') ? 'cartão de visita'
    : lower.includes('adesivo') ? 'adesivo'
    : lower.includes('caneca') ? 'caneca personalizada'
    : 'produto/serviço a definir'

  const missing = []
  if (!lower.includes('arte') && !lower.includes('logo')) missing.push('Você já tem a arte ou logo?')
  if (product.includes('camisa') && !lower.includes('tamanho')) missing.push('Quais tamanhos das camisas?')
  if (!lower.includes('retirar') && !lower.includes('entrega') && !lower.includes('entregar')) missing.push('Vai retirar ou precisa de entrega?')

  return {
    produto: product,
    quantidade: quantity,
    cor: lower.includes('preta') || lower.includes('preto') ? 'preta' : null,
    personalizacao: lower.includes('frente') || lower.includes('costas') ? 'frente/costas' : null,
    prazo: lower.includes('sábado') || lower.includes('sabado') ? 'sábado' : null,
    status: 'aguardando preço',
    perguntas_faltantes: missing,
    resumo: text,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const plan = String(
      access.company.assinatura_plano ||
        access.company.plano ||
        'basico',
    ).toLowerCase()
    const dailyLimit =
      plan === 'premium'
        ? 600
        : plan === 'profissional'
          ? 120
          : 25

    const burstBlocked = await enforceRateLimit(request, {
      scope: 'ai-user-minute',
      identity: requester.id,
      limit: 10,
      windowSeconds: 60,
    })
    if (burstBlocked) return burstBlocked

    const dailyBlocked = await enforceRateLimit(request, {
      scope: 'ai-company-daily',
      identity: access.company.id,
      limit: dailyLimit,
      windowSeconds: 86400,
    })
    if (dailyBlocked) return dailyBlocked

    const body = await readJsonBody<any>(request, 16 * 1024)
    const text = String(body.text || '').trim().slice(0, 8000)

    if (!text) return NextResponse.json({ error: 'Texto do pedido é obrigatório.' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        source: 'heuristic',
        parsed: heuristic(text),
      })
    }

    const prompt = `
Transforme o pedido bagunçado abaixo em JSON estruturado para orçamento.
Responda apenas JSON válido, sem markdown.

Campos:
produto, quantidade, cor, personalizacao, prazo, status, perguntas_faltantes, resumo.

Empresa: ${access.company.nome}
Segmento: ${access.company.segmento || access.company.modelo_nome || 'geral'}
Pedido: ${text}
`.trim()

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ORCALY_AI_MODEL || 'gpt-4.1-mini',
        input: prompt,
        max_output_tokens: 500,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json({
        ok: true,
        source: 'heuristic',
        warning: data?.error?.message || 'IA indisponível, usando extração simples.',
        parsed: heuristic(text),
      })
    }

    let parsed: any = null
    const output = String(data.output_text || '{}').trim()

    try {
      parsed = JSON.parse(output)
    } catch {
      parsed = heuristic(text)
    }

    return NextResponse.json({
      ok: true,
      source: 'openai',
      parsed,
    })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    const message = error instanceof Error ? error.message : 'Erro ao interpretar pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
