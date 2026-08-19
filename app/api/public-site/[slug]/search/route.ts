import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { findPublicCompanyBySlug } from '@/lib/storefront/public-product'
import { getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanTerm(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[,%()'"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

function priceLabel(product: Record<string, unknown>) {
  if (product.preco_sob_consulta === true) return 'Sob consulta'
  const promotional = product.promocao_ativa === true ? Number(product.preco_promocional || 0) : 0
  const price = promotional > 0 ? promotional : Number(product.preco || 0)
  if (!Number.isFinite(price) || price <= 0) return 'Sob consulta'
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function missingEventsTable(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('storefront_events') && message.includes('does not exist')
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const term = cleanTerm(request.nextUrl.searchParams.get('q'))
  if (term.length < 2) return NextResponse.json({ items: [] })

  const company = await findPublicCompanyBySlug(slug)
  if (!company) return NextResponse.json({ error: 'Site não encontrado.' }, { status: 404 })

  const blocked = await enforceRateLimit(request, {
    scope: `storefront-search:${company.id}`,
    limit: 80,
    windowSeconds: 60,
    failOpen: true,
  })
  if (blocked) return blocked

  const supabase = getSupabaseAdmin()
  const filter = `nome.ilike.%${term}%,descricao.ilike.%${term}%,descricao_curta.ilike.%${term}%,categoria.ilike.%${term}%`
  const { data, error } = await supabase
    .from('products')
    .select('id,nome,categoria,imagem_url,image_urls,preco,preco_promocional,promocao_ativa,preco_sob_consulta,ativo,available')
    .eq('company_id', company.id)
    .or(filter)
    .or('ativo.is.null,ativo.eq.true')
    .order('destaque', { ascending: false })
    .limit(8)

  if (error) return NextResponse.json({ error: 'Não foi possível buscar no catálogo.' }, { status: 500 })
  const rows = data || []

  const session = String(request.headers.get('x-storefront-session') || '').trim().slice(0, 120)
  const sessionHash = session ? createHash('sha256').update(`${company.id}:${session}`).digest('hex') : null
  const analytics = await supabase.from('storefront_events').insert({
    company_id: company.id,
    event_type: 'search',
    search_query: term.toLowerCase(),
    result_count: rows.length,
    session_hash: sessionHash,
    metadata: {},
  })
  if (analytics.error && !missingEventsTable(analytics.error)) {
    // Analytics is best-effort and must never break storefront discovery.
  }

  return NextResponse.json({
    items: rows.map((product) => {
      const images = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : []
      return {
        id: product.id,
        name: product.nome || 'Produto',
        category: product.categoria || 'Catálogo',
        imageUrl: images[0] || product.imagem_url || null,
        priceLabel: priceLabel(product as Record<string, unknown>),
        available: product.available !== false && product.ativo !== false,
      }
    }),
  })
}
