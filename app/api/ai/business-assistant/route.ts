import { enforceRateLimit } from '@/lib/security/rate-limit'
import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

type Mode = 'free' | 'day_summary' | 'followup' | 'customer' | 'product'

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function text(value: unknown) {
  return String(value || '').trim()
}

function localFallback(mode: Mode, context: any, prompt: string) {
  if (mode === 'day_summary') {
    const { orders = [], proposals = [], tasks = [], leads = [] } = context.operational || {}
    const pendingProposals = proposals.filter((item: any) => !['aprovado', 'approved', 'recusado', 'cancelado'].includes(text(item.status).toLowerCase()))
    const proposalValue = pendingProposals.reduce((sum: number, item: any) => sum + Number(item.valor_total || 0), 0)
    const overdueTasks = tasks.filter((item: any) => item.due_at && new Date(item.due_at).getTime() < Date.now())
    const dueContacts = leads.filter((item: any) => item.proximo_contato_em && new Date(item.proximo_contato_em).getTime() <= Date.now())
    const newOrders = orders.filter((item: any) => ['recebido', 'novo', 'pendente'].includes(text(item.status).toLowerCase()))
    return [
      `${newOrders.length} pedido(s) novo(s) ou pendente(s).`,
      `${pendingProposals.length} proposta(s) aberta(s), somando ${money(proposalValue)}.`,
      `${overdueTasks.length} tarefa(s) vencida(s).`,
      `${dueContacts.length} cliente(s)/lead(s) precisam de retorno.`,
      'Resumo gerado localmente a partir dos dados disponíveis. Nenhuma informação foi inventada.',
    ].join('\n')
  }

  if (mode === 'followup') {
    const lead = context.lead
    if (!lead) return 'Não há dados suficientes para sugerir o follow-up.'
    const value = Number(lead.valor_estimado || 0)
    return `Olá, ${lead.nome}! Tudo bem? Estou retomando nosso atendimento${value > 0 ? ` sobre a oportunidade de ${money(value)}` : ''}. Posso te ajudar a avançar com o orçamento ou tirar alguma dúvida?`
  }

  if (mode === 'customer') {
    const lead = context.lead
    const orders = context.orders || []
    const total = orders.reduce((sum: number, item: any) => sum + Number(item.total_amount || item.total || item.valor_total || item.preco_estimado || 0), 0)
    if (!lead && !orders.length) return 'Não há histórico suficiente para resumir este cliente.'
    return [
      `Cliente: ${lead?.nome || orders[0]?.nome || orders[0]?.customer_name || 'Não identificado'}.`,
      `Pedidos encontrados: ${orders.length}. Valor histórico visível: ${money(total)}.`,
      lead?.etapa ? `Etapa comercial atual: ${lead.etapa}.` : '',
      lead?.proximo_contato_em ? `Próximo contato: ${new Date(lead.proximo_contato_em).toLocaleString('pt-BR')}.` : 'Nenhum próximo contato definido.',
      'Use este resumo como apoio operacional; confirme detalhes antes de enviar algo ao cliente.',
    ].filter(Boolean).join('\n')
  }

  if (mode === 'product') {
    const raw = prompt || 'produto/serviço'
    return `Nome sugerido: ${raw.slice(0, 80)}\nDescrição comercial: Apresente o benefício principal, para quem é indicado e o que está incluído.\nCategoria sugerida: revise conforme o catálogo atual.\nObservação: sugestão local. Complete materiais, medidas, prazo e preço com dados reais.`
  }

  return `A IA externa está indisponível. O Orçaly continua funcionando normalmente. Solicitação recebida: ${prompt.slice(0, 500)}`
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const body = await readJsonBody<any>(request, 16 * 1024)
    const requestedMode = text(body.mode) as Mode
    const mode: Mode = ['day_summary', 'followup', 'customer', 'product'].includes(requestedMode) ? requestedMode : 'free'
    const prompt = text(body.prompt).slice(0, 8000)
    const leadId = text(body.lead_id)
    if (mode === 'free' && !prompt) return NextResponse.json({ error: 'Digite uma solicitação.' }, { status: 400 })

    const companyId = access.company.id
    const context: any = {
      empresa: {
        nome: access.company.nome,
        segmento: access.company.business_type || access.company.segmento || access.company.modelo_negocio || access.company.site_template,
        cidade: access.company.cidade,
        estado: access.company.estado,
        plano: access.company.assinatura_plano || access.company.plano,
      },
    }

    if (mode === 'day_summary') {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const [orders, proposals, tasks, leads] = await Promise.all([
        supabaseAdmin.from('orders').select('id,nome,produto,status,total,total_amount,valor_total,preco_estimado,prazo_entrega,created_at').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending: false }).limit(80),
        supabaseAdmin.from('proposals').select('id,cliente_nome,status,valor_total,valid_until,sent_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(60),
        supabaseAdmin.from('internal_tasks').select('id,titulo,status,prioridade,due_at').eq('company_id', companyId).not('status', 'in', '(concluido,concluida,done,cancelado)').limit(60),
        supabaseAdmin.from('crm_leads').select('id,nome,etapa,valor_estimado,proximo_contato_em').eq('company_id', companyId).eq('status', 'ativo').limit(80),
      ])
      context.operational = { orders: orders.data || [], proposals: proposals.data || [], tasks: tasks.data || [], leads: leads.data || [] }
    }

    if ((mode === 'followup' || mode === 'customer') && isUuid(leadId)) {
      const { data: lead } = await supabaseAdmin.from('crm_leads').select('id,nome,telefone,email,origem,etapa,valor_estimado,proximo_contato_em,observacoes,tags,order_id,proposal_id').eq('id', leadId).eq('company_id', companyId).maybeSingle()
      context.lead = lead || null
      if (mode === 'customer' && lead) {
        const phone = text(lead.telefone)
        let query = supabaseAdmin.from('orders').select('id,nome,customer_name,produto,status,total,total_amount,valor_total,preco_estimado,created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(40)
        if (phone) query = query.or(`telefone.eq.${phone},customer_phone.eq.${phone}`)
        else if (lead.order_id) query = query.eq('id', lead.order_id)
        else query = query.eq('id', '00000000-0000-0000-0000-000000000000')
        const { data } = await query
        context.orders = data || []
      }
    }

    const fallback = localFallback(mode, context, prompt)
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ ok: true, source: 'fallback', answer: fallback })

    const plan = text(access.company.assinatura_plano || access.company.plano || 'basico').toLowerCase()
    const dailyLimit = plan === 'premium' ? 600 : plan === 'profissional' ? 120 : 25
    const burstBlocked = await enforceRateLimit(request, { scope: 'ai-user-minute', identity: requester.id, limit: 10, windowSeconds: 60 })
    if (burstBlocked) return burstBlocked
    const dailyBlocked = await enforceRateLimit(request, { scope: 'ai-company-daily', identity: companyId, limit: dailyLimit, windowSeconds: 86400 })
    if (dailyBlocked) return dailyBlocked

    const instructions: Record<Mode, string> = {
      free: 'Execute a solicitação de forma prática e pronta para uso.',
      day_summary: 'Resuma o dia com base SOMENTE no contexto fornecido. Destaque pendências, valores e próximos passos. Não invente números.',
      followup: 'Crie UMA mensagem curta de follow-up para WhatsApp. Não afirme fatos ausentes. O usuário revisará antes de enviar.',
      customer: 'Resuma histórico, pedidos, valor, pendências e próxima oportunidade usando SOMENTE o contexto fornecido.',
      product: 'Sugira nome, descrição, categoria e texto comercial. Não invente preço, estoque ou especificações ausentes.',
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ORCALY_AI_MODEL || 'gpt-4.1-mini', temperature: 0.35,
        messages: [
          { role: 'system', content: `Você é a IA operacional interna do Orçaly. Responda em português do Brasil. ${instructions[mode]} Nunca envie mensagens automaticamente.` },
          { role: 'user', content: `Contexto confirmado:\n${JSON.stringify(context, null, 2)}\n\nSolicitação:\n${prompt || instructions[mode]}` },
        ],
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return NextResponse.json({ ok: true, source: 'fallback', warning: payload.error?.message || 'IA externa indisponível.', answer: fallback })

    return NextResponse.json({ ok: true, source: 'openai', answer: payload.choices?.[0]?.message?.content || fallback })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consultar assistente.' }, { status: 500 })
  }
}
