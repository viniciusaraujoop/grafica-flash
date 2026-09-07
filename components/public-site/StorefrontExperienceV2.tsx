'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicSiteCompany, PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'

type SearchResult = {
  id: string
  name: string
  category: string
  imageUrl: string | null
  priceLabel: string
  available: boolean
}

type BusinessHour = {
  weekday?: number | null
  is_open?: boolean | null
  open_time?: string | null
  close_time?: string | null
  break_start?: string | null
  break_end?: string | null
  closed_message?: string | null
}

type StorefrontCompany = PublicSiteCompany & {
  business_hours?: BusinessHour[] | null
  delivery_zones?: Array<{ id?: string; is_active?: boolean | null }> | null
  site_background_color?: string | null
  site_text_color?: string | null
  site_card_color?: string | null
  site_density?: string | null
  site_corner_style?: string | null
  site_nav_variant?: string | null
  site_footer_text?: string | null
}

type Props = {
  company: StorefrontCompany
  products: PublicSiteProduct[]
  children: ReactNode
}

function digits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappUrl(company: StorefrontCompany) {
  const phone = digits(company.whatsapp)
  if (phone.length < 10) return ''
  const normalized = phone.startsWith('55') ? phone : `55${phone}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(`Olá! Estou no site da ${company.nome || 'empresa'} e preciso de ajuda.`)}`
}

function time(value?: string | null) {
  return String(value || '').slice(0, 5)
}

function minutes(value?: string | null) {
  const [hour, minute] = time(value).split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function openingStatus(hours: BusinessHour[]) {
  if (!hours.length) return null
  const now = new Date()
  const weekday = now.getDay()
  const minuteNow = now.getHours() * 60 + now.getMinutes()
  const today = hours.find((item) => Number(item.weekday) === weekday)
  const open = minutes(today?.open_time)
  const close = minutes(today?.close_time)
  const breakStart = minutes(today?.break_start)
  const breakEnd = minutes(today?.break_end)
  const insideBreak = breakStart !== null && breakEnd !== null && minuteNow >= breakStart && minuteNow < breakEnd

  if (today?.is_open !== false && open !== null && close !== null && minuteNow >= open && minuteNow < close && !insideBreak) {
    return { open: true, label: `Aberto agora · fecha às ${time(today?.close_time)}` }
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const target = (weekday + offset) % 7
    const item = hours.find((entry) => Number(entry.weekday) === target && entry.is_open !== false && entry.open_time)
    if (!item) continue
    const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    return {
      open: false,
      label: offset === 0 ? `Fechado · abre hoje às ${time(item.open_time)}` : `Fechado · abre ${names[target]} às ${time(item.open_time)}`,
    }
  }

  return { open: false, label: today?.closed_message || 'Horário sob consulta' }
}

function actionFor(type: string) {
  if (type === 'food' || type === 'store') return { label: 'Carrinho', icon: 'Sacola' }
  if (type === 'beauty' || type === 'barber') return { label: 'Agendar', icon: 'Agenda' }
  if (type === 'graphic' || type === 'custom_products') return { label: 'Orçamento', icon: 'Orçar' }
  if (type === 'technical_assistance') return { label: 'Atendimento', icon: 'Suporte' }
  return { label: 'Solicitar', icon: 'Pedir' }
}

function storeKey(company: StorefrontCompany) {
  return String(company.subdomain_slug || company.slug || company.id || 'storefront')
}

function readIds(key: string, max = 30) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.map((item) => String(item || '')).filter(Boolean))).slice(0, max)
  } catch {
    return []
  }
}

function getSessionId() {
  const key = 'orcaly-storefront-session-v2'
  try {
    const current = window.localStorage.getItem(key)
    if (current) return current
    const created = crypto.randomUUID()
    window.localStorage.setItem(key, created)
    return created
  } catch {
    return ''
  }
}

function productName(product: PublicSiteProduct) {
  return product.nome || 'Produto'
}

function productImage(product: PublicSiteProduct) {
  return Array.isArray(product.image_urls) && product.image_urls[0] ? product.image_urls[0] : product.imagem_url || ''
}

