import { NextRequest, NextResponse } from 'next/server'
import { can, fail, getCurrentAdmin, supabaseAdmin } from '@/lib/admin-auth'

function dateOnly(value: any) {
  if (!value) return null
  try { return new Date(value).toISOString() } catch { return null }
}

function daysUntil(value: any) {
  if (!value) return null
  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) return null
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24))
}

function companyHealth(company: any) {
  const days = daysUntil(company.assinatura_expira_em)
  if (company.ativo === false) return 'bloqueada'
  if (company.assinatura_status === 'ativa' && (days === null || days >= 5)) return 'saudável'
  if (company.assinatura_status === 'ativa' && days !== null && days < 5 && days >= 0) return 'vence em breve'
  if (days !== null && days < 0) return 'vencida'
  if (company.assinatura_status === 'pendente') return 'pendente'
  return 'atenção'
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (!can(admin, 'dashboard')) return fail('Sem permissão para dashboard.', 403)

    const url = new URL(request.url)
    const q = (url.searchParams.get('q') || '').toLowerCase().trim()

    const [
      usersRes,
      companiesRes,
      membersRes,
      ordersRes,
      proposalsRes,
      leadsRes,
      financeRes,
      logsRes,
      adminUsersRes,
      bugRes,
      scanRes,
    ] = await Promise.allSettled([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin.from('companies').select('*').order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('company_members_public').select('*').limit(500),
      supabaseAdmin.from('orders').select('id,company_id,nome,telefone,produto,status,valor_total,preco_estimado,created_at').order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('proposals').select('id,company_id,cliente_nome,cliente_whatsapp,status,valor_total,created_at,approved_at').order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('signup_leads').select('*').order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('financial_transactions').select('id,company_id,tipo,categoria,descricao,valor,status,data_competencia,vencimento').order('data_competencia', { ascending: false }).limit(500),
      supabaseAdmin.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(80),
      supabaseAdmin.from('admin_users').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('admin_bug_reports').select('*').order('last_seen_at', { ascending: false }).limit(120),
      supabaseAdmin.from('admin_scan_runs').select('*').order('started_at', { ascending: false }).limit(20),
    ])

    function dataOf(result: any, fallback: any = []) {
      if (result.status !== 'fulfilled') return fallback
      if (result.value?.error) return fallback
      return result.value?.data ?? fallback
    }

    const usersRaw = usersRes.status === 'fulfilled' ? (usersRes.value?.data?.users || []) : []
    const companiesRaw = dataOf(companiesRes)
    const membersRaw = dataOf(membersRes)
    const ordersRaw = dataOf(ordersRes)
    const proposalsRaw = dataOf(proposalsRes)
    const leadsRaw = dataOf(leadsRes)
    const financeRaw = dataOf(financeRes)
    const logsRaw = dataOf(logsRes)
    const adminUsersRaw = dataOf(adminUsersRes)
    const bugsRaw = dataOf(bugRes)
    const scansRaw = dataOf(scanRes)

    const companies = companiesRaw.map((company: any) => {
      const companyOrders = ordersRaw.filter((order: any) => order.company_id === company.id)
      const companyProposals = proposalsRaw.filter((proposal: any) => proposal.company_id === company.id)
      const companyFinance = financeRaw.filter((tx: any) => tx.company_id === company.id)
      const companyMembers = membersRaw.filter((member: any) => member.company_id === company.id)
      const revenue = companyOrders.reduce((acc: number, order: any) => acc + Number(order.valor_total || order.preco_estimado || 0), 0)
      const entradas = companyFinance.filter((tx: any) => tx.tipo === 'entrada' && tx.status !== 'cancelado').reduce((acc: number, tx: any) => acc + Number(tx.valor || 0), 0)
      const saidas = companyFinance.filter((tx: any) => tx.tipo === 'saida' && tx.status !== 'cancelado').reduce((acc: number, tx: any) => acc + Number(tx.valor || 0), 0)

      return {
        ...company,
        health: companyHealth(company),
        dias_para_expirar: daysUntil(company.assinatura_expira_em),
        metrics: {
          pedidos: companyOrders.length,
          propostas: companyProposals.length,
          funcionarios: companyMembers.length,
          faturamento_pedidos: revenue,
          financeiro_saldo: entradas - saidas,
          entradas,
          saidas,
        },
      }
    })

    const users = usersRaw.map((user: any) => {
      const ownedCompanies = companies.filter((company: any) => company.owner_id === user.id || company.tester_id === user.id)
      const memberRecords = membersRaw.filter((member: any) => member.email?.toLowerCase() === user.email?.toLowerCase() || member.user_id === user.id)
      const memberCompanies = memberRecords
        .map((member: any) => {
          const c = companies.find((company: any) => company.id === member.company_id)
          return c ? { id: c.id, nome: c.nome, slug: c.slug, cargo: member.cargo, status: member.status } : null
        })
        .filter(Boolean)

      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        created_at: dateOnly(user.created_at),
        last_sign_in_at: dateOnly(user.last_sign_in_at),
        confirmed_at: dateOnly(user.confirmed_at),
        banned_until: user.banned_until || null,
        app_metadata: user.app_metadata || {},
        user_metadata: user.user_metadata || {},
        owned_companies: ownedCompanies.map((c: any) => ({ id: c.id, nome: c.nome, slug: c.slug, assinatura_status: c.assinatura_status, ativo: c.ativo })),
        member_companies: memberCompanies,
        is_admin: adminUsersRaw.some((a: any) => a.email?.toLowerCase() === user.email?.toLowerCase() && a.ativo),
      }
    })

    const filteredCompanies = q
      ? companies.filter((c: any) =>
          String(c.nome || '').toLowerCase().includes(q) ||
          String(c.email || '').toLowerCase().includes(q) ||
          String(c.slug || '').toLowerCase().includes(q) ||
          String(c.whatsapp || '').toLowerCase().includes(q)
        )
      : companies

    const filteredUsers = q
      ? users.filter((u: any) =>
          String(u.email || '').toLowerCase().includes(q) ||
          String(u.user_metadata?.nome || '').toLowerCase().includes(q) ||
          String(u.user_metadata?.empresa || '').toLowerCase().includes(q)
        )
      : users

    const now = Date.now()
    const activeCompanies = companies.filter((c: any) => c.ativo !== false && c.assinatura_status === 'ativa').length
    const pendingCompanies = companies.filter((c: any) => c.assinatura_status === 'pendente').length
    const expiredCompanies = companies.filter((c: any) => c.assinatura_expira_em && new Date(c.assinatura_expira_em).getTime() < now).length
    const leadsOpen = leadsRaw.filter((lead: any) => ['lead', 'checkout_criado'].includes(lead.status)).length
    const leadsPaid = leadsRaw.filter((lead: any) => lead.status === 'pago').length

    const financeTotals = financeRaw.reduce((acc: any, tx: any) => {
      if (tx.status === 'cancelado') return acc
      if (tx.tipo === 'entrada') acc.entradas += Number(tx.valor || 0)
      if (tx.tipo === 'saida') acc.saidas += Number(tx.valor || 0)
      return acc
    }, { entradas: 0, saidas: 0 })

    const bugOpen = bugsRaw.filter((bug: any) => bug.status === 'aberto' || bug.status === 'em_analise')
    const bugCritical = bugOpen.filter((bug: any) => bug.severity === 'critica' || bug.severity === 'alta')

    return NextResponse.json({
      admin,
      summary: {
        users: users.length,
        companies: companies.length,
        activeCompanies,
        pendingCompanies,
        expiredCompanies,
        leadsOpen,
        leadsPaid,
        orders: ordersRaw.length,
        proposals: proposalsRaw.length,
        financeBalance: financeTotals.entradas - financeTotals.saidas,
        financeIn: financeTotals.entradas,
        financeOut: financeTotals.saidas,
        bugOpen: bugOpen.length,
        bugCritical: bugCritical.length,
      },
      companies: filteredCompanies,
      users: filteredUsers,
      leads: leadsRaw,
      members: membersRaw,
      orders: ordersRaw,
      proposals: proposalsRaw,
      finance: financeRaw,
      logs: logsRaw,
      adminUsers: adminUsersRaw,
      bugs: bugsRaw,
      scans: scansRaw,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar admin.' }, { status: 500 })
  }
}
