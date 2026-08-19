import 'server-only'

import { getSupabaseAdmin } from '@/lib/company-access'

export type PublicStorefrontCompany = {
  id: string
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  whatsapp?: string | null
  business_type?: string | null
  site_primary_color?: string | null
  site_accent_color?: string | null
  site_seo_title?: string | null
  site_seo_description?: string | null
  marketplace_endereco?: string | null
  cidade?: string | null
  estado?: string | null
  ativo?: boolean | null
  site_publico_ativo?: boolean | null
}

export type PublicStorefrontProduct = {
  id: string
  nome?: string | null
  descricao?: string | null
  descricao_curta?: string | null
  categoria?: string | null
  preco?: number | string | null
  preco_promocional?: number | string | null
  promocao_ativa?: boolean | null
  preco_sob_consulta?: boolean | null
  imagem_url?: string | null
  image_urls?: string[] | null
  video_url?: string | null
  destaque?: boolean | null
  ativo?: boolean | null
  available?: boolean | null
  estoque?: number | null
  variations?: unknown
  addons?: unknown
  extras?: Record<string, unknown> | null
  created_at?: string | null
}

export type PublicStorefrontReview = {
  id: string
  rating: number
  comment?: string | null
  photo_url?: string | null
  company_reply?: string | null
  replied_at?: string | null
  created_at: string
}

function cleanSlug(value: unknown) {
  return String(value || '').trim().toLowerCase().slice(0, 80)
}

export function validProductId(value: unknown) {
  const id = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : ''
}

function missingTable(error: { code?: string; message?: string } | null | undefined, table: string) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes(table.toLowerCase()) && message.includes('does not exist')
}

export async function findPublicCompanyBySlug(value: unknown) {
  const slug = cleanSlug(value)
  if (!slug) return null
  const supabase = getSupabaseAdmin()
  const fields = 'id,nome,slug,subdomain_slug,logo_url,whatsapp,business_type,site_primary_color,site_accent_color,site_seo_title,site_seo_description,marketplace_endereco,cidade,estado,ativo,site_publico_ativo'

  const primary = await supabase.from('companies').select(fields).eq('slug', slug).limit(1).maybeSingle()
  if (primary.error) throw primary.error
  let company = primary.data

  if (!company) {
    const fallback = await supabase.from('companies').select(fields).eq('subdomain_slug', slug).limit(1).maybeSingle()
    if (fallback.error) throw fallback.error
    company = fallback.data
  }

  if (!company || company.ativo === false || company.site_publico_ativo === false) return null
  return company as unknown as PublicStorefrontCompany
}

export async function loadPublicStorefrontProduct(slugValue: unknown, productIdValue: unknown) {
  const company = await findPublicCompanyBySlug(slugValue)
  const productId = validProductId(productIdValue)
  if (!company || !productId) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('products')
    .select('id,nome,descricao,descricao_curta,categoria,preco,preco_promocional,promocao_ativa,preco_sob_consulta,imagem_url,image_urls,video_url,destaque,ativo,available,estoque,variations,addons,extras,created_at')
    .eq('company_id', company.id)
    .eq('id', productId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data || data.ativo === false || data.available === false) return null

  return { company, product: data as unknown as PublicStorefrontProduct }
}

export async function loadRelatedStorefrontProducts(companyId: string, product: PublicStorefrontProduct, limit = 4) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('products')
    .select('id,nome,descricao_curta,categoria,preco,preco_promocional,promocao_ativa,preco_sob_consulta,imagem_url,image_urls,destaque,ativo,available,estoque,created_at')
    .eq('company_id', companyId)
    .neq('id', product.id)
    .or('ativo.is.null,ativo.eq.true')
    .or('available.is.null,available.eq.true')
    .limit(Math.max(1, Math.min(limit, 8)))

  const category = String(product.categoria || '').trim()
  if (category) query = query.eq('categoria', category)

  const { data, error } = await query.order('destaque', { ascending: false }).order('created_at', { ascending: false })
  if (error) return []
  return (data || []) as unknown as PublicStorefrontProduct[]
}

export async function loadPublicProductReviews(companyId: string, productIdValue: unknown) {
  const productId = validProductId(productIdValue)
  if (!productId) return { schemaReady: true, reviews: [] as PublicStorefrontReview[], average: null as number | null, total: 0 }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('storefront_reviews')
    .select('id,rating,comment,photo_url,company_reply,replied_at,created_at')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    if (missingTable(error, 'storefront_reviews')) return { schemaReady: false, reviews: [] as PublicStorefrontReview[], average: null as number | null, total: 0 }
    return { schemaReady: true, reviews: [] as PublicStorefrontReview[], average: null as number | null, total: 0 }
  }

  const reviews = (data || []) as unknown as PublicStorefrontReview[]
  const average = reviews.length ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)) : null
  return { schemaReady: true, reviews, average, total: reviews.length }
}

export function productPrice(product: PublicStorefrontProduct) {
  if (product.preco_sob_consulta) return null
  const promotional = product.promocao_ativa ? Number(product.preco_promocional || 0) : 0
  const regular = Number(product.preco || 0)
  const value = promotional > 0 ? promotional : regular
  return Number.isFinite(value) && value > 0 ? value : null
}

export function productImages(product: PublicStorefrontProduct) {
  const images = Array.isArray(product.image_urls) ? product.image_urls.filter((item): item is string => typeof item === 'string' && Boolean(item)).slice(0, 8) : []
  if (images.length) return images
  return product.imagem_url ? [product.imagem_url] : []
}
