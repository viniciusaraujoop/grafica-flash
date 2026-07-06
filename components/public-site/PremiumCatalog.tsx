'use client'

import { useMemo, useState } from 'react'
import type { PublicSiteCompany, PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'
import FoodMarketplaceCatalog from '@/components/public-site/FoodMarketplaceCatalog'
import { getCatalogLabels, getFallbackCatalogCategories, normalizeCatalogBusinessType } from '@/lib/catalog-labels'
import {
  getCommercialBadges,
  getPrimaryProductImage,
  getProductImages,
  getProductPhotoCount,
  getProductPriceLabel,
  getProductPriceNumber,
  getProductStatusLabel,
  isProductAvailable,
  isProductHighlighted,
  isProductPromotion,
  isProductConsultOnly,
  productHasVideo,
} from '@/lib/product-media'

type CatalogProduct = PublicSiteProduct & {
  tipo?: string | null
  unidade?: string | null
  unidade_label?: string | null
  precificacao?: string | null
  created_at?: string | null
}

type PremiumCatalogProps = {
  company: PublicSiteCompany
  products: CatalogProduct[]
  businessType: string
  primaryColor: string
  accentColor: string
  fallbackTitle: string
  fallbackText: string
  ctaLabel?: string
}

type FilterKey = 'todos' | 'disponiveis' | 'destaques' | 'promocoes' | 'sob_consulta'
type SortKey = 'recentes' | 'az' | 'menor_preco' | 'maior_preco' | 'disponiveis' | 'destaques'

const filterLabels: Array<{ id: FilterKey; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'disponiveis', label: 'Disponíveis' },
  { id: 'destaques', label: 'Destaques' },
  { id: 'promocoes', label: 'Promoções' },
  { id: 'sob_consulta', label: 'Sob consulta' },
]

