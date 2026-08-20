import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { findPublicCompanyBySlug } from '@/lib/storefront/public-product'
import { getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedEvents = new Set(['page_view', 'product_view', 'favorite_add', 'add_to_cart', 'checkout_start'])

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('storefront_events') && message.includes('does not exist')
}

function sessionHash(companyId: string, raw: unknown) {
  const value = String(raw || '').trim().slice(0, 120)
  if (!value) return null
  return createHash('sha256').update(`${companyId}:${value}`).digest('hex')
}

function uuid(value: unknown) {
  const id = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const company = await findPublicCompanyBySlug(slug)
  if (!company) return NextResponse.json({ error: 'Site não encontrado.' }, { status: 404 })

  const blocked = await enforceRateLimit(request, {
    scope: `storefront-events:${company.id}`,
    limit: 90,
    windowSeconds: 60,
    failOpen: true,
  })
  if (blocked) return blocked

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const eventType = String(body.eventType || '').trim().toLowerCase()
  if (!allowedEvents.has(eventType)) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })

  const productId = uuid(body.productId)
  if (productId && ['product_view', 'favorite_add', 'add_to_cart'].includes(eventType)) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('products').select('id').eq('id', productId).eq('company_id', company.id).limit(1).maybeSingle()
    if (error) return NextResponse.json({ error: 'Não foi possível validar o item.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('storefront_events').insert({
    company_id: company.id,
    event_type: eventType,
    product_id: productId,
    session_hash: sessionHash(company.id, body.sessionId),
    metadata: {},
  })

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ ok: true, recorded: false, schemaReady: false }, { status: 202 })
    return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recorded: true })
}
