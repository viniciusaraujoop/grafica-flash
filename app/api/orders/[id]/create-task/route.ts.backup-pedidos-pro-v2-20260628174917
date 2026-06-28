import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog, createNotification } from '@/lib/orcaly-audit'

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

    const body = await request.json().catch(() => ({}))

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', access.company.id)
      .single()

    if (orderError) throw orderError

    const titulo = String(body.titulo || `Acompanhar pedido de ${order.nome || 'cliente'}`)
    const descricao = String(body.descricao || `Pedido: ${order.produto || 'sem produto informado'}\nCliente: ${order.nome || '-'}\nTelefone: ${order.telefone || '-'}`)

    const { data: task, error } = await supabaseAdmin
      .from('internal_tasks')
      .insert({
        company_id: access.company.id,
        titulo,
        descricao,
        status: 'pendente',
        prioridade: body.prioridade || order.prioridade || 'media',
        due_at: body.due_at || order.prazo_entrega || null,
        order_id: id,
        created_by: requester.id,
      })
      .select('*')
      .single()

    if (error) throw error

    await createAuditLog(supabaseAdmin, {
      company_id: access.company.id,
      user_id: requester.id,
      action: 'order.task.created',
      entity: 'internal_tasks',
      entity_id: task.id,
      details: { order_id: id },
      request,
    })

    await createNotification(supabaseAdmin, {
      company_id: access.company.id,
      user_id: requester.id,
      tipo: 'task',
      titulo: 'Tarefa criada a partir do pedido',
      mensagem: titulo,
      link_url: '/painel/tarefas',
      payload: { order_id: id, task_id: task.id },
    })

    return NextResponse.json({ ok: true, task })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar tarefa do pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
