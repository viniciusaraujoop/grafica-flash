import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function tokenCurto() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 18)
}

function numeroProposta() {
  const ano = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `ORC-${ano}-${rand}`
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canProposal) return NextResponse.json({ error: 'Seu perfil não pode criar proposta.' }, { status: 403 })

    const body = await request.json()

    const nome = String(body.nome || '').trim()
    const whatsapp = String(body.whatsapp || '').replace(/\D/g, '')
    const produto = String(body.produto || '').trim()
    const valor = Number(body.valor || 0)
    const prazo = String(body.prazo || '').trim()
    const observacao = String(body.observacao || '').trim()

    if (!nome || !produto || valor <= 0) {
      return NextResponse.json({ error: 'Informe nome, produto e valor.' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        company_id: access.company.id,
        nome,
        telefone: whatsapp,
        produto,
        quantidade: 1,
        observacoes: observacao,
        status: 'Recebido',
        valor_total: valor,
        preco_estimado: valor,
        prazo,
        source: 'balcao',
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (orderError) throw orderError

    const token = tokenCurto()
    const propostaNumero = numeroProposta()
    const validade = new Date()
    validade.setHours(validade.getHours() + 48)

    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from('proposals')
      .insert({
        company_id: access.company.id,
        order_id: order.id,
        token,
        proposta_numero: propostaNumero,
        titulo: `Proposta - ${produto}`,
        cliente_nome: nome,
        cliente_whatsapp: whatsapp,
        valor_total: valor,
        valor_sinal: 0,
        status: 'enviado',
        sent_at: new Date().toISOString(),
        valid_until: validade.toISOString(),
        prazo,
        condicoes: 'Proposta gerada em atendimento presencial. Valores sujeitos à confirmação conforme escopo final.',
        introducao: 'Segue proposta rápida gerada no balcão pelo Orçaly.',
        itens: [{ nome: produto, quantidade: 1, valor }],
        origem: 'balcao',
      })
      .select('*')
      .single()

    if (proposalError) throw proposalError

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://orcaly.com.br').replace(/\/$/, '')
    const proposalUrl = `${siteUrl}/proposta/${proposal.token}`

    return NextResponse.json({
      ok: true,
      order,
      proposal,
      proposal_url: proposalUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar orçamento de balcão.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
