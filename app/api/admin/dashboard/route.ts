import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

function estaInadimplente(company: any) {
  const status = String(company.assinatura_status || '').toLowerCase()
  const expira = company.assinatura_expira_em ? new Date(company.assinatura_expira_em) : null
  const venceu = expira ? expira.getTime() < Date.now() : false

  return status !== 'ativa' || venceu
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const supabase = admin.supabaseAdmin as any as any

  const [
    companiesRes,
    bugsRes,
    ordersRes,
    proposalsRes,
    snapshotsRes,
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('id, nome, slug, email, whatsapp, plano, ativo, assinatura_status, assinatura_plano, assinatura_expira_em, created_at, modelo_nome, modelo_negocio')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('admin_bug_reports')
      .select('id, severity, category, title, description, table_name, record_id, status, last_seen_at, metadata')
      .eq('status', 'aberto')
      .order('last_seen_at', { ascending: false })
      .limit(120),
    supabase
      .from('orders')
      .select('id, company_id, status, valor_total, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('proposals')
      .select('id, company_id, status, valor_total, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('admin_system_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 })
  if (bugsRes.error) return NextResponse.json({ error: bugsRes.error.message }, { status: 500 })

  const companies = companiesRes.data || []
  const bugs = bugsRes.data || []
  const orders = ordersRes.data || []
  const proposals = proposalsRes.data || []
  const snapshots = snapshotsRes.data || []

  const metrics = {
    companiesTotal: companies.length,
    companiesActive: companies.filter((item: any) => item.ativo && !estaInadimplente(item)).length,
    companiesOverdue: companies.filter((item: any) => estaInadimplente(item)).length,
    ordersTotal: orders.length,
    proposalsTotal: proposals.length,
    bugsGreen: bugs.filter((bug: any) => bug.severity === 'verde').length,
    bugsYellow: bugs.filter((bug: any) => bug.severity === 'amarelo').length,
    bugsRed: bugs.filter((bug: any) => bug.severity === 'vermelho').length,
  }

  await supabase.from('admin_audit_logs').insert({
    admin_email: admin.email,
    action: 'admin_dashboard_view',
    metadata: { metrics },
  })

  return NextResponse.json({
    ok: true,
    admin: {
      email: admin.email,
      role: admin.role,
    },
    metrics,
    companies: companies.map((company: any) => ({
      ...company,
      inadimplente: estaInadimplente(company),
    })),
    bugs,
    orders,
    proposals,
    snapshots,
  })
}
