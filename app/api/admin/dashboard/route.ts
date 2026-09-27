import { NextRequest, NextResponse } from 'next/server'
import { can, fail, getCurrentAdmin, supabaseAdmin } from '@/lib/admin-auth'

type CompanyRow = {
  id: string
  owner_id?: string | null
  tester_id?: string | null
  nome?: string | null
  email?: string | null
  slug?: string | null
  whatsapp?: string | null
  ativo?: boolean | null
  assinatura_status?: string | null
  assinatura_expira_em?: string | null
  [key: string]: unknown
}

type MemberRow = {
  company_id: string
  email?: string | null
  user_id?: string | null
  cargo?: string | null
  status?: string | null
  [key: string]: unknown
}

type OrderRow = {
  company_id: string
  valor_total?: number | string | null
  preco_estimado?: number | string | null
  [key: string]: unknown
}

type ProposalRow = { company_id: string; [key: string]: unknown }
type LeadRow = { status?: string | null; [key: string]: unknown }
type FinanceRow = {
  company_id: string
  tipo?: string | null
  status?: string | null
  valor?: number | string | null
  [key: string]: unknown
}
type AdminUserRow = { email?: string | null; ativo?: boolean | null; [key: string]: unknown }
type BugRow = { status?: string | null; severity?: string | null; [key: string]: unknown }
type ScanRow = Record<string, unknown>
type UserMetadata = { nome?: unknown; empresa?: unknown; [key: string]: unknown }
type AuthUserRow = {
  id: string
  email?: string
  phone?: string
  created_at?: string
  last_sign_in_at?: string
  confirmed_at?: string
  banned_until?: string | null
  app_metadata?: Record<string, unknown>
  user_metadata?: UserMetadata
}

function dateOnly(value: string | null | undefined) {
  if (!value) return null
  try { return new Date(value).toISOString() } catch { return null }
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null
  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) return null
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24))
}

function companyHealth(company: CompanyRow) {
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

    function dataOf<T>(
      result: PromiseSettledResult<{ data: T[] | null; error: unknown }>,
      fallback: T[] = [],
    ): T[] {
      if (result.status !== 'fulfilled') return fallback
      if (result.value?.error) return fallback
      return result.value?.data ?? fallback
    }

    const usersRaw = usersRes.status === 'fulfilled' ? (usersRes.value?.data?.users || []) as AuthUserRow[] : []
    const companiesRaw = dataOf<CompanyRow>(companiesRes)
    const membersRaw = dataOf<MemberRow>(membersRes)
    const ordersRaw = dataOf<OrderRow>(ordersRes)
    const proposalsRaw = dataOf<ProposalRow>(proposalsRes)
    const leadsRaw = dataOf<LeadRow>(leadsRes)
    const financeRaw = dataOf<FinanceRow>(financeRes)
    const logsRaw = dataOf<Record<string, unknown>>(logsRes)
    const adminUsersRaw = dataOf<AdminUserRow>(adminUsersRes)
    const bugsRaw = dataOf<BugRow>(bugRes)
    const scansRaw = dataOf<ScanRow>(scanRes)

    const companies = companiesRaw.map((company) => {
      const companyOrders = ordersRaw.filter((order) => order.company_id === company.id)
      const companyProposals = proposalsRaw.filter((proposal) => proposal.company_id === company.id)
      const companyFinance = financeRaw.filter((tx) => tx.company_id === company.id)
      const companyMembers = membersRaw.filter((member) => member.company_id === company.id)
      const revenue = companyOrders.reduce((acc, order) => acc + Number(order.valor_total || order.preco_estimado || 0), 0)
      const entradas = companyFinance.filter((tx) => tx.tipo === 'entrada' && tx.status !== 'cancelado').reduce((acc, tx) => acc + Number(tx.valor || 0), 0)
      const saidas = companyFinance.filter((tx: any) => tx.tipo === 'saida' && tx.status !== 'cancelado').reduce((acc, tx) => acc + Number(tx.valor || 0), 0)

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

    const users = usersRaw.map((user) => {
      const ownedCompanies = companies.filter((company) => company.owner_id === user.id || company.tester_id === user.id)
      const memberRecords = membersRaw.filter((member) => member.email?.toLowerCase() === user.email?.toLowerCase() || member.user_id === user.id)
      const memberCompanies = memberRecords
        .map((member) => {
          const c = companies.find((company) => company.id === member.company_id)
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
        owned_companies: ownedCompanies.map((c) => ({ id: c.id, nome: c.nome, slug: c.slug, assinatura_status: c.assinatura_status, ativo: c.ativo })),
        member_companies: memberCompanies,
        is_admin: adminUsersRaw.some((a) => a.email?.toLowerCase() === user.email?.toLowerCase() && a.ativo),
      }
    })

    const filteredCompanies = q
      ? companies.filter((c) =>
          String(c.nome || '').toLowerCase().includes(q) ||
          String(c.email || '').toLowerCase().includes(q) ||
          String(c.slug || '').toLowerCase().includes(q) ||
          String(c.whatsapp || '').toLowerCase().includes(q)
        )
      : companies

    const filteredUsers = q
      ? users.filter((u) =>
          String(u.email || '').toLowerCase().includes(q) ||
          String(u.user_metadata?.nome || '').toLowerCase().includes(q) ||
          String(u.user_metadata?.empresa || '').toLowerCase().includes(q)
        )
      : users

    const now = Date.now()
    const activeCompanies = companies.filter((c) => c.ativo !== false && c.assinatura_status === 'ativa').length
    const pendingCompanies = companies.filter((c) => c.assinatura_status === 'pendente').length
    const expiredCompanies = companies.filter((c) => c.assinatura_expira_em && new Date(c.assinatura_expira_em).getTime() < now).length
    const leadsOpen = leadsRaw.filter((lead) => ['lead', 'checkout_criado'].includes(lead.status)).length
    const leadsPaid = leadsRaw.filter((lead) => lead.status === 'pago').length

    const financeTotals = financeRaw.reduce((acc, tx) => {
      if (tx.status === 'cancelado') return acc
      if (tx.tipo === 'entrada') acc.entradas += Number(tx.valor || 0)
      if (tx.tipo === 'saida') acc.saidas += Number(tx.valor || 0)
      return acc
    }, { entradas: 0, saidas: 0 })

    const bugOpen = bugsRaw.filter((bug) => bug.status === 'aberto' || bug.status === 'em_analise')
    const bugCritical = bugOpen.filter((bug) => bug.severity === 'critica' || bug.severity === 'alta')

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