function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(company: PublicSiteCompany, message: string) {
  const phone = phoneOnly(company.whatsapp)

  if (!phone || phone.length < 10) return '#contato'

  const normalized = phone.startsWith('55') ? phone : `55${phone}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

function shortText(value?: string | null, fallback = 'Confira os detalhes pelo WhatsApp.') {
  const text = String(value || '').trim()
  if (!text) return fallback
  if (text.length <= 138) return text

  return `${text.slice(0, 135).trim()}...`
}

function getCategory(product: CatalogProduct) {
  return product.categoria?.trim() || 'Sem categoria'
}

function getProductName(product: CatalogProduct) {
  return product.nome || 'Produto'
}

function productMatchesSearch(product: CatalogProduct, search: string) {
  const text = `${product.nome || ''} ${product.descricao || ''} ${product.descricao_curta || ''} ${product.categoria || ''}`.toLowerCase()
  return text.includes(search.toLowerCase())
}

function sortProducts(products: CatalogProduct[], sort: SortKey) {
  const list = [...products]

  if (sort === 'az') {
    return list.sort((a, b) => getProductName(a).localeCompare(getProductName(b), 'pt-BR'))
  }

  if (sort === 'menor_preco') {
    return list.sort((a, b) => getProductPriceNumber(a) - getProductPriceNumber(b))
  }

  if (sort === 'maior_preco') {
    return list.sort((a, b) => getProductPriceNumber(b) - getProductPriceNumber(a))
  }

  if (sort === 'disponiveis') {
    return list.sort((a, b) => Number(isProductAvailable(b)) - Number(isProductAvailable(a)))
  }

  if (sort === 'destaques') {
    return list.sort((a, b) => Number(isProductHighlighted(b)) - Number(isProductHighlighted(a)))
  }

  return list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

function MediaPreview({ product, tall = false }: { product: CatalogProduct; tall?: boolean }) {
  const image = getPrimaryProductImage(product)
  const photoCount = getProductPhotoCount(product)
  const hasVideo = productHasVideo(product)

  return (
    <div className={`relative overflow-hidden rounded-[1.7rem] bg-slate-100 ${tall ? 'h-72' : 'h-56'}`}>
      {image ? (
        <img src={image} alt={getProductName(product)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <div className="grid h-full place-items-center bg-gradient-to-br from-blue-50 to-slate-100 text-center text-sm font-black text-slate-400">
          Sem foto
        </div>
      )}

      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        {photoCount > 1 ? (
          <span className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-black text-[#05245c] shadow-lg shadow-blue-950/10">
            {photoCount} fotos
          </span>
        ) : null}
        {hasVideo ? (
          <span className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-black text-[#05245c] shadow-lg shadow-blue-950/10">
            Vídeo
          </span>
        ) : null}
      </div>

      {!isProductAvailable(product) ? (
        <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/94 px-4 py-3 text-center text-sm font-black text-red-700 shadow-lg shadow-blue-950/10">
          Indisponível no momento
        </div>
      ) : null}
    </div>
  )
}

function ProductCard({
  product,
  company,
  primaryColor,
  actionLabel,
  onOpen,
}: {
  product: CatalogProduct
  company: PublicSiteCompany
  primaryColor: string
  actionLabel: string
  onOpen: () => void
}) {
  const badges = getCommercialBadges(product)
  const available = isProductAvailable(product)
  const message = `${actionLabel}: ${getProductName(product)} - ${company.nome || 'Empresa Orçaly'}`

  return (
    <article id={`produto-${product.id}`} className="group overflow-hidden rounded-[2.2rem] border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/6 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/12">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Ver detalhes de ${getProductName(product)}`}>
        <MediaPreview product={product} />
      </button>

      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">
            {getCategory(product)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {getProductStatusLabel(product)}
          </span>
          {badges.slice(0, 2).map((badge) => (
            <span key={badge} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              {badge}
            </span>
          ))}
        </div>

        <button type="button" onClick={onOpen} className="mt-4 block text-left">
          <h3 className="text-2xl font-black tracking-[-0.045em] text-[#071b3a] transition group-hover:text-[#05245c]">
            {getProductName(product)}
          </h3>
        </button>

        <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-slate-500">
          {shortText(product.descricao_curta || product.descricao)}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-2xl font-black text-[#05245c]">
            {getProductPriceLabel(product)}
          </p>

          <div className="flex gap-2">
            <button type="button" onClick={onOpen} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c]">
              Detalhes
            </button>
            <a
              href={whatsappLink(company, message)}
              target="_blank"
              rel="noreferrer"
              className={`rounded-2xl px-4 py-3 text-sm font-black text-white ${available ? '' : 'pointer-events-none opacity-50'}`}
              style={{ background: available ? primaryColor : '#cbd5e1' }}
            >
              {actionLabel}
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

function ProductDetailModal({
  product,
  company,
  actionLabel,
  primaryColor,
  onClose,
}: {
  product: CatalogProduct
  company: PublicSiteCompany
  actionLabel: string
  primaryColor: string
  onClose: () => void
}) {
  const images = getProductImages(product)
  const badges = getCommercialBadges(product)
  const available = isProductAvailable(product)
  const message = `${actionLabel}: ${getProductName(product)} - ${company.nome || 'Empresa Orçaly'}`

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b3a]/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2.4rem] bg-white p-4 shadow-2xl shadow-blue-950/30">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            {product.video_url ? (
              <video src={product.video_url} controls muted className="h-80 w-full rounded-[1.9rem] bg-slate-100 object-cover" />
            ) : (
              <MediaPreview product={product} tall />
            )}

            {images.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((image) => (
                  <img key={image} src={image} alt={getProductName(product)} className="h-20 rounded-2xl object-cover" />
                ))}
              </div>
            ) : null}
          </div>

          <div className="p-2 sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">{getCategory(product)}</p>
                <h3 className="mt-2 text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#071b3a]">{getProductName(product)}</h3>
              </div>
              <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-500">
                Fechar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-black ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {getProductStatusLabel(product)}
              </span>
              {badges.map((badge) => (
                <span key={badge} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                  {badge}
                </span>
              ))}
              {productHasVideo(product) ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">Vídeo</span> : null}
            </div>

            <p className="mt-5 text-3xl font-black text-[#05245c]">{getProductPriceLabel(product)}</p>
            <p className="mt-4 whitespace-pre-line text-sm font-bold leading-7 text-slate-500">
              {product.descricao || product.descricao_curta || 'Chame no WhatsApp para ver todos os detalhes deste item.'}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#f5f8ff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Fotos</p>
                <p className="mt-1 font-black text-[#071b3a]">{getProductPhotoCount(product) || 'Sem fotos'}</p>
              </div>
              <div className="rounded-2xl bg-[#f5f8ff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Categoria</p>
                <p className="mt-1 font-black text-[#071b3a]">{getCategory(product)}</p>
              </div>
            </div>

            <a
              href={whatsappLink(company, message)}
              target="_blank"
              rel="noreferrer"
              className={`mt-6 block rounded-2xl px-5 py-4 text-center font-black text-white ${available ? '' : 'pointer-events-none opacity-50'}`}
              style={{ background: available ? primaryColor : '#cbd5e1' }}
            >
              {actionLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PremiumCatalog({
  company,
  products,
  businessType,
  primaryColor,
  accentColor,
  fallbackTitle,
  fallbackText,
}: PremiumCatalogProps) {
  const normalizedType = normalizeCatalogBusinessType(businessType || company.business_type || company.site_template)

  const labels = getCatalogLabels(normalizedType)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [filter, setFilter] = useState<FilterKey>('todos')
  const [sort, setSort] = useState<SortKey>('destaques')
  const [selected, setSelected] = useState<CatalogProduct | null>(null)

  const safeProducts = useMemo(
    () => products.filter((product) => product.ativo !== false),
    [products]
  )

  const realCategories = useMemo(
    () => Array.from(new Set(safeProducts.map((product) => product.categoria?.trim()).filter(Boolean) as string[])),
    [safeProducts]
  )

  const suggestedCategories = realCategories.length ? realCategories : getFallbackCatalogCategories(normalizedType)
  const featuredProducts = useMemo(
    () => safeProducts.filter(isProductHighlighted).slice(0, 4),
    [safeProducts]
  )

  const filteredProducts = useMemo(() => {
    const filtered = safeProducts.filter((product) => {
      if (search && !productMatchesSearch(product, search)) return false
      if (category !== 'Todos' && realCategories.includes(category) && getCategory(product) !== category) return false
      if (filter === 'disponiveis' && !isProductAvailable(product)) return false
      if (filter === 'destaques' && !isProductHighlighted(product)) return false
      if (filter === 'promocoes' && !isProductPromotion(product)) return false
      if (filter === 'sob_consulta' && !isProductConsultOnly(product)) return false

      return true
    })

    return sortProducts(filtered, sort)
  }, [category, filter, realCategories, safeProducts, search, sort])

  const actionLabel = labels.actionLabel
  const title = labels.catalogTitle || fallbackTitle
  const text = fallbackText || 'Veja opções, detalhes e chame no WhatsApp para continuar.'

  if (normalizedType === 'food') {
    return (
      <FoodMarketplaceCatalog
        company={company}
        products={products}
        primaryColor={primaryColor}
        accentColor={accentColor}
        fallbackTitle={fallbackTitle}
        fallbackText={fallbackText}
      />
    )
  }

  return (
    <section id="catalogo" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="text-center lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
              {title}
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.055em] text-[#071b3a] sm:text-6xl">
              Uma vitrine clara para escolher sem adivinhar
            </h2>
            <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-500 lg:mx-0">
              {text}
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Catálogo</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-[#f5f8ff] p-3">
                <p className="text-2xl font-black text-[#05245c]">{safeProducts.length}</p>
                <p className="text-[11px] font-black text-slate-400">Itens</p>
              </div>
              <div className="rounded-2xl bg-[#f5f8ff] p-3">
                <p className="text-2xl font-black text-[#05245c]">{realCategories.length}</p>
                <p className="text-[11px] font-black text-slate-400">Categorias</p>
              </div>
              <div className="rounded-2xl bg-[#f5f8ff] p-3">
                <p className="text-2xl font-black text-[#05245c]">{featuredProducts.length}</p>
                <p className="text-[11px] font-black text-slate-400">Destaques</p>
              </div>
            </div>
          </div>
        </div>

        {featuredProducts.length ? (
          <div className="mt-10 rounded-[2.4rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/8 sm:p-5">
            <div className="flex flex-col justify-between gap-3 p-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: primaryColor }}>{labels.featuredTitle}</p>
                <h3 className="mt-1 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">Escolhas rápidas para o cliente</h3>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-500">{labels.featuredText}</p>
              </div>
              <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">Destaques</span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  company={company}
                  primaryColor={primaryColor}
                  actionLabel={actionLabel}
                  onOpen={() => setSelected(product)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar ${labels.itemLabel.toLowerCase()} por nome, descrição ou categoria...`}
              className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-bold outline-none transition focus:border-[#05245c]"
            />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-black text-[#05245c] outline-none"
            >
              <option value="destaques">Destaques primeiro</option>
              <option value="recentes">Mais recentes</option>
              <option value="az">Nome A-Z</option>
              <option value="menor_preco">Menor preço</option>
              <option value="maior_preco">Maior preço</option>
              <option value="disponiveis">Disponíveis primeiro</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterLabels.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${filter === item.id ? 'text-white' : 'border border-blue-100 bg-white text-[#05245c]'}`}
                style={filter === item.id ? { background: primaryColor } : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('Todos')}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${category === 'Todos' ? 'text-white' : 'border border-blue-100 bg-white text-[#05245c]'}`}
              style={category === 'Todos' ? { background: accentColor } : undefined}
            >
              Todos
            </button>
            {suggestedCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${category === item ? 'text-white' : 'border border-blue-100 bg-white text-[#05245c]'}`}
                style={category === item ? { background: accentColor } : undefined}
              >
                {item}
              </button>
            ))}
          </div>

          {!realCategories.length && safeProducts.length ? (
            <p className="mt-3 text-xs font-bold text-slate-400">
              Categorias sugeridas por segmento. Cadastre categorias nos itens para ativar filtros reais.
            </p>
          ) : null}
        </div>

        {safeProducts.length ? (
          filteredProducts.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  company={company}
                  primaryColor={primaryColor}
                  actionLabel={actionLabel}
                  onOpen={() => setSelected(product)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-3xl">🔎</div>
              <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">Nenhum item encontrado.</h3>
              <p className="mx-auto mt-2 max-w-xl font-bold leading-7 text-slate-500">
                Ajuste a busca ou os filtros para ver outros itens do catálogo.
              </p>
            </div>
          )
        ) : (
          <div className="mt-8 rounded-[2.4rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.8rem] bg-blue-50 text-4xl">✨</div>
            <h3 className="mt-5 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">{labels.emptyTitle}</h3>
            <p className="mx-auto mt-3 max-w-2xl font-bold leading-8 text-slate-500">
              {labels.emptyText}
            </p>
            <a href={whatsappLink(company, `Olá, quero saber mais sobre ${company.nome || 'a empresa'}.`)} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-2xl px-6 py-4 font-black text-white" style={{ background: primaryColor }}>
              Falar pelo WhatsApp
            </a>
          </div>
        )}
      </div>

      {selected ? (
        <ProductDetailModal
          product={selected}
          company={company}
          actionLabel={actionLabel}
          primaryColor={primaryColor}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  )
}
