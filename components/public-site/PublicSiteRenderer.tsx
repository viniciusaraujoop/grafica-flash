'use client'

import { useMemo, useState } from 'react'
import { getSiteTemplateByBusinessType, normalizeSectionList, type SiteSectionId } from '@/lib/site-templates'
import PremiumCatalog from '@/components/public-site/PremiumCatalog'

export type PublicSiteCompany = {
  id?: string
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  whatsapp?: string | null
  business_type?: string | null
  site_template?: string | null
  site_theme?: string | null
  site_primary_color?: string | null
  site_accent_color?: string | null
  site_headline?: string | null
  site_subheadline?: string | null
  site_cta_label?: string | null
  site_cta_text?: string | null
  site_about_title?: string | null
  site_about_text?: string | null
  site_sections?: unknown
  site_benefits?: unknown
  site_faq?: unknown
  site_testimonials?: unknown
  site_gallery?: unknown
  site_features?: unknown
  site_payment_methods?: unknown
  site_delivery_options?: unknown
  delivery_zones?: unknown
  payment_methods?: unknown
  business_hours?: unknown
  marketplace_payment_online_enabled?: boolean | null
}

export type PublicSiteProduct = {
  id: string
  nome?: string | null
  descricao?: string | null
  descricao_curta?: string | null
  categoria?: string | null
  preco?: number | string | null
  preco_sob_consulta?: boolean | null
  ativo?: boolean | null
  available?: boolean | null
  imagem_url?: string | null
  image_urls?: string[] | null
  video_url?: string | null
  destaque?: boolean | null
  addons?: unknown
  variations?: unknown
  extras?: Record<string, unknown> | null
}

type TextItem = {
  title?: string
  titulo?: string
  text?: string
  texto?: string
}

type FaqItem = {
  question?: string
  pergunta?: string
  answer?: string
  resposta?: string
}

