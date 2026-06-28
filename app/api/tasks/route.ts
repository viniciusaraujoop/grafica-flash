import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog, createNotification } from '@/lib/orcaly-audit'

function cleanTask(body: any) {
  const titulo = String(body.titulo || '').trim()
  if (!titulo) throw new Error('Informe o título da tarefa.')

  return {
    titulo,
    descricao: String(body.descricao || '').trim() || null,
    status: String(body.status || 'pendente'),
    prioridade: String(body.prioridade || 'media'),
    due_at: body.due_at || null,
    responsavel_id: body.responsavel_id || null,
    crm_lead_id: body.crm_lead_id || null,
    order_id: body.order_id || null,
    proposal_id: body.proposal_id || null,
  }
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

export async function GET(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = result.supabaseAdmin
      .from('internal_tasks')
      .select('*')
      .eq('company_id', result.companyAccess!.company.id)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (status && status !== 'todos') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ tasks: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar tarefas.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const payload = cleanTask(body)

    const { data, error } = await result.supabaseAdmin
      .from('internal_tasks')
      .insert({
        ...payload,
        company_id: result.companyAccess!.company.id,
        created_by: result.requester!.id,
      })
      .select('*')
      .single()

    if (error) throw error

    await createAuditLog(result.supabaseAdmin, {
      company_id: result.companyAccess!.company.id,
      user_id: result.requester!.id,
      action: 'task.created',
      entity: 'internal_tasks',
      entity_id: data.id,
      details: { titulo: data.titulo, prioridade: data.prioridade },
      request,
    })

    await createNotification(result.supabaseAdmin, {
      company_id: result.companyAccess!.company.id,
      user_id: data.responsavel_id || result.requester!.id,
      tipo: 'task',
      titulo: 'Nova tarefa criada',
      mensagem: data.titulo,
      link_url: '/painel/tarefas',
      payload: { task_id: data.id },
    })

    return NextResponse.json({ ok: true, task: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar tarefa.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
