import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog, createNotification } from '@/lib/orcaly-audit'

function cleanLead(body: any) {
  const nome = String(body.nome || '').trim()
  if (!nome) throw new Error('Informe o nome do cliente ou lead.')

  return {
    nome,
    telefone: String(body.telefone || '').trim() || null,
    email: String(body.email || '').trim() || null,
    origem: String(body.origem || 'manual'),
    etapa: String(body.etapa || 'novo_lead'),
    status: String(body.status || 'ativo'),
    valor_estimado: Number(body.valor_estimado || 0),
    proximo_contato_em: body.proximo_contato_em || null,
    observacoes: String(body.observacoes || '').trim() || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
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
    const etapa = searchParams.get('etapa')
    const status = searchParams.get('status') || 'ativo'

    let query = result.supabaseAdmin
      .from('crm_leads')
      .select('*')
      .eq('company_id', result.companyAccess!.company.id)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (etapa) query = query.eq('etapa', etapa)
    if (status !== 'todos') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ leads: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar CRM.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const payload = cleanLead(body)

    const { data, error } = await result.supabaseAdmin
      .from('crm_leads')
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
      action: 'crm.lead.created',
      entity: 'crm_leads',
      entity_id: data.id,
      details: { nome: data.nome, etapa: data.etapa },
      request,
    })

    await createNotification(result.supabaseAdmin, {
      company_id: result.companyAccess!.company.id,
      user_id: result.requester!.id,
      tipo: 'crm',
      titulo: 'Novo lead criado',
      mensagem: `${data.nome} entrou no funil comercial.`,
      link_url: '/painel/crm',
      payload: { lead_id: data.id },
    })

    return NextResponse.json({ ok: true, lead: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar lead.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
