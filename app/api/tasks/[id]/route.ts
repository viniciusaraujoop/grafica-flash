import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog } from '@/lib/orcaly-audit'

type Context = {
  params: Promise<{ id: string }>
}

async function access(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const companyAccess = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!companyAccess.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, companyAccess }
}

function cleanUpdate(body: any) {
  const allowed = [
    'titulo',
    'descricao',
    'status',
    'prioridade',
    'due_at',
    'responsavel_id',
    'crm_lead_id',
    'order_id',
    'proposal_id',
  ]

  const update: Record<string, any> = {}

  for (const field of allowed) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (update.status === 'concluida') update.completed_at = new Date().toISOString()
  if (update.status && update.status !== 'concluida') update.completed_at = null
  update.updated_at = new Date().toISOString()

  return update
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const update = cleanUpdate(body)

    const { data, error } = await result.supabaseAdmin
      .from('internal_tasks')
      .update(update)
      .eq('id', id)
      .eq('company_id', result.companyAccess!.company.id)
      .select('*')
      .single()

    if (error) throw error

    await createAuditLog(result.supabaseAdmin, {
      company_id: result.companyAccess!.company.id,
      user_id: result.requester!.id,
      action: 'task.updated',
      entity: 'internal_tasks',
      entity_id: id,
      details: update,
      request,
    })

    return NextResponse.json({ ok: true, task: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar tarefa.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