type RendererProps = {
  company: PublicSiteCompany
  products: PublicSiteProduct[]
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeTextItems(
  value: unknown,
  fallback: Array<{ title: string; text: string }>
): Array<{ title: string; text: string }> {
  const custom = asArray<TextItem>(value)
    .map((item) => ({
      title: item.title || item.titulo || '',
      text: item.text || item.texto || '',
    }))
    .filter((item) => item.title || item.text)

  return custom.length ? custom : fallback
}

function normalizeFaqItems(
  value: unknown,
  fallback: Array<{ question: string; answer: string }>
): Array<{ question: string; answer: string }> {
  const custom = asArray<FaqItem>(value)
    .map((item) => ({
      question: item.question || item.pergunta || '',
      answer: item.answer || item.resposta || '',
    }))
    .filter((item) => item.question || item.answer)

  return custom.length ? custom : fallback
}

function normalizeTestimonials(
  value: unknown
): Array<{ name: string; text: string }> {
  return asArray<{ name?: string; nome?: string; text?: string; texto?: string }>(value)
    .map((item) => ({
      name: item.name || item.nome || 'Cliente',
      text: item.text || item.texto || 'Atendimento excelente e organizado.',
    }))
    .filter((item) => item.name.trim().length > 0 || item.text.trim().length > 0)
}
function money(value?: number | string | null) {
  const numeric = Number(value || 0)

  if (!numeric) return 'Valor sob consulta'

  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(company: PublicSiteCompany, message: string) {
  const phone = phoneOnly(company.whatsapp)

  if (!phone || phone.length < 10) return '#contato'

  const normalized = phone.startsWith('55') ? phone : `55${phone}`

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

function primaryProductImage(product: PublicSiteProduct) {
  if (Array.isArray(product.image_urls) && product.image_urls[0]) return product.image_urls[0]
  return product.imagem_url || ''
}

function ProductMediaGallery({ product }: { product: PublicSiteProduct }) {
  const images = Array.isArray(product.image_urls)
    ? product.image_urls.filter(Boolean).slice(0, 4)
    : product.imagem_url
      ? [product.imagem_url]
      : []

  if (product.video_url) {
    return (
      <video
        src={product.video_url}
        controls
        muted
        className="h-56 w-full rounded-[1.5rem] bg-slate-100 object-cover"
      />
    )
  }

  if (images[0]) {
    return <img src={images[0]} alt={product.nome || 'Produto'} className="h-56 w-full rounded-[1.5rem] object-cover" />
  }

  return (
    <div className="grid h-56 place-items-center rounded-[1.5rem] bg-slate-100 text-sm font-black text-slate-400">
      Sem foto
    </div>
  )
}

function ProductCard({
  product,
  company,
  catalogAction,
  businessType,
}: {
  product: PublicSiteProduct
  company: PublicSiteCompany
  catalogAction: string
  businessType: string
}) {
  const available = product.available !== false && product.ativo !== false
  const variations = asArray<{ nome?: string; name?: string }>(product.variations)
  const addons = asArray<{ nome?: string; name?: string; preco?: number | string }>(product.addons)
  const message = `${catalogAction}: ${product.nome || 'Produto'} - ${company.nome || 'Empresa Orçaly'}`

  return (
    <article id={`produto-${product.id}`} className="group overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/6 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/12">
      <ProductMediaGallery product={product} />

      <div className="p-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">
            {product.categoria || 'Destaque'}
          </span>
          {!available ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">Indisponível</span>
          ) : null}
          {product.destaque ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Destaque</span>
          ) : null}
        </div>

        <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{product.nome || 'Produto'}</h3>
        <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-slate-500">
          {product.descricao_curta || product.descricao || 'Confira os detalhes pelo WhatsApp.'}
        </p>

        {businessType === 'food' && (addons.length || variations.length) ? (
          <div className="mt-4 space-y-2">
            {variations.length ? (
              <p className="text-xs font-black text-slate-500">Variações: {variations.slice(0, 3).map((item) => item.name || item.name).filter(Boolean).join(', ')}</p>
            ) : null}
            {addons.length ? (
              <p className="text-xs font-black text-slate-500">Adicionais: {addons.slice(0, 3).map((item) => item.name || item.name).filter(Boolean).join(', ')}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-2xl font-black text-[#05245c]">
            {product.preco_sob_consulta ? 'Sob consulta' : money(product.preco)}
          </p>

          <a
            href={whatsappLink(company, message)}
            target="_blank"
            rel="noreferrer"
            className={`rounded-2xl px-4 py-3 text-sm font-black text-white ${available ? 'bg-[#05245c]' : 'pointer-events-none bg-slate-300'}`}
          >
            {businessType === 'food' ? 'Adicionar ao pedido' : catalogAction}
          </a>
        </div>
      </div>
    </article>
  )
}

function SectionShell({ id, children }: { id?: string; children: React.ReactNode }) {
  return <section id={id} className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">{children}</section>
}

function TitleBlock({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.055em] text-[#071b3a] sm:text-6xl">{title}</h2>
      {text ? <p className="mx-auto mt-4 max-w-3xl text-base font-bold leading-8 text-slate-500">{text}</p> : null}
    </div>
  )
}

export default function PublicSiteRenderer({ company, products }: RendererProps) {
  const template = getSiteTemplateByBusinessType(company.business_type || company.site_template)
  const [showMobile, setShowMobile] = useState(false)

  const primary = company.site_primary_color || template.suggestedColors.primary
  const accent = company.site_accent_color || template.suggestedColors.accent
  const businessType = template.businessType

  const headline = company.site_headline || template.headline
  const subheadline = company.site_subheadline || template.subheadline
  const cta = company.site_cta_label || company.site_cta_text || template.ctaLabel
  const aboutTitle = company.site_about_title || template.aboutTitle
  const aboutText = company.site_about_text || template.aboutText
  const benefits = normalizeTextItems(company.site_benefits, template.benefits)
  const faq = normalizeFaqItems(company.site_faq, template.faq)
  const gallery = asArray<{ url?: string; image_url?: string; title?: string }>(company.site_gallery)
  const testimonials = normalizeTestimonials(company.site_testimonials)
  const paymentMethods = asArray<string>(company.site_payment_methods).length ? asArray<string>(company.site_payment_methods) : template.paymentMethods
  const deliveryOptions = asArray<string>(company.site_delivery_options).length ? asArray<string>(company.site_delivery_options) : template.deliveryOptions
  const sections = normalizeSectionList(company.site_sections, template.sections)
    .filter((section) => section.enabled)

  const activeProducts = products.filter((product) => product.available !== false && product.ativo !== false)
  const categories = Array.from(new Set(activeProducts.map((product) => product.categoria).filter(Boolean) as string[]))
  const whatsapp = whatsappLink(company, `${cta} - ${company.nome || 'Empresa Orçaly'}`)

  const renderSection = (id: SiteSectionId) => {
    if (id === 'hero') {
      return (
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at top left, ${accent}, transparent 32%), radial-gradient(circle at bottom right, ${primary}, transparent 34%)` }} />
          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_460px] lg:items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: primary }}>
                {template.label}
              </div>
              <h1 className="mx-auto mt-5 max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.07em] text-[#071b3a] sm:text-7xl lg:mx-0">
                {headline}
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-lg font-bold leading-8 text-slate-500 lg:mx-0">
                {subheadline}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:mx-auto sm:max-w-lg sm:flex-row lg:mx-0">
                <a href="#catalogo" className="rounded-2xl px-6 py-4 text-center font-black text-white shadow-xl" style={{ background: primary }}>
                  {cta}
                </a>
                <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-6 py-4 text-center font-black" style={{ color: primary }}>
                  Chamar no WhatsApp
                </a>
              </div>
            </div>

            <div className="rounded-[2.3rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/10">
              <div className="rounded-[1.8rem] p-5 text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Página oficial</p>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">{company.nome || 'Empresa'}</h2>
                  </div>
                  {company.logo_url ? (
                    <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white">
                      <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[78%] max-w-[78%] object-contain" />
                    </span>
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-2xl font-black" style={{ color: primary }}>
                      {(company.nome || 'O').slice(0, 1)}
                    </span>
                  )}
                </div>

                <div className="mt-8 grid gap-3">
                  {template.previewItems.map((item) => (
                    <div key={item} className="rounded-2xl bg-white/12 p-4 font-black">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    }

    if (id === 'benefits') {
      return (
        <SectionShell>
          <TitleBlock eyebrow="Por que escolher" title={aboutTitle} text={aboutText} />
          <div className="mx-auto mt-9 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
            {benefits.slice(0, 4).map((benefit, index) => (
              <article key={`${benefit.title}-${index}`} className="rounded-[1.8rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl text-sm font-black text-white" style={{ background: primary }}>{index + 1}</div>
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em]">{benefit.title}</h3>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{benefit.text}</p>
              </article>
            ))}
          </div>
        </SectionShell>
      )
    }

    if (id === 'catalog') {
      return (
        <PremiumCatalog
          company={company}
          products={products}
          businessType={businessType}
          primaryColor={primary}
          accentColor={accent}
          fallbackTitle={template.catalogLabel}
          fallbackText={businessType === 'food' ? 'Escolha seus itens, configure adicionais, selecione entrega ou retirada, forma de pagamento e finalize o pedido pelo marketplace.' : 'Veja opções, detalhes e chame no WhatsApp para continuar.'}
          ctaLabel={cta}
        />
      )
    }

    if (id === 'gallery' && gallery.length) {
      return (
        <SectionShell>
          <TitleBlock eyebrow="Galeria" title="Veja detalhes do nosso trabalho" />
          <div className="mx-auto mt-9 grid max-w-7xl gap-4 md:grid-cols-3">
            {gallery.slice(0, 6).map((item, index) => {
              const url = item.url || item.image_url
              return url ? (
                <img key={`${url}-${index}`} src={url} alt={item.title || 'Galeria'} className="h-72 rounded-[1.8rem] object-cover shadow-xl shadow-blue-950/5" />
              ) : null
            })}
          </div>
        </SectionShell>
      )
    }

    if (id === 'testimonials' && testimonials.length) {
      return (
        <SectionShell>
          <TitleBlock eyebrow="Depoimentos" title="O que clientes dizem" />
          <div className="mx-auto mt-9 grid max-w-6xl gap-4 md:grid-cols-3">
            {testimonials.slice(0, 3).map((item, index) => (
              <article key={`${item.name}-${index}`} className="rounded-[1.8rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-bold leading-7 text-slate-500">“{item.text}”</p>
                <p className="mt-4 font-black text-[#071b3a]">{item.name}</p>
              </article>
            ))}
          </div>
        </SectionShell>
      )
    }

    if (id === 'process' || id === 'uploadInfo' || id === 'delivery' || id === 'warranty' || id === 'highlights' || id === 'professionals') {
      const titleMap: Record<string, string> = {
        process: 'Como funciona',
        uploadInfo: 'Arquivos, detalhes e referências',
        delivery: 'Entrega, retirada e pagamento',
        warranty: 'Análise, garantia e segurança',
        highlights: 'Destaques do atendimento',
        professionals: 'Atendimento profissional',
      }

      const items = id === 'delivery'
        ? [...deliveryOptions, ...paymentMethods]
        : template.features.map((feature) => feature.title)

      return (
        <SectionShell>
          <TitleBlock eyebrow="Informações úteis" title={titleMap[id] || 'Como funciona'} />
          <div className="mx-auto mt-9 grid max-w-6xl gap-4 md:grid-cols-3">
            {items.slice(0, 6).map((item, index) => (
              <article key={`${item}-${index}`} className="rounded-[1.8rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-black text-white" style={{ background: accent }}>{index + 1}</span>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em]">{item}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Informação preparada para este tipo de negócio.</p>
              </article>
            ))}
          </div>
        </SectionShell>
      )
    }

    if (id === 'faq') {
      return (
        <SectionShell>
          <TitleBlock eyebrow="Perguntas frequentes" title="Dúvidas comuns" />
          <div className="mx-auto mt-9 grid max-w-4xl gap-3">
            {faq.map((item, index) => (
              <details key={`${item.question}-${index}`} className="rounded-[1.5rem] border border-blue-100 bg-white p-5 shadow-lg shadow-blue-950/5">
                <summary className="cursor-pointer font-black text-[#071b3a]">{item.question}</summary>
                <p className="mt-3 text-sm font-bold leading-7 text-slate-500">{item.answer}</p>
              </details>
            ))}
          </div>
        </SectionShell>
      )
    }

    if (id === 'contact') {
      return (
        <SectionShell id="contato">
          <div className="mx-auto max-w-5xl rounded-[2.3rem] p-8 text-center text-white shadow-2xl shadow-blue-950/15 sm:p-12" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">Contato</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-6xl">Pronto para continuar?</h2>
            <p className="mx-auto mt-4 max-w-2xl font-bold leading-8 text-white/75">
              Chame pelo WhatsApp e continue o atendimento com a equipe.
            </p>
            <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black" style={{ color: primary }}>
              Chamar no WhatsApp
            </a>
          </div>
        </SectionShell>
      )
    }

    return null
  }

  return (
    <main className="min-h-screen bg-[#f7faff] text-[#071b3a]" style={{ colorScheme: 'light' }}>
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#" className="flex min-w-0 items-center gap-3">
            {company.logo_url ? (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white ring-1 ring-blue-100">
                <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[78%] max-w-[78%] object-contain" />
              </span>
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-black text-white" style={{ background: primary }}>
                {(company.nome || 'O').slice(0, 1)}
              </span>
            )}
            <span className="truncate font-black">{company.nome || 'Empresa'}</span>
          </a>

          <nav className="hidden items-center gap-5 text-sm font-black text-slate-500 md:flex">
            <a href="#catalogo">Catálogo</a>
            <a href="#contato">Contato</a>
          </nav>

          <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: primary }}>
            WhatsApp
          </a>
        </div>
      </header>

      {sections.map((section) => (
        <div key={section.id}>{renderSection(section.id)}</div>
      ))}
    </main>
  )
}
