import { NextRequest, NextResponse } from 'next/server'
import { companySubscriptionState } from '@/lib/admin/control-center-v2'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

function safeTerm(value: string) {
  return value.trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'companies.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const q = safeTerm(request.nextUrl.searchParams.get('q') || '')
  const status = String(request.nextUrl.searchParams.get('status') || 'all').toLowerCase()
  const cursor = request.nextUrl.searchParams.get('before')
  const limit = Math.min(50, Math.max(10, Number(request.nextUrl.searchParams.get('limit') || 30)))

  let query = session.supabaseAdmin.from('companies').select('id,nome,email,whatsapp,slug,logo_url,segmento,plano,assinatura_plano,assinatura_status,ativo,created_at,updated_at,trial_ends_at,access_until,assinatura_expira_em,cancel_at_period_end,next_billing_at,assinatura_proxima_cobranca,onboarding_completed,site_publico_ativo,marketplace_ativo,is_founder,founder_number').order('created_at', { ascending: false }).limit(limit + 1)
  if (q) query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%,slug.ilike.%${q}%`)
  if (cursor) query = query.lt('created_at', cursor)
  if (status === 'inactive') query = query.eq('ativo', false)
  if (status === 'trial') query = query.in('assinatura_status', ['trial', 'trialing', 'teste'])
  if (status === 'overdue') query = query.in('assinatura_status', ['past_due', 'overdue', 'late', 'unpaid', 'atrasado', 'inadimplente'])
  if (status === 'canceling') query = query.or('cancel_at_period_end.eq.true,assinatura_status.in.(cancel_at_period_end,cancelled,canceled,cancelada,cancelado)')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []) as JsonRecord[]
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit).map((company) => ({ ...company, state: companySubscriptionState(company) }))
  return NextResponse.json({ rows: page, nextCursor: hasMore ? String(page[page.length - 1]?.created_at || '') : null, hasMore })
}
