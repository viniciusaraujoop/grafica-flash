import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Json = Record<string, unknown>
function clean(value: string) { return value.trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 100) }

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'billing.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const q = clean(request.nextUrl.searchParams.get('q') || '')
  const status = clean(request.nextUrl.searchParams.get('status') || '')
  const provider = clean(request.nextUrl.searchParams.get('provider') || '')
  const plan = clean(request.nextUrl.searchParams.get('plan') || '')
  const before = request.nextUrl.searchParams.get('before')
  const limit = Math.min(50, Math.max(10, Number(request.nextUrl.searchParams.get('limit') || 30)))
  let query = session.supabaseAdmin.from('plan_payments').select('id,company_id,nome_empresa,email,plano,valor,status,tipo,payment_method,provider,billing_type,provider_payment_id,provider_subscription_id,created_at,updated_at,paid_at,next_payment_date,cancelled_at').order('created_at', { ascending: false }).limit(limit + 1)
  if (q) query = query.or(`nome_empresa.ilike.%${q}%,email.ilike.%${q}%,provider_payment_id.ilike.%${q}%,provider_subscription_id.ilike.%${q}%`)
  if (status) query = query.eq('status', status)
  if (provider) query = query.eq('provider', provider)
  if (plan) query = query.eq('plano', plan)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []) as Json[]
  const page = rows.slice(0, limit)
  return NextResponse.json({ rows: page, hasMore: rows.length > limit, nextCursor: rows.length > limit ? String(page[page.length - 1]?.created_at || '') : null })
}
