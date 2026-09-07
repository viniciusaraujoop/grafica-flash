import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function missingTable(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('storefront_events') && message.includes('does not exist')
}

function clampDays(value: string | null) {
  const parsed = Number(value || 30)
  return [7, 30, 90].includes(parsed) ? parsed : 30
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const requester = await getRequester(request, supabase)
  if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const access = await getCompanyAccess(supabase, requester.id, requester.email)
  if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  const days = clampDays(request.nextUrl.searchParams.get('days'))
  const start = new Date(Date.now() - days * 86400000).toISOString()
  const { data: events, error } = await supabase
    .from('storefront_events')
    .select('event_type,product_id,search_query,result_count,session_hash,created_at')
    .eq('company_id', access.company.id)
    .gte('created_at', start)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) {
    if (missingTable(error)) {
      return NextResponse.json({
        schemaReady: false,
        periodDays: days,
        metrics: { visitors: 0, pageViews: 0, productViews: 0, searches: 0, favorites: 0, addToCart: 0, checkoutStarts: 0, orders: 0, conversion: 0 },
        topProducts: [],
        searchGaps: [],
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = events || []
  const count = (type: string) => rows.filter((row) => row.event_type === type).length
  const sessions = new Set(rows.map((row) => row.session_hash).filter(Boolean)).size
  const productCounts = new Map<string, number>()
  const searchGaps = new Map<string, number>()

  for (const row of rows) {
    if (row.event_type === 'product_view' && row.product_id) productCounts.set(row.product_id, (productCounts.get(row.product_id) || 0) + 1)
    if (row.event_type === 'search' && Number(row.result_count || 0) === 0 && row.search_query) searchGaps.set(row.search_query, (searchGaps.get(row.search_query) || 0) + 1)
  }

  const productIds = Array.from(productCounts.keys()).slice(0, 50)
  const productsResult = productIds.length
    ? await supabase.from('products').select('id,nome').eq('company_id', access.company.id).in('id', productIds)
    : { data: [], error: null }
  const nameById = new Map((productsResult.data || []).map((product) => [product.id, product.nome || 'Produto']))

  const ordersResult = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', access.company.id)
    .not('checkout_idempotency_key', 'is', null)
    .gte('created_at', start)
  const orders = ordersResult.error ? 0 : Number(ordersResult.count || 0)
  const pageViews = count('page_view')
  const denominator = sessions || pageViews

  return NextResponse.json({
    schemaReady: true,
    periodDays: days,
    partial: rows.length >= 10000 || Boolean(productsResult.error || ordersResult.error),
    metrics: {
      visitors: sessions,
      pageViews,
      productViews: count('product_view'),
      searches: count('search'),
      favorites: count('favorite_add'),
      addToCart: count('add_to_cart'),
      checkoutStarts: count('checkout_start'),
      orders,
      conversion: denominator > 0 ? Number(((orders / denominator) * 100).toFixed(1)) : 0,
    },
    topProducts: Array.from(productCounts.entries())
      .map(([id, views]) => ({ id, name: nameById.get(id) || 'Produto', views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    searchGaps: Array.from(searchGaps.entries())
      .map(([query, searches]) => ({ query, searches }))
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 10),
  })
}
