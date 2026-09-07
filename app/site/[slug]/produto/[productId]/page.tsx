/* eslint-disable @next/next/no-img-element */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StorefrontProductActions from '@/components/public-site/StorefrontProductActions'
import { loadPublicStorefrontProduct, productImages, productPrice } from '@/lib/storefront/public-product'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string; productId: string }> }

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function phone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 10) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function money(value: number | null) {
  return value === null ? 'Sob consulta' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function actionLabel(type: unknown) {
  const value = String(type || '').toLowerCase()
  if (value === 'food') return 'Adicionar ao pedido'
  if (value === 'store') return 'Comprar'
  if (value === 'beauty' || value === 'barber') return 'Agendar'
  if (value === 'graphic' || value === 'custom_products' || value === 'services') return 'Solicitar orçamento'
  if (value === 'technical_assistance') return 'Solicitar atendimento'
  return 'Ver opções'
}

function canonicalUrl(slug: string, productId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')
  return `${appUrl}/site/${encodeURIComponent(slug)}/produto/${encodeURIComponent(productId)}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productId } = await params
  try {
    const payload = await loadPublicStorefrontProduct(slug, productId)
    if (!payload) return { title: 'Produto não encontrado' }
    const { company, product } = payload
    const title = `${text(product.nome, 'Produto')} | ${text(company.nome, 'Loja')}`
    const description = text(product.descricao_curta) || text(product.descricao) || `Confira ${text(product.nome, 'este item')} no site de ${text(company.nome, 'esta empresa')}.`
    const image = productImages(product)[0]
    const url = canonicalUrl(slug, productId)
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, type: 'website', images: image ? [{ url: image, alt: text(product.nome, 'Produto') }] : undefined },
      twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
    }
  } catch {
    return { title: 'Produto' }
  }
}

export default async function StorefrontProductPage({ params }: Props) {
  const { slug, productId } = await params
  const payload = await loadPublicStorefrontProduct(slug, productId).catch(() => null)
  if (!payload) notFound()

  const { company, product } = payload
  const images = productImages(product)
  const price = productPrice(product)
  const primary = company.site_primary_color || '#0b3b78'
  const available = product.available !== false && product.ativo !== false && (product.estoque == null || product.estoque > 0)
  const action = actionLabel(company.business_type)
  const companyPhone = phone(company.whatsapp)
  const whatsapp = companyPhone ? `https://wa.me/${companyPhone}?text=${encodeURIComponent(`Olá! Estou vendo ${text(product.nome, 'um produto')} no site da ${text(company.nome, 'empresa')} e gostaria de saber mais.`)}` : ''
  const canonical = canonicalUrl(slug, productId)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: text(product.nome, 'Produto'),
    description: text(product.descricao) || text(product.descricao_curta) || undefined,
    image: images.length ? images : undefined,
    category: product.categoria || undefined,
    brand: { '@type': 'Brand', name: text(company.nome, 'Empresa') },
    url: canonical,
  }
  if (price !== null) {
    schema.offers = {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: price.toFixed(2),
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonical,
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] px-3 py-4 text-[#14243b] sm:px-5 sm:py-7" style={{ '--product-primary': primary } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
          <Link href={`/site/${encodeURIComponent(slug)}`} className="flex min-w-0 items-center gap-3">
            {company.logo_url ? <img src={company.logo_url} alt={`Logo de ${company.nome || 'empresa'}`} className="h-10 w-10 rounded-xl object-contain p-1 ring-1 ring-slate-200" /> : <span className="grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-white" style={{ background: primary }}>{text(company.nome, 'E').slice(0, 1)}</span>}
            <span className="min-w-0"><strong className="block truncate text-sm">{company.nome || 'Empresa'}</strong><small className="block text-[10px] font-semibold text-slate-400">Voltar para a vitrine</small></span>
          </Link>
          <Link href={`/site/${encodeURIComponent(slug)}#catalogo`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold">Catálogo</Link>
        </header>

        <section className="grid gap-4 rounded-[1.8rem] border border-slate-200 bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,.06)] sm:p-5 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="overflow-hidden rounded-[1.4rem] bg-slate-100">
              {product.video_url ? <video src={product.video_url} controls muted className="h-[380px] w-full object-cover sm:h-[520px]" /> : images[0] ? <img src={images[0]} alt={text(product.nome, 'Produto')} className="h-[380px] w-full object-cover sm:h-[520px]" /> : <div className="grid h-[380px] place-items-center text-sm font-bold text-slate-400 sm:h-[520px]">Sem imagem</div>}
            </div>
            {images.length > 1 ? <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">{images.slice(1, 7).map((image) => <img key={image} src={image} alt="Imagem adicional" className="h-20 w-full rounded-xl object-cover ring-1 ring-slate-200" loading="lazy" />)}</div> : null}
          </div>

          <div className="flex flex-col p-2 sm:p-4">
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">{product.categoria || 'Catálogo'}</span>{product.destaque ? <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-extrabold text-amber-700">Destaque</span> : null}<span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{available ? 'Disponível' : 'Indisponível'}</span></div>
            <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">{product.nome || 'Produto'}</h1>
            <p className="mt-3 text-3xl font-black" style={{ color: primary }}>{money(price)}</p>
            {product.promocao_ativa && product.preco_promocional && Number(product.preco || 0) > Number(product.preco_promocional || 0) ? <p className="mt-1 text-sm font-semibold text-slate-400 line-through">{money(Number(product.preco || 0))}</p> : null}
            <p className="mt-5 whitespace-pre-line text-sm font-medium leading-7 text-slate-600">{product.descricao || product.descricao_curta || 'Entre em contato com a empresa para conferir detalhes, disponibilidade e condições.'}</p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-400">Disponibilidade</span><strong className="mt-1 block text-sm">{available ? 'Disponível para atendimento' : 'Indisponível no momento'}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-400">Empresa</span><strong className="mt-1 block truncate text-sm">{company.nome || 'Empresa'}</strong></div></div>

            <div className="mt-auto pt-6"><StorefrontProductActions slug={slug} productId={product.id} productName={product.nome || 'Produto'} whatsapp={whatsapp} actionLabel={action} /></div>
          </div>
        </section>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-medium leading-6 text-slate-500">Preço, disponibilidade, prazo e opções exibidos nesta página vêm dos dados cadastrados pela empresa. A configuração final de variações, adicionais, entrega e pagamento continua no fluxo de catálogo/checkout existente.</div>
      </div>
    </main>
  )
}