export default function StorefrontExperienceV2({ company, products, children }: Props) {
  const slug = String(company.subdomain_slug || company.slug || '')
  const key = storeKey(company)
  const favoriteKey = `orcaly-storefront-favorites:${key}`
  const recentKey = `orcaly-storefront-recent:${key}`
  const businessType = String(company.business_type || company.site_template || 'services').toLowerCase()
  const action = actionFor(businessType)
  const whatsapp = whatsappUrl(company)
  const hours = Array.isArray(company.business_hours) ? company.business_hours : []
  const status = useMemo(() => openingStatus(hours), [hours])
  const deliveryAvailable = Array.isArray(company.delivery_zones) && company.delivery_zones.some((zone) => zone.is_active !== false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setFavorites(readIds(favoriteKey))
    setRecent(readIds(recentKey, 12))
  }, [favoriteKey, recentKey])

  useEffect(() => {
    if (!slug) return
    const sessionId = getSessionId()
    void fetch(`/api/public-site/${encodeURIComponent(slug)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'page_view', sessionId }),
      keepalive: true,
    }).catch(() => undefined)
  }, [slug])

  useEffect(() => {
    const term = search.trim()
    if (!slug || term.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/public-site/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(term)}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-storefront-session': getSessionId() },
        })
        const payload = await response.json().catch(() => ({}))
        if (!controller.signal.aborted) setResults(response.ok && Array.isArray(payload.items) ? payload.items : [])
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setResults([])
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 260)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, slug])

  const favoriteProducts = useMemo(
    () => favorites.map((id) => products.find((product) => product.id === id)).filter((product): product is PublicSiteProduct => Boolean(product)),
    [favorites, products],
  )
  const recentProducts = useMemo(
    () => recent.map((id) => products.find((product) => product.id === id)).filter((product): product is PublicSiteProduct => Boolean(product)).slice(0, 6),
    [products, recent],
  )

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const exists = current.includes(id)
      const next = exists ? current.filter((item) => item !== id) : [id, ...current].slice(0, 30)
      try { window.localStorage.setItem(favoriteKey, JSON.stringify(next)) } catch {}
      if (!exists && slug) {
        void fetch(`/api/public-site/${encodeURIComponent(slug)}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'favorite_add', productId: id, sessionId: getSessionId() }),
          keepalive: true,
        }).catch(() => undefined)
      }
      return next
    })
  }

  function rememberProduct(id: string) {
    const next = [id, ...recent.filter((item) => item !== id)].slice(0, 12)
    setRecent(next)
    try { window.localStorage.setItem(recentKey, JSON.stringify(next)) } catch {}
  }

  function focusSearch() {
    setSearchOpen(true)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  const surface = company.site_background_color || '#f5f7fb'
  const primary = company.site_primary_color || '#0b3b78'

  return (
    <div className="min-h-screen pb-20 text-slate-900 lg:pb-0" style={{ background: surface }}>
      <div className="border-b border-slate-200/70 bg-white/95 text-[11px] font-semibold text-slate-600 backdrop-blur-xl">
        <div className="mx-auto flex min-h-9 max-w-[1440px] items-center gap-3 overflow-x-auto px-3 sm:px-5 lg:px-7">
          {status ? <span className={`whitespace-nowrap ${status.open ? 'text-emerald-700' : 'text-slate-500'}`}><span aria-hidden>{status.open ? '●' : '○'}</span> {status.label}</span> : null}
          {deliveryAvailable ? <span className="whitespace-nowrap">Entrega disponível</span> : null}
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="ml-auto whitespace-nowrap font-bold" style={{ color: primary }}>WhatsApp</a> : null}
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/94 shadow-[0_8px_24px_rgba(15,23,42,.04)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center gap-3 px-3 sm:px-5 lg:px-7">
          <Link href={`/site/${encodeURIComponent(slug)}`} className="flex min-w-0 items-center gap-3" aria-label={`Início de ${company.nome || 'empresa'}`}>
            {company.logo_url ? <img src={company.logo_url} alt={`Logo de ${company.nome || 'empresa'}`} className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black text-white" style={{ background: primary }}>{String(company.nome || 'E').slice(0, 1).toUpperCase()}</span>}
            <span className="min-w-0"><strong className="block truncate text-sm font-extrabold tracking-[-.02em]">{company.nome || 'Empresa'}</strong><small className="block truncate text-[10px] font-semibold text-slate-400">Loja oficial</small></span>
          </Link>

          <div className="relative ml-auto hidden w-full max-w-xl md:block">
            <label className="sr-only" htmlFor="storefront-search">Buscar produtos e serviços</label>
            <input id="storefront-search" ref={searchRef} value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true) }} placeholder="Buscar produtos, serviços ou categorias" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm font-medium outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100" />
            <button type="button" onClick={focusSearch} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg text-sm font-black text-white" style={{ background: primary }} aria-label="Buscar">⌕</button>
            {searchOpen && search.trim().length >= 2 ? <SearchPanel slug={slug} results={results} searching={searching} favorites={favorites} onFavorite={toggleFavorite} onOpen={rememberProduct} onClose={() => setSearchOpen(false)} /> : null}
          </div>

          <button type="button" onClick={focusSearch} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 md:hidden" aria-label="Buscar">⌕</button>
          <button type="button" onClick={() => setFavoritesOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200" aria-label="Favoritos"><span aria-hidden>♡</span>{favorites.length ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full px-1 py-0.5 text-center text-[9px] font-black text-white" style={{ background: primary }}>{Math.min(favorites.length, 99)}</span> : null}</button>
          <a href="#catalogo" className="hidden rounded-xl px-4 py-2.5 text-xs font-extrabold text-white sm:block" style={{ background: primary }}>{action.label}</a>
        </div>

        {searchOpen ? <div className="border-t border-slate-100 p-3 md:hidden"><div className="relative mx-auto max-w-xl"><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no catálogo" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:bg-white" />{search.trim().length >= 2 ? <SearchPanel slug={slug} results={results} searching={searching} favorites={favorites} onFavorite={toggleFavorite} onOpen={rememberProduct} onClose={() => setSearchOpen(false)} mobile /> : null}</div></div> : null}
      </header>

      {children}

      {recentProducts.length ? <section className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8"><div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Continue explorando</span><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Vistos recentemente</h2></div></div><div className="mt-4 flex gap-3 overflow-x-auto pb-1">{recentProducts.map((product) => <Link key={product.id} href={`/site/${encodeURIComponent(slug)}/produto/${product.id}`} onClick={() => rememberProduct(product.id)} className="w-48 shrink-0 rounded-xl border border-slate-100 p-2.5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="h-28 overflow-hidden rounded-lg bg-slate-100">{productImage(product) ? <img src={productImage(product)} alt={productName(product)} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs font-bold text-slate-400">Sem foto</div>}</div><strong className="mt-2 block truncate text-sm">{productName(product)}</strong><span className="mt-1 block truncate text-[10px] font-semibold text-slate-400">{product.categoria || 'Catálogo'}</span></Link>)}</div></div></section> : null}

      {company.site_footer_text ? <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs font-semibold text-slate-500">{company.site_footer_text}</footer> : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white/96 px-2 py-2 shadow-[0_-12px_30px_rgba(15,23,42,.08)] backdrop-blur-xl lg:hidden" aria-label="Navegação rápida">
        <Link href={`/site/${encodeURIComponent(slug)}`} className="rounded-xl px-2 py-2 text-center text-[10px] font-extrabold"><span className="block text-base" aria-hidden>⌂</span>Início</Link>
        <button type="button" onClick={focusSearch} className="rounded-xl px-2 py-2 text-center text-[10px] font-extrabold"><span className="block text-base" aria-hidden>⌕</span>Buscar</button>
        <a href="#catalogo" className="rounded-xl px-2 py-2 text-center text-[10px] font-extrabold" style={{ color: primary }}><span className="block text-base" aria-hidden>＋</span>{action.icon}</a>
        {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-xl px-2 py-2 text-center text-[10px] font-extrabold"><span className="block text-base" aria-hidden>◉</span>Contato</a> : <button type="button" onClick={() => setFavoritesOpen(true)} className="rounded-xl px-2 py-2 text-center text-[10px] font-extrabold"><span className="block text-base" aria-hidden>♡</span>Salvos</button>}
      </nav>

      {favoritesOpen ? <div className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Favoritos"><button className="absolute inset-0" aria-label="Fechar favoritos" onClick={() => setFavoritesOpen(false)} /><aside className="absolute inset-y-0 right-0 w-[min(92vw,420px)] overflow-y-auto bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><div><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Favoritos</span><h2 className="mt-1 text-xl font-extrabold">Itens salvos</h2></div><button type="button" onClick={() => setFavoritesOpen(false)} className="h-10 w-10 rounded-xl border border-slate-200" aria-label="Fechar">×</button></div><div className="mt-5 grid gap-2">{favoriteProducts.map((product) => <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">{productImage(product) ? <img src={productImage(product)} alt={productName(product)} className="h-full w-full object-cover" /> : null}</div><Link href={`/site/${encodeURIComponent(slug)}/produto/${product.id}`} onClick={() => { rememberProduct(product.id); setFavoritesOpen(false) }} className="min-w-0 flex-1"><strong className="block truncate text-sm">{productName(product)}</strong><span className="block truncate text-[10px] font-semibold text-slate-400">{product.categoria || 'Catálogo'}</span></Link><button type="button" onClick={() => toggleFavorite(product.id)} className="h-9 w-9 rounded-lg bg-red-50 text-red-600" aria-label={`Remover ${productName(product)} dos favoritos`}>♥</button></div>)}{!favoriteProducts.length ? <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">Você ainda não salvou nenhum item.</div> : null}</div></aside></div> : null}
    </div>
  )
}

function SearchPanel({ slug, results, searching, favorites, onFavorite, onOpen, onClose, mobile = false }: { slug: string; results: SearchResult[]; searching: boolean; favorites: string[]; onFavorite: (id: string) => void; onOpen: (id: string) => void; onClose: () => void; mobile?: boolean }) {
  return <div className={`${mobile ? 'relative mt-2' : 'absolute left-0 right-0 top-[calc(100%+8px)]'} z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}><div className="max-h-[55vh] overflow-y-auto p-2">{searching ? <div className="p-5 text-center text-sm font-semibold text-slate-400">Buscando no catálogo…</div> : null}{!searching && !results.length ? <div className="p-5 text-center text-sm font-semibold text-slate-400">Nenhum resultado encontrado.</div> : null}{results.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl p-2 hover:bg-slate-50"><Link href={`/site/${encodeURIComponent(slug)}/produto/${item.id}`} onClick={() => { onOpen(item.id); onClose() }} className="flex min-w-0 flex-1 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}</div><span className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><small className="block truncate text-[10px] font-semibold text-slate-400">{item.category} · {item.priceLabel}</small></span></Link><button type="button" onClick={() => onFavorite(item.id)} className={`h-9 w-9 rounded-lg ${favorites.includes(item.id) ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`} aria-label={favorites.includes(item.id) ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}>{favorites.includes(item.id) ? '♥' : '♡'}</button></div>)}</div></div>
}
