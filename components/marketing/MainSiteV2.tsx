import Image from 'next/image'
import Link from 'next/link'
import HomeAiChat from '@/components/home/HomeAiChat'
import ProductDemoTabs from '@/components/marketing/ProductDemoTabs'
import PlanSelector from '@/components/marketing/PlanSelector'
import ReferralBridge from '@/components/marketing/ReferralBridge'
import {
  marketingFaq,
  marketingFeatures,
  marketingPlans,
  marketingPlanSignupHref,
  marketingSolutions,
} from '@/lib/marketing/main-site'

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M4 10h11M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProductIcon({ type }: { type: 'site' | 'order' | 'panel' | 'ops' | 'client' | 'lock' | 'phone' | 'chart' }) {
  const common = 'h-5 w-5 fill-none stroke-current'
  if (type === 'site') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 6h.01M10 6h.01"/></svg>
  if (type === 'order') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></svg>
  if (type === 'panel') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M11 9h7M11 13h5M11 17h6"/></svg>
  if (type === 'ops') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><path d="M4 7h16M7 4v6M17 4v6M5 11h14v9H5zM8 15h3M13 15h3"/></svg>
  if (type === 'client') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><circle cx="12" cy="8" r="3"/><path d="M5 20c.6-4.2 2.9-6 7-6s6.4 1.8 7 6"/></svg>
  if (type === 'lock') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg>
  if (type === 'phone') return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.7"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
}

function SectionHeading({ eyebrow, title, text, align = 'left', invert = false }: { eyebrow: string; title: string; text?: string; align?: 'left' | 'center'; invert?: boolean }) {
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-3xl`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[.17em] ${invert ? 'text-cyan-200' : 'text-[#1776cf]'}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-semibold leading-[1.04] tracking-[-.05em] sm:text-5xl ${invert ? 'text-white' : 'text-[#0b2347]'}`}>{title}</h2>
      {text ? <p className={`mt-4 text-base leading-7 ${invert ? 'text-white/68' : 'text-slate-600'}`}>{text}</p> : null}
    </div>
  )
}

