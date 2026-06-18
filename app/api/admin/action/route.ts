import { NextRequest, NextResponse } from 'next/server'
import { auditLog, can, fail, getCurrentAdmin, supabaseAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)

    const body = await request.json()
    const action = String(body.action || '')
    const targetId = String(body.targetId || '')
    const payload = body.payload || {}

    if (!action || !targetId) return fail('Ação ou alvo não informado.')

    if (action.startsWith('company.') && !can(admin, 'companies')) return fail('Sem permissão para empresas.', 403)
    if (action.startsWith('lead.') && !can(admin, 'leads')) return fail('Sem permissão para leads.', 403)
    if (action.startsWith('bug.') && !can(admin, 'bugs')) return fail('Sem permissão para bugs.', 403)

    if (action === 'company.activate') {
      const { data, error } = await supabaseAdmin
        .from('companies')
        .update({
          ativo: true,
          assinatura_status: 'ativa',
          assinatura_inicio: new Date().toISOString(),
          assinatura_expira_em: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', targetId)
        .select('id,nome')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'company', targetId, data?.nome || targetId, payload)
      return NextResponse.json({ ok: true, company: data })
    }

    if (action === 'company.extend_30') {
      const { data: current, error: currentError } = await supabaseAdmin
        .from('companies')
        .select('id,nome,assinatura_expira_em')
        .eq('id', targetId)
        .single()
      if (currentError) throw currentError

      const base = current.assinatura_expira_em && new Date(current.assinatura_expira_em).getTime() > Date.now()
        ? new Date(current.assinatura_expira_em)
        : new Date()

      base.setDate(base.getDate() + 30)

      const { data, error } = await supabaseAdmin
        .from('companies')
        .update({
          ativo: true,
          assinatura_status: 'ativa',
          assinatura_expira_em: base.toISOString(),
        })
        .eq('id', targetId)
        .select('id,nome,assinatura_expira_em')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'company', targetId, data?.nome || targetId, payload)
      return NextResponse.json({ ok: true, company: data })
    }

    if (action === 'company.block') {
      const { data, error } = await supabaseAdmin
        .from('companies')
        .update({ ativo: false, assinatura_status: 'bloqueada' })
        .eq('id', targetId)
        .select('id,nome')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'company', targetId, data?.nome || targetId, payload)
      return NextResponse.json({ ok: true, company: data })
    }

    if (action === 'company.unblock') {
      const { data, error } = await supabaseAdmin
        .from('companies')
        .update({ ativo: true })
        .eq('id', targetId)
        .select('id,nome')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'company', targetId, data?.nome || targetId, payload)
      return NextResponse.json({ ok: true, company: data })
    }

    if (action === 'lead.lost') {
      const { data, error } = await supabaseAdmin
        .from('signup_leads')
        .update({ status: 'perdido', next_followup_at: null })
        .eq('id', targetId)
        .select('id,email,empresa_nome')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'lead', targetId, data?.empresa_nome || data?.email || targetId, payload)
      return NextResponse.json({ ok: true, lead: data })
    }

    if (action === 'lead.followed') {
      const { data, error } = await supabaseAdmin
        .from('signup_leads')
        .update({
          followup_count: payload.followup_count || 1,
          last_followup_at: new Date().toISOString(),
          next_followup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', targetId)
        .select('id,email,empresa_nome')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'lead', targetId, data?.empresa_nome || data?.email || targetId, payload)
      return NextResponse.json({ ok: true, lead: data })
    }

    if (action === 'bug.resolve' || action === 'bug.ignore' || action === 'bug.reopen' || action === 'bug.review') {
      const status = action === 'bug.resolve' ? 'resolvido' : action === 'bug.ignore' ? 'ignorado' : action === 'bug.review' ? 'em_analise' : 'aberto'
      const { data, error } = await supabaseAdmin
        .from('admin_bug_reports')
        .update({
          status,
          resolved_at: status === 'resolvido' ? new Date().toISOString() : null,
          resolved_by: status === 'resolvido' ? admin.email : null,
        })
        .eq('id', targetId)
        .select('id,title,code')
        .single()
      if (error) throw error
      await auditLog(admin.email, action, 'bug', targetId, data?.title || data?.code || targetId, payload)
      return NextResponse.json({ ok: true, bug: data })
    }

    return fail('Ação não reconhecida.')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao executar ação.' }, { status: 500 })
  }
}
