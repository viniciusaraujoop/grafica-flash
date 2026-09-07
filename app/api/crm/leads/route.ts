import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog, createNotification } from '@/lib/orcaly-audit'

function cleanLead(body: any) {
  const nome = String(body.nome || '').trim()
  if (!nome) throw new Error('Informe o nome do cliente ou lead.')

  return {
    nome,
    telefone: String(body.telefone || '').trim() || null,
    email: String(body.email || '').trim().toLowerCase() || null,
    origem: String(body.origem || 'manual'),
    etapa: String(body.etapa || 'novo_lead'),
    status: String(body.status || 'ativo'),
    valor_estimado: Number(body.valor_estimado || 0),
    proximo_contato_em: body.proximo_contato_em || null,
    observacoes: String(body.observacoes || '').trim() || null,
    tags: Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
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
    const companyId = result.companyAccess!.company.id

    let existing: any = null
    if (payload.email) {
      const { data } = await result.supabaseAdmin
        .from('crm_leads')
        .select('*')
        .eq('company_id', companyId)
        .ilike('email', payload.email)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existing = data
    }

    if (!existing && payload.telefone) {
      const { data } = await result.supabaseAdmin
        .from('crm_leads')
        .select('*')
        .eq('company_id', companyId)
        .eq('telefone', payload.telefone)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existing = data
    }

    if (existing?.id) {
      const incomingStage = payload.etapa === 'novo_lead' && existing.etapa && existing.etapa !== 'novo_lead' ? existing.etapa : payload.etapa
      const mergedTags = Array.from(new Set([...(Array.isArray(existing.tags) ? existing.tags : []), ...payload.tags])).slice(0, 20)
      const update = {
        nome: payload.nome || existing.nome,
        telefone: payload.telefone || existing.telefone,
        email: payload.email || existing.email,
        origem: payload.origem === 'manual' && existing.origem ? existing.origem : payload.origem,
        etapa: incomingStage,
        status: 'ativo',
        valor_estimado: Math.max(Number(existing.valor_estimado || 0), payload.valor_estimado),
        proximo_contato_em: payload.proximo_contato_em || existing.proximo_contato_em,
        observacoes: payload.observacoes || existing.observacoes,
        tags: mergedTags,
        order_id: payload.order_id || existing.order_id,
        proposal_id: payload.proposal_id || existing.proposal_id,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await result.supabaseAdmin
        .from('crm_leads')
        .update(update)
        .eq('id', existing.id)
        .eq('company_id', companyId)
        .select('*')
        .single()

      if (error) throw error

      await createAuditLog(result.supabaseAdmin, {
        company_id: companyId,
        user_id: result.requester!.id,
        action: 'crm.lead.reused',
        entity: 'crm_leads',
        entity_id: data.id,
        details: { nome: data.nome, etapa: data.etapa, matched_by: payload.email ? 'email_or_phone' : 'phone' },
        request,
      })

      return NextResponse.json({ ok: true, reused: true, lead: data })
    }

    const { data, error } = await result.supabaseAdmin
      .from('crm_leads')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: result.requester!.id,
      })
      .select('*')
      .single()

    if (error) throw error

    await createAuditLog(result.supabaseAdmin, {
      company_id: companyId,
      user_id: result.requester!.id,
      action: 'crm.lead.created',
      entity: 'crm_leads',
      entity_id: data.id,
      details: { nome: data.nome, etapa: data.etapa },
      request,
    })

    await createNotification(result.supabaseAdmin, {
      company_id: companyId,
      user_id: result.requester!.id,
      tipo: 'crm',
      titulo: 'Novo lead criado',
      mensagem: `${data.nome} entrou no funil comercial.`,
      link_url: '/painel/crm',
      payload: { lead_id: data.id },
    })

    return NextResponse.json({ ok: true, reused: false, lead: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar lead.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
