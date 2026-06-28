import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog } from '@/lib/orcaly-audit'

type Context = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', access.company.id)
      .single()

    if (orderError) throw orderError

    const baseTitle = `Proposta para ${order.produto || 'pedido'}`
    const baseValue = Number(order.valor_total || order.preco_estimado || 0)

    // Mantive algumas tentativas porque cada versão do Orçaly pode ter uma tabela proposals
    // com nomes de colunas diferentes. O truque aqui é tipar como Record<string, any>,
    // porque o TypeScript resolveu fiscalizar a vida alheia e reclamar da união de objetos.
    const attempts: Array<Record<string, any>> = [
      {
        company_id: access.company.id,
        order_id: id,
        cliente_nome: order.nome || 'Cliente',
        cliente_telefone: order.telefone || null,
        titulo: baseTitle,
        descricao: order.observacoes || null,
        valor_total: baseValue,
        status: 'rascunho',
        created_at: new Date().toISOString(),
      },
      {
        company_id: access.company.id,
        order_id: id,
        nome_cliente: order.nome || 'Cliente',
        telefone: order.telefone || null,
        titulo: baseTitle,
        observacoes: order.observacoes || null,
        total: baseValue,
        status: 'rascunho',
        created_at: new Date().toISOString(),
      },
      {
        company_id: access.company.id,
        order_id: id,
        titulo: baseTitle,
        status: 'rascunho',
        created_at: new Date().toISOString(),
      },
    ]

    let lastError: any = null

    for (const payload of attempts) {
      const { data: proposal, error } = await supabaseAdmin
        .from('proposals')
        .insert(payload as any)
        .select('*')
        .single()

      if (!error) {
        await createAuditLog(supabaseAdmin, {
          company_id: access.company.id,
          user_id: requester.id,
          action: 'order.proposal.created',
          entity: 'proposals',
          entity_id: String(proposal.id || ''),
          details: { order_id: id },
          request,
        })

        return NextResponse.json({ ok: true, proposal })
      }

      lastError = error
    }

    throw lastError
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar proposta. Verifique as colunas da tabela proposals.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
