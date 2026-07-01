import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog, createNotification } from '@/lib/orcaly-audit'

type Context = {
  params: Promise<{ id: string }>
}

const allowedFields = [
  'status',
  'prioridade',
  'prazo_entrega',
  'responsavel_id',
  'responsavel_nome',
  'canal_origem',
  'endereco_entrega',
  'forma_pagamento',
  'observacoes_internas',
  'preco_estimado',
  'valor_total',
  'observacoes',
]

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!access.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, access }
}

function cleanUpdate(body: any) {
  const update: Record<string, any> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (update.preco_estimado !== undefined) update.preco_estimado = Number(update.preco_estimado || 0)
  if (update.valor_total !== undefined) update.valor_total = Number(update.valor_total || 0)
  if (update.prazo_entrega === '') update.prazo_entrega = null
  if (update.responsavel_id === '') update.responsavel_id = null

  if (update.status === 'Aprovado') update.aprovado_em = new Date().toISOString()
  if (update.status === 'Entregue') update.entregue_em = new Date().toISOString()
  if (update.status === 'Cancelado') update.cancelado_em = new Date().toISOString()

  update.updated_at = new Date().toISOString()

  return update
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const { data: order, error } = await result.supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', result.access!.company.id)
      .single()

    if (error) throw error

    return NextResponse.json({ order })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const update = cleanUpdate(body)

    const { data: previous } = await result.supabaseAdmin
      .from('orders')
      .select('id, status, nome, produto')
      .eq('id', id)
      .eq('company_id', result.access!.company.id)
      .maybeSingle()

    const { data: order, error } = await result.supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', id)
      .eq('company_id', result.access!.company.id)
      .select('*')
      .single()

    if (error) throw error

    if (update.status && update.status !== previous?.status) {
      await result.supabaseAdmin
        .from('order_status_history')
        .insert({
          company_id: result.access!.company.id,
          order_id: id,
          old_status: previous?.status || null,
          new_status: update.status,
          changed_by: result.requester!.id,
          changed_by_email: result.requester!.email || null,
          note: body.note || null,
        })

      await createNotification(result.supabaseAdmin, {
        company_id: result.access!.company.id,
        user_id: result.requester!.id,
        tipo: 'order',
        titulo: 'Status do pedido atualizado',
        mensagem: `${previous?.nome || 'Pedido'} agora está em ${update.status}.`,
        link_url: `/painel/pedidos/${id}`,
        payload: { order_id: id, status: update.status },
      })
    }

    await createAuditLog(result.supabaseAdmin, {
      company_id: result.access!.company.id,
      user_id: result.requester!.id,
      action: 'order.updated',
      entity: 'orders',
      entity_id: id,
      details: update,
      request,
    })

    return NextResponse.json({ ok: true, order })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