function HeroProductVisual() {
  return (
    <div className="relative mx-auto max-w-[620px] pb-12">
      <div className="pointer-events-none absolute inset-x-12 top-8 h-72 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-white p-2.5 shadow-[0_32px_90px_rgba(9,42,84,.18)]">
        <div className="overflow-hidden rounded-[1.4rem] bg-[#071b3a]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex gap-1.5" aria-hidden="true"><span className="h-2.5 w-2.5 rounded-full bg-red-300"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-300"/></div>
            <span className="rounded-full bg-white/8 px-3 py-1.5 text-[10px] font-medium text-white/60">painel.orcaly.com.br</span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-[155px_1fr] sm:p-4">
            <aside className="hidden rounded-xl border border-white/8 bg-white/[.05] p-3 sm:block">
              <div className="h-9 rounded-lg bg-white/10" />
              <div className="mt-4 space-y-2">
                {['Hoje', 'Pedidos', 'Clientes', 'CRM', 'Financeiro'].map((item, index) => <div key={item} className={`rounded-lg px-3 py-2 text-[11px] font-medium ${index === 0 ? 'bg-white text-[#0b3b78]' : 'text-white/55'}`}>{item}</div>)}
              </div>
            </aside>
            <div className="rounded-xl bg-[#f4f7fb] p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Hoje no Orçaly</p><h3 className="mt-1 text-lg font-semibold tracking-[-.03em] text-[#0b2347]">O próximo passo da operação fica claro.</h3></div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Operação</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ['Pedido novo', 'Revisar dados'],
                  ['Proposta', 'Aguardando retorno'],
                  ['Entrega', 'Confirmar cliente'],
                ].map(([title, status]) => <div key={title} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-semibold text-slate-400">{title}</p><p className="mt-1 text-xs font-semibold text-[#0b2347]">{status}</p></div>)}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold text-slate-400">Próxima ação</p><p className="mt-1 text-xs font-semibold text-[#0b2347]">Enviar retorno para o cliente</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Hoje</span></div>
                <div className="mt-3 flex gap-1" aria-hidden="true"><span className="h-2 flex-1 rounded-full bg-[#1776cf]"/><span className="h-2 flex-1 rounded-full bg-[#1776cf]"/><span className="h-2 flex-1 rounded-full bg-slate-200"/><span className="h-2 flex-1 rounded-full bg-slate-200"/></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative -mt-5 ml-auto mr-2 max-w-[380px] rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(9,42,84,.14)] sm:mr-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Site da empresa</p><p className="mt-1 text-sm font-semibold text-[#0b2347]">suaempresa.orcaly.com.br</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-[#1776cf]">Público</span></div>
        <div className="mt-3 rounded-xl bg-[#f4f7fb] p-3"><div className="h-16 rounded-lg bg-gradient-to-r from-[#0b3b78] to-[#1776cf]"/><div className="mt-3 grid grid-cols-2 gap-2"><div className="h-10 rounded-lg bg-white"/><div className="h-10 rounded-lg bg-white"/></div></div>
      </div>
    </div>
  )
}

export default function MainSiteV2() {
  const primarySolutions = marketingSolutions.filter((item) => ['graficas', 'restaurantes', 'lojas', 'assistencia-tecnica', 'barbearias', 'servicos', 'eventos'].includes(item.slug))

  return (
    <main className="min-h-screen overflow-x-clip bg-white text-[#0b2347] [color-scheme:light]">
      <ReferralBridge />
      <style>{`
        html{scroll-behavior:smooth}
        @keyframes marketingEnter{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes marketingFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .marketing-enter{animation:marketingEnter .55s ease-out both}
        .marketing-float{animation:marketingFloat 6s ease-in-out infinite}
        .marketing-section{content-visibility:auto;contain-intrinsic-size:1px 760px}
        @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.marketing-enter,.marketing-float{animation:none!important}.marketing-motion{transition:none!important;transform:none!important}}
      `}</style>

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[74px] sm:px-6 lg:px-8">
          <Link href="/" aria-label="Orçaly - página inicial" className="shrink-0">
            <Image src="/logo-orcaly.png" alt="Orçaly" width={178} height={52} priority className="h-10 w-auto object-contain sm:h-11" />
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 text-sm font-medium text-slate-600 lg:flex">
            <a href="#produto" className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-[#0b3b78]">Produto</a>
            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-[#0b3b78]">Soluções</summary>
              <div className="absolute left-1/2 top-[44px] w-[620px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-blue-950/10">
                <div className="grid grid-cols-2 gap-1">
                  {primarySolutions.map((solution) => <Link key={solution.slug} href={`/solucoes/${solution.slug}`} className="rounded-xl p-3 hover:bg-[#f4f7fb]"><strong className="block text-sm font-semibold text-[#0b2347]">{solution.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{solution.eyebrow}</span></Link>)}
                </div>
              </div>
            </details>
            <a href="#planos" className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-[#0b3b78]">Planos</a>
            <Link href="/parceiros" className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-[#0b3b78]">Parceiros</Link>
            <a href="#recursos" className="rounded-lg px-3 py-2 hover:bg-slate-50 hover:text-[#0b3b78]">Recursos</a>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0b3b78] hover:bg-slate-50">Entrar</Link>
            <Link href="/cadastro" className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10 transition duration-200 hover:-translate-y-0.5 hover:bg-[#082f62]">Criar minha conta</Link>
          </div>

          <details className="relative sm:hidden">
            <summary aria-label="Abrir menu" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 bg-white text-[#0b3b78]"><span className="grid gap-1" aria-hidden="true"><span className="h-0.5 w-5 bg-current"/><span className="h-0.5 w-5 bg-current"/><span className="h-0.5 w-5 bg-current"/></span></summary>
            <nav aria-label="Navegação móvel" className="absolute right-0 top-14 w-[min(88vw,340px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-blue-950/15">
              <div className="grid gap-1 text-sm font-semibold text-slate-600">
                <a href="#produto" className="rounded-xl px-3 py-3 hover:bg-slate-50">Produto</a>
                <a href="#segmentos" className="rounded-xl px-3 py-3 hover:bg-slate-50">Soluções</a>
                <a href="#planos" className="rounded-xl px-3 py-3 hover:bg-slate-50">Planos</a>
                <Link href="/parceiros" className="rounded-xl px-3 py-3 hover:bg-slate-50">Parceiros</Link>
                <a href="#recursos" className="rounded-xl px-3 py-3 hover:bg-slate-50">Recursos</a>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3"><Link href="/login" className="rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold">Entrar</Link><Link href="/cadastro" className="rounded-xl bg-[#0b3b78] px-3 py-3 text-center text-sm font-semibold text-white">Criar conta</Link></div>
            </nav>
          </details>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#f4f7fb]">
        <div className="pointer-events-none absolute left-1/2 top-[-430px] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-22 sm:pt-16 lg:grid-cols-[.96fr_1.04fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-20">
          <div className="marketing-enter text-center lg:text-left">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[.13em] text-[#1776cf] shadow-sm lg:mx-0"><span className="h-2 w-2 rounded-full bg-emerald-500"/>O sistema que entende como sua empresa trabalha.</div>
            <h1 className="mx-auto mt-6 max-w-4xl text-[2.65rem] font-semibold leading-[.98] tracking-[-.065em] text-[#071b3a] sm:text-6xl lg:mx-0 lg:text-[4.6rem]">Seu site, pedidos, clientes e operação. Tudo trabalhando junto.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-8 lg:mx-0">Crie a presença digital da sua empresa, receba vendas e orçamentos e acompanhe toda a operação em um único painel adaptado ao seu segmento.</p>
            <div className="mt-7 grid gap-3 sm:mx-auto sm:max-w-xl sm:grid-cols-2 lg:mx-0">
              <Link href="/cadastro" className="rounded-xl bg-[#0b3b78] px-5 py-4 text-center text-sm font-semibold text-white shadow-xl shadow-blue-950/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#082f62]">Criar minha conta</Link>
              <a href="#produto" className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold text-[#0b3b78] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200">Ver o Orçaly funcionando</a>
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500 lg:justify-start">
              {['Seu próprio site', 'Painel adaptado', 'Pedidos e clientes centralizados'].map((item) => <span key={item} className="inline-flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon/></span>{item}</span>)}
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-500"><span className="text-[#0b3b78]"><ProductIcon type="lock"/></span><span>Pagamentos online via Mercado Pago quando configurados no marketplace.</span></div>
          </div>
          <div className="marketing-enter marketing-float"><HeroProductVisual /></div>
        </div>
      </section>

      <section id="produto" className="marketing-section scroll-mt-24 border-y border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Veja o Orçaly funcionando" title="O cliente entra. O Orçaly organiza. Sua equipe executa." text="A mesma informação atravessa a jornada sem obrigar a empresa a reconstruir o contexto em planilha, conversa e memória humana." align="center" />
          <div className="mt-10 grid gap-3 sm:grid-cols-5">
            {[
              ['site', 'Site', 'Cliente encontra produto ou serviço'],
              ['order', 'Pedido / orçamento', 'A solicitação chega estruturada'],
              ['panel', 'Painel', 'A equipe vê o que precisa agir'],
              ['ops', 'Operação', 'Status e próxima ação avançam'],
              ['client', 'Cliente', 'Acompanha e recebe retorno'],
            ].map(([icon, title, text], index) => <div key={title} className="relative rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 text-center sm:text-left">{index < 4 ? <span aria-hidden="true" className="absolute -right-2 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-xs text-[#1776cf] sm:grid">→</span> : null}<span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0b3b78] shadow-sm sm:mx-0"><ProductIcon type={icon as 'site' | 'order' | 'panel' | 'ops' | 'client'}/></span><h3 className="mt-3 text-sm font-semibold text-[#0b2347]">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}
          </div>
          <ProductDemoTabs />
        </div>
      </section>

      <section id="segmentos" className="marketing-section scroll-mt-24 bg-[#f4f7fb] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Soluções por segmento" title="O painel muda porque a operação muda." text="O Orçaly já possui tipos de negócio e módulos próprios. A landing agora mostra essas diferenças em vez de vender uma promessa genérica." align="center" />
          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {primarySolutions.map((solution) => <Link key={solution.slug} href={`/solucoes/${solution.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#1776cf]">{solution.eyebrow}</p><h3 className="mt-2 text-xl font-semibold tracking-[-.03em] text-[#0b2347]">{solution.label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{solution.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{solution.workflow.slice(0,4).map((step) => <span key={step} className="rounded-full bg-[#f4f7fb] px-2.5 py-1.5 text-[10px] font-semibold text-slate-500">{step}</span>)}</div><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0b3b78]">Ver solução <ArrowIcon/></span></Link>)}
          </div>
        </div>
      </section>

      <section id="recursos" className="marketing-section scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Produto real" title="Menos lista de features. Mais clareza sobre o que muda na rotina." text="Cada módulo existe para reduzir uma quebra específica entre presença digital, venda e execução." />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {marketingFeatures.map((feature, index) => <article key={feature.key} className={`rounded-[1.7rem] border p-5 sm:p-6 ${index === 0 || index === 3 ? 'border-[#0b3b78] bg-[#071b3a] text-white' : 'border-slate-200 bg-[#f8fafc] text-[#0b2347]'}`}><span className={`grid h-11 w-11 place-items-center rounded-xl ${index === 0 || index === 3 ? 'bg-white/10 text-cyan-200' : 'bg-white text-[#0b3b78] shadow-sm'}`}><ProductIcon type={feature.key === 'site' ? 'site' : feature.key === 'whatsapp' ? 'phone' : feature.key === 'financeiro' ? 'chart' : feature.key === 'crm' ? 'client' : 'panel'}/></span><h3 className="mt-4 text-2xl font-semibold tracking-[-.035em]">{feature.title}</h3><p className={`mt-2 text-sm leading-7 ${index === 0 || index === 3 ? 'text-white/65' : 'text-slate-600'}`}>{feature.benefit}</p><div className="mt-5 grid grid-cols-2 gap-2">{feature.bullets.map((bullet) => <span key={bullet} className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${index === 0 || index === 3 ? 'bg-white/8 text-white/75' : 'bg-white text-slate-600'}`}>{bullet}</span>)}</div></article>)}
          </div>
        </div>
      </section>

      <section className="marketing-section overflow-hidden bg-[#071b3a] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div><SectionHeading eyebrow="Site próprio" title="Seu negócio merece um endereço que trabalha junto com a operação." text="A empresa escolhe um subdomínio público no cadastro e personaliza identidade, catálogo, serviços e informações pelo painel." invert /><div className="mt-6 flex flex-wrap gap-2">{['Logo e cores', 'Banner', 'Produtos ou serviços', 'WhatsApp', 'Carrinho ou orçamento'].map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-medium text-white/70">{item}</span>)}</div></div>
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[.05] p-3 shadow-2xl shadow-black/20 sm:p-5"><div className="rounded-[1.4rem] bg-white p-4 text-[#0b2347]"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-xs font-semibold text-slate-400">suaempresa.orcaly.com.br</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Site publicado</span></div><div className="mt-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#0b3b78] to-[#1776cf] p-5 text-white"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/60">Sua marca</p><p className="mt-2 text-2xl font-semibold tracking-[-.04em]">Produtos e serviços com um próximo passo claro.</p><div className="mt-4 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#0b3b78]">Ver catálogo</div></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{['Categoria', 'Produto', 'Contato'].map((item) => <div key={item} className="rounded-xl bg-[#f4f7fb] p-4 text-xs font-semibold text-slate-500">{item}</div>)}</div></div></div>
        </div>
      </section>

      <section className="marketing-section bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-slate-200 bg-[#f8fafc] p-6 sm:p-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:p-10">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">WhatsApp</p><h2 className="mt-3 text-3xl font-semibold leading-[1.04] tracking-[-.05em] text-[#0b2347] sm:text-5xl">Continue usando o WhatsApp. Só pare de usar ele como sistema de gestão.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">O cliente pode continuar conversando pelo canal que já conhece. O Orçaly mantém pedido, proposta, status, histórico e próxima ação organizados fora da conversa.</p></div>
          <div className="grid gap-2 sm:grid-cols-5">{['Contato', 'Pedido', 'Orçaly', 'Status', 'Equipe'].map((item, index) => <div key={item} className="relative rounded-xl border border-slate-200 bg-white p-4 text-center">{index < 4 ? <span aria-hidden="true" className="absolute -right-2 top-1/2 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-[#0b3b78] text-[10px] text-white sm:grid">→</span> : null}<span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#0b3b78]"><ProductIcon type={index === 0 ? 'phone' : index === 1 ? 'order' : index === 2 ? 'panel' : index === 3 ? 'ops' : 'client'}/></span><p className="mt-2 text-xs font-semibold text-[#0b2347]">{item}</p></div>)}</div>
        </div>
      </section>

      <section id="planos" className="marketing-section scroll-mt-24 bg-[#f4f7fb] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Planos" title="Escolha pelo momento da empresa, não por uma tabela interminável." text="Os preços e o fluxo de cadastro atuais foram preservados. O destaque muda apenas a forma de explicar para quem cada plano faz sentido." align="center" />
          <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:items-stretch">
            {marketingPlans.map((plan) => <article key={plan.id} className={`flex h-full flex-col rounded-[1.7rem] border p-5 sm:p-6 ${plan.featured ? 'border-[#0b3b78] bg-[#071b3a] text-white shadow-2xl shadow-blue-950/15' : 'border-slate-200 bg-white text-[#0b2347] shadow-sm'}`}><div className="flex items-center justify-between gap-3"><p className={`text-xs font-semibold uppercase tracking-[.15em] ${plan.featured ? 'text-cyan-200' : 'text-[#1776cf]'}`}>{plan.name}</p>{plan.featured ? <span className="rounded-full bg-cyan-200 px-2.5 py-1 text-[10px] font-semibold text-[#071b3a]">Recomendado</span> : null}</div><p className="mt-4 text-4xl font-semibold tracking-[-.055em]">{money(plan.price)}<span className={`ml-1 text-sm font-medium tracking-normal ${plan.featured ? 'text-white/50' : 'text-slate-400'}`}>/mês</span></p><p className={`mt-4 text-sm leading-6 ${plan.featured ? 'text-white/65' : 'text-slate-600'}`}>{plan.audience}</p><div className={`mt-5 rounded-xl p-4 ${plan.featured ? 'bg-white/[.07]' : 'bg-[#f4f7fb]'}`}><p className={`text-[10px] font-semibold uppercase tracking-[.14em] ${plan.featured ? 'text-white/40' : 'text-slate-400'}`}>O que resolve</p><p className="mt-2 text-sm font-semibold">{plan.outcome}</p></div><ul className="mt-5 grid gap-2.5">{plan.highlights.map((item) => <li key={item} className="flex items-center gap-2 text-sm font-medium"><span className={`grid h-5 w-5 place-items-center rounded-full ${plan.featured ? 'bg-white/10 text-cyan-200' : 'bg-emerald-50 text-emerald-700'}`}><CheckIcon/></span>{item}</li>)}</ul><Link href={marketingPlanSignupHref(plan.id)} className={`mt-7 rounded-xl px-4 py-3 text-center text-sm font-semibold transition duration-200 hover:-translate-y-0.5 ${plan.featured ? 'bg-white text-[#0b3b78]' : 'bg-[#0b3b78] text-white'}`}>Criar conta com {plan.name}</Link></article>)}
          </div>
          <PlanSelector />
        </div>
      </section>

      <section className="marketing-section bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Como funciona" title="Da escolha do negócio ao primeiro cliente, sem montar cinco ferramentas." align="center" />
          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-5">{[
            ['1', 'Escolha seu negócio', 'A estrutura parte do tipo de operação.'],
            ['2', 'Configure a empresa', 'Marca, produtos, serviços e informações.'],
            ['3', 'Compartilhe seu endereço', 'Use site, WhatsApp, QR Code ou redes sociais.'],
            ['4', 'Receba clientes', 'Pedidos e solicitações chegam com contexto.'],
            ['5', 'Acompanhe a operação', 'Status, financeiro e próxima ação ficam visíveis.'],
          ].map(([number,title,text], index) => <article key={number} className="relative rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">{index < 4 ? <span aria-hidden="true" className="absolute -right-2 top-8 hidden h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white text-xs text-[#1776cf] lg:grid">→</span> : null}<span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0b3b78] text-xs font-semibold text-white">{number}</span><h3 className="mt-4 text-base font-semibold text-[#0b2347]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></article>)}</div>
        </div>
      </section>

      <section className="marketing-section border-y border-slate-200 bg-[#f8fafc] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center"><div><SectionHeading eyebrow="Confiança" title="A confiança vem do produto e dos limites claros." text="Em vez de números sem fonte ou promessas absolutas, a página mostra o que o sistema realmente faz e como os fluxos são protegidos." /></div><div className="grid gap-3 sm:grid-cols-3">{[
          ['lock', 'Acesso autenticado', 'Áreas administrativas exigem autenticação e os novos fluxos validam contexto no servidor.'],
          ['panel', 'Dados por empresa', 'As estruturas operacionais usam company_id quando aplicável para separar os ambientes.'],
          ['chart', 'Pagamento por provider', 'Pagamentos online do marketplace usam a integração existente com Mercado Pago quando configurada.'],
        ].map(([icon,title,text]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#0b3b78]"><ProductIcon type={icon as 'lock'|'panel'|'chart'}/></span><h3 className="mt-4 text-sm font-semibold text-[#0b2347]">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></article>)}</div></div>
      </section>

      <section className="marketing-section bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl"><SectionHeading eyebrow="Perguntas frequentes" title="Antes de criar sua conta." align="center" />
          <div className="mt-8 grid gap-2">{marketingFaq.map((item) => <details key={item.question} className="group rounded-xl border border-slate-200 bg-white p-4 open:border-blue-200 open:shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#0b2347]">{item.question}<span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4f7fb] text-[#0b3b78] transition duration-200 group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{item.answer}</p></details>)}</div>
        </div>
      </section>

      <section id="contato" className="marketing-section bg-[#f4f7fb] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(10,43,82,.09)] lg:grid-cols-[1.08fr_.92fr]">
          <div className="bg-[#071b3a] p-6 text-white sm:p-9 lg:p-10"><p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-200">Fale com o Orçaly</p><h2 className="mt-3 text-3xl font-semibold leading-[1.04] tracking-[-.05em] sm:text-5xl">Quer entender como o Orçaly encaixa na sua empresa?</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">O canal público confirmado hoje é o e-mail já usado pelo Orçaly. Nenhum endereço corporativo novo foi inventado nesta página.</p><a href="mailto:orcalybr@gmail.com?subject=Quero%20conhecer%20o%20Or%C3%A7aly" className="mt-7 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0b3b78]">orcalybr@gmail.com</a></div>
          <div className="grid content-center gap-3 p-5 sm:p-7">{[
            ['Seu segmento', 'Conte como sua empresa vende ou atende.'],
            ['Sua rotina', 'Mostre onde pedidos, clientes ou propostas se perdem hoje.'],
            ['Seu próximo passo', 'Compare a estrutura e escolha o plano no cadastro.'],
          ].map(([title,text], index) => <article key={title} className="flex gap-3 rounded-xl bg-[#f4f7fb] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-xs font-semibold text-[#0b3b78] shadow-sm">0{index+1}</span><div><h3 className="text-sm font-semibold text-[#0b2347]">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></article>)}<Link href="/cadastro" className="mt-1 rounded-xl bg-[#0b3b78] px-4 py-3 text-center text-sm font-semibold text-white">Criar minha conta</Link></div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-5xl text-center"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">Pronto para começar?</p><h2 className="mt-3 text-3xl font-semibold leading-[1.03] tracking-[-.05em] text-[#0b2347] sm:text-5xl">Organize sua empresa sem transformar sua rotina em outro trabalho.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">Crie sua conta, escolha o tipo de negócio e monte a estrutura pública e operacional da empresa.</p><Link href="/cadastro" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#0b3b78] px-5 py-4 text-sm font-semibold text-white shadow-xl shadow-blue-950/10 transition duration-200 hover:-translate-y-0.5">Criar minha conta <ArrowIcon/></Link></div></section>

      <footer className="border-t border-slate-200 bg-[#f8fafc] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.35fr_repeat(3,.65fr)]">
          <div><Image src="/logo-orcaly.png" alt="Orçaly" width={170} height={50} className="h-10 w-auto object-contain"/><p className="mt-4 max-w-md text-sm leading-7 text-slate-500">Site, clientes, vendas e operação no mesmo fluxo, adaptado ao tipo de empresa.</p><a href="mailto:orcalybr@gmail.com" className="mt-4 inline-flex text-sm font-semibold text-[#0b3b78] hover:underline">orcalybr@gmail.com</a></div>
          <div><p className="text-sm font-semibold text-[#0b2347]">Produto</p><div className="mt-3 grid gap-2 text-sm text-slate-500"><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#produto">Como funciona</a></div></div>
          <div><p className="text-sm font-semibold text-[#0b2347]">Soluções</p><div className="mt-3 grid gap-2 text-sm text-slate-500">{primarySolutions.slice(0,5).map((item)=><Link key={item.slug} href={`/solucoes/${item.slug}`}>{item.shortLabel}</Link>)}</div></div>
          <div><p className="text-sm font-semibold text-[#0b2347]">Empresa</p><div className="mt-3 grid gap-2 text-sm text-slate-500"><Link href="/parceiros">Parceiros</Link><a href="#contato">Contato</a><Link href="/suporte">Suporte</Link><Link href="/login">Entrar</Link></div></div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Orçaly. Todos os direitos reservados.</span><span>Pagamentos online do marketplace via Mercado Pago quando configurados.</span></div>
      </footer>

      <HomeAiChat />
    </main>
  )
}
