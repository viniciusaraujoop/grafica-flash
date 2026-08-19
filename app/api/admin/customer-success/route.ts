import { NextRequest, NextResponse } from 'next/server'
import { calculateCompanyHealth, companySubscriptionState } from '@/lib/admin/control-center-v2'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Json = Record<string, unknown>

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'companies.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const db = session.supabaseAdmin
  const [companiesR, ordersR, productsR, customersR, integrationsR, paymentsR, authR] = await Promise.all([
    db.from('companies').select('id,nome,email,slug,segmento,owner_id,logo_url,plano,assinatura_plano,assinatura_status,ativo,created_at,updated_at,trial_ends_at,access_until,assinatura_expira_em,cancel_at_period_end,onboarding_current_step,onboarding_completed,site_publico_ativo,marketplace_ativo,whatsapp_enabled,whatsapp').order('created_at', { ascending: false }).limit(300),
    db.from('orders').select('id,company_id,created_at').order('created_at', { ascending: false }).limit(3000),
    db.from('products').select('id,company_id,created_at').order('created_at', { ascending: false }).limit(3000),
    db.from('customers').select('id,company_id,created_at').order('created_at', { ascending: false }).limit(3000),
    db.from('marketplace_payment_settings').select('company_id,is_active,last_error,updated_at').limit(1000),
    db.from('plan_payments').select('id,company_id,status,paid_at,created_at').order('created_at', { ascending: false }).limit(3000),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  const errors = [companiesR, ordersR, productsR, customersR, integrationsR, paymentsR].map((item) => item.error).filter(Boolean)
  if (errors.length) return NextResponse.json({ error: errors[0]?.message || 'Falha ao montar Customer Success.' }, { status: 500 })
  const companies = (companiesR.data || []) as Json[]
  const counts = (rows: Array<{ company_id?: string | null }>) => { const map = new Map<string, number>(); for (const row of rows) { const id = String(row.company_id || ''); if (id) map.set(id, (map.get(id) || 0) + 1) } return map }
  const orders = (ordersR.data || []) as Array<{ company_id?: string | null; created_at?: string | null }>
  const productCounts = counts((productsR.data || []) as Array<{ company_id?: string | null }>)
  const customerCounts = counts((customersR.data || []) as Array<{ company_id?: string | null }>)
  const orderCounts = counts(orders)
  const lastOrder = new Map<string,string>(); for (const row of orders) { const id = String(row.company_id || ''); if (id && row.created_at && !lastOrder.has(id)) lastOrder.set(id, row.created_at) }
  const integrations = new Map<string,{ active:boolean; error:string|null }>(); for (const row of integrationsR.data || []) integrations.set(String(row.company_id), { active: Boolean(row.is_active), error: row.last_error ? String(row.last_error) : null })
  const paid = new Set((paymentsR.data || []).filter((row) => ['paid','approved','authorized'].includes(String(row.status || '').toLowerCase())).map((row) => String(row.company_id || '')))
  const users = new Map((authR.data?.users || []).map((user) => [user.id, user.last_sign_in_at || null]))

  const rows = companies.map((company) => {
    const id = String(company.id)
    const integration = integrations.get(id)
    const health = calculateCompanyHealth({ company, lastLoginAt: users.get(String(company.owner_id || '')) || null, orderCount: orderCounts.get(id) || 0, lastOrderAt: lastOrder.get(id) || null, productCount: productCounts.get(id) || 0, customerCount: customerCounts.get(id) || 0, integrations: integration ? [integration] : [] })
    return { id, nome: company.nome, email: company.email, segmento: company.segmento, plan: company.assinatura_plano || company.plano, state: companySubscriptionState(company), health, lastLoginAt: users.get(String(company.owner_id || '')) || null, usage: { orders: orderCounts.get(id) || 0, products: productCounts.get(id) || 0, customers: customerCounts.get(id) || 0, lastOrderAt: lastOrder.get(id) || null }, onboarding: { completed: company.onboarding_completed === true, step: company.onboarding_current_step || null }, createdAt: company.created_at }
  }).sort((a,b) => a.health.score - b.health.score)

  const stage = {
    account: companies.length,
    configured: companies.filter((c) => Boolean(c.nome && c.segmento)).length,
    segment: companies.filter((c) => Boolean(c.segmento)).length,
    logo: companies.filter((c) => Boolean(c.logo_url)).length,
    product: companies.filter((c) => (productCounts.get(String(c.id)) || 0) > 0).length,
    site: companies.filter((c) => c.site_publico_ativo === true || c.marketplace_ativo === true).length,
    whatsapp: companies.filter((c) => c.whatsapp_enabled === true || Boolean(c.whatsapp)).length,
    payment: companies.filter((c) => paid.has(String(c.id))).length,
    firstOrder: companies.filter((c) => (orderCounts.get(String(c.id)) || 0) > 0).length,
  }
  const stuck = rows.filter((row) => !row.onboarding.completed && row.createdAt && Date.now() - new Date(String(row.createdAt)).getTime() > 7 * 86400000).slice(0, 30)
  return NextResponse.json({ generatedAt: new Date().toISOString(), quality: { companiesCapped: companies.length >= 300, ordersCapped: (ordersR.data || []).length >= 3000, productsCapped: (productsR.data || []).length >= 3000, customersCapped: (customersR.data || []).length >= 3000, authUsersCapped: (authR.data?.users || []).length >= 1000 }, summary: { healthy: rows.filter((r) => r.health.label === 'HEALTHY').length, attention: rows.filter((r) => r.health.label === 'ATTENTION').length, atRisk: rows.filter((r) => r.health.label === 'AT_RISK').length }, rows, onboarding: { stage, stuck } })
}
