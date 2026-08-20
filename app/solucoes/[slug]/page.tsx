import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  findMarketingSolution,
  marketingPlans,
  marketingPlanSignupHref,
  marketingSolutions,
} from '@/lib/marketing/main-site'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return marketingSolutions.map((solution) => ({ slug: solution.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const solution = findMarketingSolution(slug)
  if (!solution) return {}

  const url = `${appUrl}/solucoes/${solution.slug}`
  return {
    title: `Orçaly para ${solution.label}`,
    description: `${solution.headline} ${solution.description}`,
    alternates: { canonical: url },
    openGraph: {
      title: `Orçaly para ${solution.label}`,
      description: solution.description,
      url,
      type: 'website',
      images: [{ url: '/og-orcaly.png', width: 1200, height: 630, alt: `Orçaly para ${solution.label}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Orçaly para ${solution.label}`,
      description: solution.description,
      images: ['/og-orcaly.png'],
    },
  }
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params
  const solution = findMarketingSolution(slug)
  if (!solution) notFound()

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Orçaly para ${solution.label}`,
    description: solution.description,
    url: `${appUrl}/solucoes/${solution.slug}`,
    isPartOf: { '@type': 'WebSite', name: 'Orçaly', url: appUrl },
  }

  return (
    <main className="min-h-screen bg-white text-[#0b2347] [color-scheme:light]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Voltar para a página inicial do Orçaly">
            <Image src="/logo-orcaly.png" alt="Orçaly" width={168} height={50} className="h-10 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/#segmentos" className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex">Outras soluções</Link>
            <Link href="/cadastro" className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10">Criar conta</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#f4f7fb] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="pointer-events-none absolute left-1/2 top-[-360px] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">{solution.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[.99] tracking-[-.06em] text-[#071b3a] sm:text-6xl">{solution.headline}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{solution.description}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className="rounded-xl bg-[#0b3b78] px-5 py-4 text-center text-sm font-semibold text-white shadow-xl shadow-blue-950/10">Criar minha conta</Link>
              <Link href="/#planos" className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold text-[#0b3b78]">Ver planos</Link>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_rgba(11,48,90,.12)] sm:p-4">
            <div className="rounded-[1.4rem] bg-[#071b3a] p-4 text-white sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/45">Fluxo do segmento</p><p className="mt-1 text-base font-semibold">{solution.label}</p></div>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/70">Orçaly</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {solution.workflow.map((step, index) => (
                  <div key={step} className="rounded-xl border border-white/10 bg-white/[.06] p-3">
                    <span className="text-[10px] font-semibold text-cyan-200">0{index + 1}</span>
                    <p className="mt-1 text-sm font-semibold">{step}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-white p-4 text-[#0b2347]">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Experiência pública</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {solution.publicExperience.map((item) => <span key={item} className="rounded-full bg-[#f4f7fb] px-3 py-2 text-xs font-semibold text-slate-600">{item}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">O que muda na rotina</p><h2 className="mt-3 text-3xl font-semibold leading-[1.04] tracking-[-.05em] sm:text-5xl">A estrutura acompanha o trabalho que realmente acontece.</h2><p className="mt-4 text-base leading-7 text-slate-600">Não é uma página genérica com o nome do segmento trocado. O fluxo destaca as etapas e recursos já previstos para esse tipo de empresa.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {solution.features.map((feature) => <article key={feature} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Check /></span><h3 className="mt-4 text-base font-semibold text-[#0b2347]">{feature}</h3><p className="mt-2 text-sm leading-6 text-slate-500">Conectado ao fluxo de {solution.shortLabel.toLowerCase()} dentro da estrutura do Orçaly.</p></article>)}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#f4f7fb] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 rounded-[1.8rem] bg-[#071b3a] p-6 text-white sm:p-8 lg:grid-cols-[1fr_.85fr] lg:items-center">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-200">Do site para o painel</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">O cliente vê simplicidade. A equipe recebe contexto.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">O site público apresenta o próximo passo. O painel mantém pedidos, clientes, propostas, status e operação reunidos conforme os módulos disponíveis.</p></div>
            <div className="grid gap-2 sm:grid-cols-2">{solution.publicExperience.map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[.06] px-4 py-3 text-sm font-medium text-white/75">{item}</div>)}</div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">Planos atuais</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Comece com a estrutura adequada ao momento da empresa.</h2></div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {marketingPlans.map((plan) => <article key={plan.id} className={`rounded-2xl border p-5 ${plan.featured ? 'border-[#0b3b78] bg-[#071b3a] text-white' : 'border-slate-200 bg-white'}`}><p className={`text-xs font-semibold uppercase tracking-[.14em] ${plan.featured ? 'text-cyan-200' : 'text-[#1776cf]'}`}>{plan.name}</p><p className="mt-3 text-3xl font-semibold tracking-[-.04em]">{plan.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}<span className={`ml-1 text-xs font-medium ${plan.featured ? 'text-white/45' : 'text-slate-400'}`}>/mês</span></p><p className={`mt-3 text-sm leading-6 ${plan.featured ? 'text-white/65' : 'text-slate-600'}`}>{plan.audience}</p><Link href={marketingPlanSignupHref(plan.id)} className={`mt-5 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold ${plan.featured ? 'bg-white text-[#0b3b78]' : 'bg-[#0b3b78] text-white'}`}>Criar conta</Link></article>)}
          </div>
        </div>
      </section>

      <section className="bg-[#071b3a] px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-4xl text-center"><p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-200">Próximo passo</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-5xl">Coloque {solution.label.toLowerCase()} em um fluxo mais organizado.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/65">Crie a conta, escolha o tipo de negócio e configure a presença digital e os módulos disponíveis para sua operação.</p><Link href="/cadastro" className="mt-7 inline-flex rounded-xl bg-white px-5 py-4 text-sm font-semibold text-[#0b3b78]">Criar minha conta</Link></div></section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><Link href="/"><Image src="/logo-orcaly.png" alt="Orçaly" width={150} height={44} className="h-9 w-auto object-contain"/></Link><div className="flex flex-wrap gap-4 text-sm font-medium text-slate-500"><Link href="/">Início</Link><Link href="/#planos">Planos</Link><Link href="/parceiros">Parceiros</Link><Link href="/login">Entrar</Link></div></div></footer>
    </main>
  )
}
