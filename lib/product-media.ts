export type ProductMediaLike = {
  imagem_url?: string | null
  image_urls?: string[] | null
  video_url?: string | null
  preco?: number | string | null
  preco_sob_consulta?: boolean | null
  precificacao?: string | null
  ativo?: boolean | null
  available?: boolean | null
  destaque?: boolean | null
  categoria?: string | null
  extras?: Record<string, unknown> | null
}

function cleanUrl(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function numberFromValue(value: unknown) {
  if (typeof value === 'number') return value

  const numeric = Number(String(value || '').replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : 0
}

function extras(product: ProductMediaLike) {
  return product.extras && typeof product.extras === 'object' && !Array.isArray(product.extras) ? product.extras : {}
}

export function getProductImages(product: ProductMediaLike) {
  const urls = Array.isArray(product.image_urls) ? product.image_urls.map(cleanUrl).filter(Boolean) : []
  const legacy = cleanUrl(product.imagem_url)

  const merged = [...urls, legacy].filter(Boolean)
  return Array.from(new Set(merged)).slice(0, 8)
}

export function getPrimaryProductImage(product: ProductMediaLike) {
  return getProductImages(product)[0] || ''
}

export function getProductPhotoCount(product: ProductMediaLike) {
  return getProductImages(product).length
}

export function productHasVideo(product: ProductMediaLike) {
  return cleanUrl(product.video_url).length > 0
}

export function isProductAvailable(product: ProductMediaLike) {
  return product.available !== false && product.ativo !== false
}

export function isProductHighlighted(product: ProductMediaLike) {
  const data = extras(product)
  return Boolean(
    product.destaque ||
    data.destaque ||
    data.featured ||
    data.highlight ||
    data.mais_pedido ||
    data.novo ||
    data.promocao ||
    data.promotion
  )
}

export function isProductPromotion(product: ProductMediaLike) {
  const data = extras(product)
  return Boolean(data.promocao || data.promotion || data.offer || data.oferta)
}

export function isProductNew(product: ProductMediaLike) {
  const data = extras(product)
  return Boolean(data.novo || data.new)
}

export function isProductBestSeller(product: ProductMediaLike) {
  const data = extras(product)
  return Boolean(data.mais_pedido || data.best_seller || data.bestseller)
}

export function isProductConsultOnly(product: ProductMediaLike) {
  const price = numberFromValue(product.preco)
  const pricing = String(product.precificacao || '').toLowerCase()
  const data = extras(product)

  return Boolean(product.preco_sob_consulta || data.sob_consulta || pricing === 'sob_consulta' || price <= 0)
}

export function getProductPriceNumber(product: ProductMediaLike) {
  return numberFromValue(product.preco)
}

export function getProductPriceLabel(product: ProductMediaLike) {
  if (isProductConsultOnly(product)) return 'Sob consulta'

  return getProductPriceNumber(product).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function getProductStatusLabel(product: ProductMediaLike) {
  if (!isProductAvailable(product)) return 'Indisponível'
  if (isProductConsultOnly(product)) return 'Sob consulta'

  return 'Disponível'
}

export function getCommercialBadges(product: ProductMediaLike) {
  const badges: string[] = []

  if (isProductBestSeller(product)) badges.push('Mais pedido')
  if (isProductNew(product)) badges.push('Novo')
  if (isProductPromotion(product)) badges.push('Promoção')
  if (isProductHighlighted(product)) badges.push('Destaque')
  if (isProductConsultOnly(product)) badges.push('Sob consulta')

  return Array.from(new Set(badges)).slice(0, 3)
}
