import { NextRequest, NextResponse } from 'next/server'
import { canPlatform, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SearchItem = { kind: string; id: string; title: string; subtitle: string; href: string }

function term(value: string) {
  return value.trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 70)
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'portal.access')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const q = term(request.nextUrl.searchParams.get('q') || '')
  if (q.length < 2) return NextResponse.json({ items: [] })
  const db = session.supabaseAdmin
  const jobs: Array<Promise<{ data: unknown; error: unknown }>> = []
  const labels: string[] = []

  if (canPlatform(session.admin, 'companies.read')) { labels.push('company'); jobs.push(db.from('companies').select('id,nome,email,slug,assinatura_status').or(`nome.ilike.%${q}%,email.ilike.%${q}%,slug.ilike.%${q}%`).limit(6)) }
  if (canPlatform(session.admin, 'users.read')) { labels.push('user'); jobs.push(db.from('company_members').select('id,company_id,nome,email,cargo,status').or(`nome.ilike.%${q}%,email.ilike.%${q}%`).limit(6)) }
  if (canPlatform(session.admin, 'billing.read')) { labels.push('payment'); jobs.push(db.from('plan_payments').select('id,company_id,nome_empresa,email,status,valor,provider_payment_id').or(`nome_empresa.ilike.%${q}%,email.ilike.%${q}%,provider_payment_id.ilike.%${q}%`).limit(6)) }
  if (canPlatform(session.admin, 'partners.read')) { labels.push('partner'); jobs.push(db.from('affiliate_profiles').select('id,name,email,code,status').or(`name.ilike.%${q}%,email.ilike.%${q}%,code.ilike.%${q}%`).limit(6)) }
  if (canPlatform(session.admin, 'webhooks.read')) { labels.push('webhook'); jobs.push(db.from('payment_webhook_events').select('id,provider,event_type,provider_event_id,provider_object_id,processing_status').or(`provider_event_id.ilike.%${q}%,provider_object_id.ilike.%${q}%`).limit(6)) }

  const results = await Promise.all(jobs)
  const items: SearchItem[] = []
  results.forEach((result, index) => {
    if (result.error || !Array.isArray(result.data)) return
    const kind = labels[index]
    for (const raw of result.data as Array<Record<string, unknown>>) {
      if (kind === 'company') items.push({ kind, id: String(raw.id), title: String(raw.nome || raw.email || 'Empresa'), subtitle: `${String(raw.slug || '')} · ${String(raw.assinatura_status || 'sem status')}`, href: `/admin/empresas/${raw.id}` })
      if (kind === 'user') items.push({ kind, id: String(raw.id), title: String(raw.nome || raw.email || 'Usuário'), subtitle: `${String(raw.email || '')} · ${String(raw.cargo || '')}`, href: `/admin/usuarios?q=${encodeURIComponent(String(raw.email || ''))}` })
      if (kind === 'payment') items.push({ kind, id: String(raw.id), title: String(raw.nome_empresa || raw.email || 'Pagamento'), subtitle: `${String(raw.status || '')} · R$ ${Number(raw.valor || 0).toFixed(2)}`, href: `/admin/pagamentos?q=${encodeURIComponent(String(raw.provider_payment_id || raw.id))}` })
      if (kind === 'partner') items.push({ kind, id: String(raw.id), title: String(raw.name || raw.code || 'Parceiro'), subtitle: `${String(raw.code || '')} · ${String(raw.status || '')}`, href: '/admin/indicacoes/growth' })
      if (kind === 'webhook') items.push({ kind, id: String(raw.id), title: `${String(raw.provider || '')} · ${String(raw.event_type || '')}`, subtitle: `${String(raw.processing_status || '')} · ${String(raw.provider_object_id || raw.provider_event_id || '')}`, href: `/admin/webhooks?event=${raw.id}` })
    }
  })
  return NextResponse.json({ items: items.slice(0, 24) })
}
