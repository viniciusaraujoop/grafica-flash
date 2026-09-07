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

  const characteristics: string[] = []
  const confirmed: string[] = []
  const missing: string[] = []
  const questions: string[] = []

  if (quantity) confirmed.push(`Quantidade: ${quantity}`)
  else {
    missing.push('quantidade')
    questions.push('Qual é a quantidade desejada?')
  }

  if (product !== 'produto/serviço a definir') confirmed.push(`Produto: ${product}`)
  else {
    missing.push('produto ou serviço')
    questions.push('Qual produto ou serviço você precisa?')
  }

  const color = lower.includes('preta') || lower.includes('preto') ? 'preta' : lower.includes('branca') || lower.includes('branco') ? 'branca' : null
  if (color) characteristics.push(`Cor: ${color}`)

  const frontBack = lower.includes('frente') && (lower.includes('verso') || lower.includes('costas'))
  const personalization = frontBack ? 'frente e verso' : lower.includes('frente') || lower.includes('costas') ? 'personalização indicada' : null
  if (personalization) characteristics.push(`Personalização: ${personalization}`)

  const deadline = lower.includes('sexta') ? 'sexta-feira'
    : lower.includes('sábado') || lower.includes('sabado') ? 'sábado'
      : lower.includes('domingo') ? 'domingo'
        : null
  if (deadline) confirmed.push(`Prazo informado: ${deadline}`)
  else {
    missing.push('prazo')
    questions.push('Para quando você precisa?')
  }

  if (product.includes('cartão')) {
    if (!/(\d+)\s*(x|por)\s*(\d+)/.test(lower) && !lower.includes('9x5') && !lower.includes('9 x 5')) {
      missing.push('tamanho')
      questions.push('Qual é o tamanho do cartão?')
    }
    const hasPaper = ['couch', 'papel', 'gramatura', '300g', '250g', '350g'].some((term) => lower.includes(term))
    if (!hasPaper) {
      missing.push('papel/gramatura')
      questions.push('Qual papel ou gramatura você prefere?')
    }
  }

  if (product.includes('camisa') && !lower.includes('tamanho')) {
    missing.push('tamanhos')
    questions.push('Quais tamanhos das camisas?')
  }

  if (!lower.includes('arte') && !lower.includes('logo')) {
    missing.push('arte/logo')
    questions.push('Você já tem a arte ou logo?')
  }

  if (!lower.includes('retirar') && !lower.includes('retirada') && !lower.includes('entrega') && !lower.includes('entregar')) {
    missing.push('entrega ou retirada')
    questions.push('Vai retirar ou precisa de entrega?')
  }

  return {
    produto: product,
    quantidade: quantity,
    caracteristicas: characteristics,
    cor: color,
    personalizacao: personalization,
    prazo: deadline,
    informacoes_confirmadas: confirmed,
    informacoes_faltantes: missing,
    perguntas_faltantes: questions,
    status: missing.length ? 'briefing incompleto' : 'pronto para precificar',
    resumo: text,
    pode_completar: missing.length > 0,
  }
}

function normalizeParsed(value: any, original: string) {
  const fallback = heuristic(original)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback

  const questions = Array.isArray(value.perguntas_faltantes)
    ? value.perguntas_faltantes.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 12)
    : fallback.perguntas_faltantes
  const missing = Array.isArray(value.informacoes_faltantes)
    ? value.informacoes_faltantes.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 12)
    : fallback.informacoes_faltantes

  return {
    ...fallback,
    ...value,
    resumo: String(value.resumo || original).slice(0, 4000),
    caracteristicas: Array.isArray(value.caracteristicas) ? value.caracteristicas.slice(0, 20) : fallback.caracteristicas,
    informacoes_confirmadas: Array.isArray(value.informacoes_confirmadas) ? value.informacoes_confirmadas.slice(0, 20) : fallback.informacoes_confirmadas,
    informacoes_faltantes: missing,
    perguntas_faltantes: questions,
    pode_completar: missing.length > 0 || questions.length > 0,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const plan = String(access.company.assinatura_plano || access.company.plano || 'basico').toLowerCase()
    const dailyLimit = plan === 'premium' ? 600 : plan === 'profissional' ? 120 : 25

    const burstBlocked = await enforceRateLimit(request, {
      scope: 'ai-user-minute', identity: requester.id, limit: 10, windowSeconds: 60,
    })
    if (burstBlocked) return burstBlocked

    const dailyBlocked = await enforceRateLimit(request, {
      scope: 'ai-company-daily', identity: access.company.id, limit: dailyLimit, windowSeconds: 86400,
    })
    if (dailyBlocked) return dailyBlocked

    const body = await readJsonBody<any>(request, 16 * 1024)
    const text = String(body.text || '').trim().slice(0, 8000)
    if (!text) return NextResponse.json({ error: 'Texto do pedido é obrigatório.' }, { status: 400 })

    const fallback = heuristic(text)
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ ok: true, source: 'heuristic', parsed: fallback })

    const prompt = `
Você estrutura pedidos para orçamento empresarial. Não invente dados.
Responda somente JSON válido, sem markdown.

Campos obrigatórios:
produto, quantidade, caracteristicas (array), cor, personalizacao, prazo,
informacoes_confirmadas (array), informacoes_faltantes (array),
perguntas_faltantes (array de perguntas objetivas), status, resumo.

Regras:
- marque como faltante tudo que seja necessário para precificar e não esteja explícito;
- perguntas_faltantes devem corresponder às lacunas reais;
- não escolha material, medida, prazo ou quantidade pelo cliente;
- status deve ser "briefing incompleto" quando houver lacunas e "pronto para precificar" quando estiver suficiente.

Empresa: ${access.company.nome}
Segmento: ${access.company.business_type || access.company.segmento || access.company.modelo_nome || 'services'}
Pedido: ${text}
`.trim()

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.ORCALY_AI_MODEL || 'gpt-4.1-mini', input: prompt, max_output_tokens: 800 }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json({ ok: true, source: 'heuristic', warning: data?.error?.message || 'IA indisponível, usando extração local.', parsed: fallback })
    }

    let parsed: any = fallback
    try { parsed = normalizeParsed(JSON.parse(String(data.output_text || '{}').trim()), text) } catch { parsed = fallback }

    return NextResponse.json({ ok: true, source: 'openai', parsed })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao interpretar pedido.' }, { status: 500 })
  }
}
