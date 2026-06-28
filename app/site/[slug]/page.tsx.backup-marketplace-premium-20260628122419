'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Product = {
  id: string
  nome: string
  preco: number
  descricao?: string
  categoria?: string
  imagem_url?: string | null
  image_urls?: string[]
  video_url?: string | null
  destaque?: boolean
}

function moeda(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function cleanPhone(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(phone: string | null | undefined, message: string) {
  const raw = cleanPhone(phone)
  const final = raw.startsWith('55') ? raw : `55${raw}`
  return raw ? `https://wa.me/${final}?text=${encodeURIComponent(message)}` : '#'
}

function getMedia(product: Product) {
  const images = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean).slice(0, 4) : []
  const fallback = product.imagem_url && !images.includes(product.imagem_url) ? [product.imagem_url] : []
  return { images: [...fallback, ...images].slice(0, 4), video: product.video_url || null }
}

function Section({ children, id, className = '' }: { children: React.ReactNode; id?: string; className?: string }) {
  return <section id={id} className={`mx-auto max-w-7xl px-4 py-12 sm:py-16 ${className}`}>{children}</section>
}

function LogoMark({ company, theme, large = false }: { company: any; theme: any; large?: boolean }) {
  const size = large ? 'h-16 w-16 rounded-[1.35rem]' : 'h-12 w-12 rounded-2xl'

  if (company.logo_url) {
    return (
      <span className={`${size} grid place-items-center bg-white shadow-lg shadow-black/10 ring-1 ring-black/5`}>
        <img src={company.logo_url} alt={company.nome} className="max-h-[80%] max-w-[80%] object-contain" />
      </span>
    )
  }

  return (
    <span className={`${size} grid place-items-center text-xl font-black text-white shadow-lg shadow-black/10`} style={{ background: theme.primary }}>
      {company.nome?.slice(0, 1) || 'O'}
    </span>
  )
}

function AutoArt({ company, template, theme }: { company: any; template: any; theme: any }) {
  const style = company.site_art_style || template?.arte || 'profissional'

  return (
    <div
      className="relative min-h-[420px] overflow-hidden rounded-[2.5rem] border border-white/50 p-6 text-white shadow-2xl shadow-blue-950/20"
      style={{ background: `radial-gradient(circle at 16% 20%, ${theme.accent}cc, transparent 32%), radial-gradient(circle at 80% 10%, #ffffff2b, transparent 24%), linear-gradient(135deg, ${theme.primary}, #020617 72%)` }}
    >
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-sm" />
      <div className="absolute -bottom-20 left-8 h-52 w-52 rounded-full" style={{ background: `${theme.accent}55`, filter: 'blur(45px)' }} />
      <div className="absolute bottom-6 right-6 grid grid-cols-3 gap-3 opacity-80">
        {Array.from({ length: 9 }).map((_, index) => <span key={index} className="h-16 w-16 rounded-3xl bg-white/15 backdrop-blur" />)}
      </div>

      <div className="relative flex h-full min-h-[360px] flex-col justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Site premium por segmento</p>
          <h3 className="mt-5 max-w-sm text-5xl font-black tracking-[-0.06em]">{style}</h3>
          <p className="mt-4 max-w-sm text-sm font-bold leading-7 text-white/75">
            Layout pronto para vender, com catálogo, prova social, atendimento e visual profissional adaptado ao ramo.
          </p>
        </div>

        <div className="relative grid gap-3 sm:grid-cols-3">
          {['Catálogo', 'Orçamento', 'Atendimento'].map((item) => (
            <span key={item} className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black backdrop-blur">{item}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductMedia({ product, theme }: { product: Product; theme: any }) {
  const { images, video } = getMedia(product)

  if (video) {
    return (
      <div className="relative h-56 overflow-hidden bg-black">
        <video src={video} controls muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white backdrop-blur">Vídeo</span>
      </div>
    )
  }

  if (images.length) {
    return (
      <div className="relative h-56 overflow-hidden">
        <img src={images[0]} alt={product.nome} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
        {images.length > 1 && (
          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black shadow-sm">+{images.length - 1} fotos</span>
        )}
      </div>
    )
  }

  return <div className="h-56" style={{ background: `radial-gradient(circle at 20% 20%, ${theme.accent}99, transparent 35%), linear-gradient(135deg, ${theme.primary}, #020617)` }} />
}

export default function SitePublicoPremiumPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug

  const [company, setCompany] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const response = await fetch(`/api/public-site/${slug}`)
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Site não encontrado.')
      setLoading(false)
      return
    }

    setCompany(payload.company)
    setTemplate(payload.template)
    setProducts(payload.products || [])
    setLoading(false)
  }

  useEffect(() => {
    if (slug) load()
  }, [slug])

  const theme = useMemo(() => {
    const primary = company?.site_primary_color || template?.paleta?.primary || '#05245c'
    const accent = company?.site_accent_color || template?.paleta?.accent || '#22c55e'
    const background = company?.site_background_color || template?.paleta?.background || '#f5f8ff'
    const text = company?.site_text_color || template?.paleta?.text || '#071b3a'
    const card = company?.site_card_color || template?.paleta?.card || '#ffffff'
    return { primary, accent, background, text, card }
  }, [company, template])

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando site...</div></main>
  }

  if (error || !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black text-[#071b3a]">Site indisponível</h1>
          <p className="mt-3 font-bold text-red-600">{error}</p>
        </div>
      </main>
    )
  }

  const message = company.site_whatsapp_message || `Olá! Vim pelo site da ${company.nome} e quero atendimento.`
  const whats = whatsappLink(company.whatsapp, message)
  const features = Array.isArray(company.site_features) ? company.site_features : []
  const benefits = Array.isArray(company.site_benefits) ? company.site_benefits : []
  const faq = Array.isArray(company.site_faq) ? company.site_faq : []
  const testimonials = Array.isArray(company.site_testimonials) ? company.site_testimonials : []
  const gallery = Array.isArray(company.site_gallery) ? company.site_gallery : []
  const payments = Array.isArray(company.site_payment_methods) ? company.site_payment_methods : []
  const delivery = Array.isArray(company.site_delivery_options) ? company.site_delivery_options : []
  const featuredProducts = products.filter((product) => product.destaque).slice(0, 3)
  const proofItems = [
    { label: 'Atendimento', value: company.atendimento_horario || 'Online' },
    { label: 'Região', value: [company.cidade, company.estado].filter(Boolean).join(' / ') || template?.segmento || 'Local' },
    { label: 'Catálogo', value: `${products.length} opções` },
  ]

  return (
    <main style={{ background: theme.background, color: theme.text }} className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <a href="#" className="flex items-center gap-3">
            <LogoMark company={company} theme={theme} />
            <div>
              <p className="font-black tracking-[-0.02em]">{company.nome}</p>
              <p className="text-xs font-bold opacity-60">{company.cidade || company.segmento || template?.segmento}</p>
            </div>
          </a>

          <nav className="hidden items-center gap-5 text-sm font-black md:flex">
            <a href="#servicos">Serviços</a>
            {company.site_show_store !== false && <a href="#catalogo">Catálogo</a>}
            {company.site_show_about !== false && <a href="#sobre">Sobre</a>}
            <a href="#contato">Contato</a>
          </nav>

          <a href={whats} className="rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/10" style={{ background: theme.primary }}>
            {company.site_cta_text || 'Pedir orçamento'}
          </a>
        </div>
      </header>

      <Section className="relative">
        <div className="absolute left-1/2 top-0 -z-0 h-80 w-80 -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: theme.accent }} />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-black/5 bg-white px-3 py-2 shadow-xl shadow-black/5">
              <LogoMark company={company} theme={theme} />
              <span className="pr-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
                {company.site_badge_text || template?.conteudo?.badge || company.segmento || 'Atendimento online'}
              </span>
            </div>

            <h1 className="mt-7 max-w-5xl text-5xl font-black tracking-[-0.075em] sm:text-6xl lg:text-7xl">
              {company.site_headline || template?.conteudo?.headline || company.nome}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-bold leading-8 opacity-70">
              {company.site_subheadline || template?.conteudo?.subheadline || 'Conheça nossos produtos e solicite atendimento.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={whats} className="rounded-2xl px-6 py-4 font-black text-white shadow-xl shadow-black/10" style={{ background: theme.primary }}>
                {company.site_cta_text || 'Pedir orçamento'}
              </a>
              <a href="#catalogo" className="rounded-2xl border border-black/10 bg-white px-6 py-4 font-black shadow-sm" style={{ color: theme.primary }}>
                {company.site_secondary_cta_text || 'Ver catálogo'}
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofItems.map((item) => (
                <div key={item.label} className="rounded-3xl border border-black/5 bg-white p-4 shadow-xl shadow-black/5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] opacity-50">{item.label}</p>
                  <p className="mt-2 text-sm font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {company.site_banner_url ? (
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2.7rem] opacity-25 blur-2xl" style={{ background: theme.accent }} />
              <img src={company.site_banner_url} alt={company.nome} className="relative min-h-[420px] w-full rounded-[2.5rem] object-cover shadow-2xl shadow-black/15" />
            </div>
          ) : (
            <AutoArt company={company} template={template} theme={theme} />
          )}
        </div>
      </Section>

      {company.site_promo_active && (
        <Section>
          <div className="relative overflow-hidden rounded-[2.25rem] p-7 text-white shadow-xl shadow-black/10 sm:p-9" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15" />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-white/70">Oferta em destaque</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{company.site_promo_title || 'Promoção especial'}</h2>
            <p className="mt-3 max-w-3xl font-bold leading-7 text-white/80">{company.site_promo_text}</p>
            <a href={whats} className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 font-black" style={{ color: theme.primary }}>
              {company.site_promo_button_text || 'Aproveitar oferta'}
            </a>
          </div>
        </Section>
      )}

      {company.site_show_benefits !== false && benefits.length > 0 && (
        <Section>
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map((item: any, index: number) => (
              <div key={index} className="group rounded-[1.9rem] bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-black/5 transition hover:-translate-y-1">
                <span className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-black text-white" style={{ background: index === 1 ? theme.accent : theme.primary }}>{index + 1}</span>
                <h3 className="mt-5 text-xl font-black">{item.titulo}</h3>
                <p className="mt-2 font-bold leading-7 opacity-65">{item.texto}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {featuredProducts.length > 0 && (
        <Section>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Destaques</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Mais procurados</h2>
            </div>
            <a href="#catalogo" className="rounded-2xl bg-white px-5 py-3 font-black shadow-sm" style={{ color: theme.primary }}>Ver tudo</a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {featuredProducts.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-black/5 ring-1 ring-black/5">
                <ProductMedia product={product} theme={theme} />
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">{product.categoria || 'Geral'}</p>
                  <h3 className="mt-2 text-xl font-black">{product.nome}</h3>
                  <p className="mt-3 text-2xl font-black" style={{ color: theme.primary }}>{moeda(product.preco || 0)}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      {company.site_show_gallery !== false && gallery.length > 0 && (
        <Section id="servicos">
          <div className="mb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Serviços</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{company.site_services_title || 'O que fazemos'}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {gallery.map((item: any, index: number) => (
              <article key={index} className="overflow-hidden rounded-[1.9rem] bg-white shadow-xl shadow-black/5 ring-1 ring-black/5">
                <div className="h-44" style={{ background: `radial-gradient(circle at 20% 20%, ${theme.accent}aa, transparent 35%), linear-gradient(135deg, ${theme.primary}, #020617)` }} />
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">{item.tipo || 'serviço'}</p>
                  <h3 className="mt-2 text-xl font-black">{item.titulo}</h3>
                  <p className="mt-2 font-bold leading-7 opacity-65">{item.texto}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      {company.site_show_store !== false && products.length > 0 && (
        <Section id="catalogo">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Marketplace</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Produtos e serviços</h2>
              <p className="mt-2 max-w-2xl font-bold leading-7 opacity-60">Fotos, vídeos curtos e detalhes para o cliente entender antes de chamar.</p>
            </div>
            <a href={whats} className="rounded-2xl px-5 py-3 font-black text-white" style={{ background: theme.primary }}>Comprar pelo WhatsApp</a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-black/5 ring-1 ring-black/5 transition hover:-translate-y-1">
                <ProductMedia product={product} theme={theme} />
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">{product.categoria || 'Geral'}</p>
                  <h3 className="mt-2 text-xl font-black">{product.nome}</h3>
                  {product.descricao && <p className="mt-2 line-clamp-3 font-bold leading-7 opacity-65">{product.descricao}</p>}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-2xl font-black" style={{ color: theme.primary }}>{moeda(product.preco || 0)}</p>
                    <a href={whatsappLink(company.whatsapp, `Olá! Vim pelo site e quero saber sobre: ${product.nome}`)} className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: theme.primary }}>Pedir</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      {company.site_show_about !== false && (
        <Section id="sobre">
          <div className="grid gap-8 rounded-[2.25rem] bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-black/5 lg:grid-cols-[0.85fr_1.15fr] sm:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Sobre</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{company.site_about_title || 'Sobre a empresa'}</h2>
            </div>
            <div>
              <p className="text-lg font-bold leading-9 opacity-70">{company.site_about_text || 'Empresa com atendimento profissional, produtos organizados e orçamento facilitado pelo Orçaly.'}</p>
              {features.length > 0 && (
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {features.map((item: any, index: number) => (
                    <div key={index} className="rounded-[1.6rem] p-5" style={{ background: theme.background }}>
                      <h3 className="text-lg font-black">{item.titulo}</h3>
                      <p className="mt-2 font-bold leading-7 opacity-65">{item.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {company.site_show_testimonials !== false && testimonials.length > 0 && (
        <Section>
          <div className="mb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Depoimentos</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Quem compra, entende</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map((item: any, index: number) => (
              <blockquote key={index} className="rounded-[1.8rem] bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-black/5">
                <p className="text-lg font-bold leading-8 opacity-75">“{item.texto}”</p>
                <footer className="mt-4 font-black" style={{ color: theme.primary }}>{item.nome}</footer>
              </blockquote>
            ))}
          </div>
        </Section>
      )}

      {company.site_show_faq !== false && faq.length > 0 && (
        <Section>
          <div className="mb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Dúvidas</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">Perguntas frequentes</h2>
          </div>
          <div className="grid gap-3">
            {faq.map((item: any, index: number) => (
              <details key={index} className="rounded-[1.4rem] bg-white p-5 shadow-xl shadow-black/5 ring-1 ring-black/5">
                <summary className="cursor-pointer font-black">{item.pergunta}</summary>
                <p className="mt-3 font-bold leading-7 opacity-70">{item.resposta}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      <Section id="contato">
        <div className="relative overflow-hidden rounded-[2.5rem] p-7 text-white shadow-2xl shadow-black/20 sm:p-10" style={{ background: `radial-gradient(circle at 80% 10%, ${theme.accent}99, transparent 30%), linear-gradient(135deg, ${theme.primary}, #020617)` }}>
          <div className="relative grid gap-8 lg:grid-cols-[1fr_340px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Contato</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{company.site_contact_title || 'Fale conosco'}</h2>
              <p className="mt-3 max-w-2xl font-bold leading-8 text-white/70">
                {company.marketplace_endereco || company.atendimento_horario || company.atendimento_observacao || 'Chame no WhatsApp para tirar dúvidas, pedir orçamento ou combinar detalhes.'}
              </p>
              {(payments.length > 0 || delivery.length > 0) && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {[...payments, ...delivery].slice(0, 10).map((item: string) => <span key={item} className="rounded-full bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">{item}</span>)}
                </div>
              )}
            </div>
            <a href={whats} className="inline-flex justify-center rounded-2xl bg-white px-6 py-4 text-center font-black shadow-xl" style={{ color: theme.primary }}>
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </Section>

      <footer className="border-t border-black/5 bg-white/80 px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm font-bold opacity-65 sm:flex-row sm:items-center sm:justify-between">
          <span>{company.nome} · Site criado com Orçaly</span>
          <span>{[company.cidade, company.estado].filter(Boolean).join(' / ')}</span>
        </div>
      </footer>
    </main>
  )
}
