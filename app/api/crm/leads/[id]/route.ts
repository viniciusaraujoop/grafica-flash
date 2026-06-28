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
    'nome',
    'telefone',
    'email',
    'origem',
    'etapa',
    'status',
    'valor_estimado',
    'proximo_contato_em',
    'observacoes',
    'tags',
    'order_id',
    'proposal_id',
  ]

  const update: Record<string, any> = {}

  for (const field of allowed) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (update.valor_estimado !== undefined) update.valor_estimado = Number(update.valor_estimado || 0)
  if (update.tags !== undefined && !Array.isArray(update.tags)) update.tags = []
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
      .from('crm_leads')
      .update(update)
      .eq('id', id)
      .eq('company_id', result.companyAccess!.company.id)
      .select('*')
      .single()

    if (error) throw error

    await createAuditLog(result.supabaseAdmin, {
      company_id: result.companyAccess!.company.id,
      user_id: result.requester!.id,
      action: 'crm.lead.updated',
      entity: 'crm_leads',
      entity_id: id,
      details: update,
      request,
    })

    return NextResponse.json({ ok: true, lead: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar lead.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
