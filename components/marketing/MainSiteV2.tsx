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
    <div className={`orcaly-section-heading ${align === 'center' ? 'orcaly-section-heading-center mx-auto text-center' : ''} max-w-3xl`}>
      <p className={`orcaly-eyebrow text-[11px] font-semibold uppercase tracking-[.17em] ${invert ? 'text-cyan-200' : 'text-[#1776cf]'}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-semibold leading-[1.04] tracking-[-.05em] sm:text-5xl ${invert ? 'text-white' : 'text-[#0b2347]'}`}>{title}</h2>
      {text ? <p className={`mt-4 text-base leading-7 ${invert ? 'text-white/68' : 'text-slate-600'}`}>{text}</p> : null}
    </div>
  )
}

function HeroProductVisual() {
  const workflow = [
    ['site', 'Site', 'Cliente encontra produto ou serviço'],
    ['order', 'Pedido / orçamento', 'A solicitação chega estruturada'],
    ['panel', 'Painel', 'A equipe vê o que precisa agir'],
    ['ops', 'Operação', 'Status e próxima ação avançam'],
    ['client', 'Cliente', 'Acompanha e recebe retorno'],
  ] as const

  return (
    <div className="orcaly-ecosystem marketing-enter" aria-label="Visão integrada do Orçaly">
      <div className="orcaly-ecosystem-aura" aria-hidden="true" />
      <div className="orcaly-ecosystem-grid" aria-hidden="true" />

      <div className="orcaly-ecosystem-rail" aria-hidden="true">
        {workflow.map(([icon, title]) => (
          <div key={title} className="orcaly-ecosystem-node">
            <ProductIcon type={icon} />
          </div>
        ))}
      </div>

      <div className="orcaly-dashboard-frame">
        <div className="orcaly-browser-bar">
          <div className="flex gap-1.5" aria-hidden="true"><span/><span/><span/></div>
          <span className="orcaly-browser-address">painel.orcaly.com.br</span>
          <span className="orcaly-browser-live">Operação</span>
        </div>
        <div className="orcaly-dashboard-body">
          <aside className="orcaly-dashboard-sidebar">
            <div className="orcaly-sidebar-brand" aria-hidden="true" />
            {['Hoje', 'Pedidos', 'Clientes', 'CRM', 'Financeiro'].map((item, index) => (
              <div key={item} className={index === 0 ? 'is-active' : ''}>{item}</div>
            ))}
          </aside>
          <div className="orcaly-dashboard-content">
            <div className="orcaly-dashboard-heading">
              <div>
                <p>Hoje no Orçaly</p>
                <h3>O próximo passo da operação fica claro.</h3>
              </div>
              <span>Operação</span>
            </div>
            <div className="orcaly-dashboard-status-grid">
              {[
                ['Pedido novo', 'Revisar dados'],
                ['Proposta', 'Aguardando retorno'],
                ['Entrega', 'Confirmar cliente'],
              ].map(([title, status], index) => (
                <article key={title}>
                  <div className="orcaly-mini-icon" aria-hidden="true"><ProductIcon type={index === 0 ? 'order' : index === 1 ? 'panel' : 'ops'} /></div>
                  <p>{title}</p>
                  <strong>{status}</strong>
                </article>
              ))}
            </div>
            <div className="orcaly-next-action">
              <div>
                <p>Próxima ação</p>
                <strong>Enviar retorno para o cliente</strong>
              </div>
              <span>Hoje</span>
              <div className="orcaly-progress" aria-hidden="true"><i/><i/><i/><i/></div>
            </div>
          </div>
        </div>
      </div>

      <div className="orcaly-floating-site-card">
        <div className="flex items-center justify-between gap-3">
          <div><p>Site da empresa</p><strong>suaempresa.orcaly.com.br</strong></div>
          <span>Público</span>
        </div>
        <div className="orcaly-site-preview" aria-hidden="true"><i/><div><b/><b/><b/></div></div>
      </div>

      <div className="orcaly-floating-flow-card">
        <div className="orcaly-flow-title"><ProductIcon type="client"/><span>Cliente</span></div>
        <div className="orcaly-flow-line" aria-hidden="true" />
        <div className="orcaly-flow-title"><ProductIcon type="order"/><span>Pedido</span></div>
        <div className="orcaly-flow-line" aria-hidden="true" />
        <div className="orcaly-flow-title"><ProductIcon type="chart"/><span>Financeiro</span></div>
      </div>
    </div>
  )
}

export default function MainSiteV2() {
  const primarySolutions = marketingSolutions.filter((item) => ['graficas', 'restaurantes', 'lojas', 'assistencia-tecnica', 'barbearias', 'servicos', 'eventos'].includes(item.slug))

  return (
    <main className="min-h-screen overflow-x-clip bg-white text-[#0b2347] [color-scheme:light]">
      <ReferralBridge />

      <header className="orcaly-header sticky top-0 z-50">
        <div className="orcaly-header-shell mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Orçaly - página inicial" className="shrink-0">
            <Image src="/logo-orcaly.png" alt="Orçaly" width={178} height={52} priority className="h-10 w-auto object-contain sm:h-11" />
          </Link>

          <nav aria-label="Navegação principal" className="orcaly-desktop-nav hidden items-center gap-1 text-sm font-medium lg:flex">
            <a href="#produto">Produto</a>
            <details className="group relative">
              <summary>Soluções</summary>
              <div className="orcaly-solutions-menu absolute left-1/2 top-[46px] w-[620px] -translate-x-1/2">
                <div className="grid grid-cols-2 gap-1">
                  {primarySolutions.map((solution) => <Link key={solution.slug} href={`/solucoes/${solution.slug}`}><strong>{solution.label}</strong><span>{solution.eyebrow}</span></Link>)}
                </div>
              </div>
            </details>
            <a href="#planos">Planos</a>
            <Link href="/parceiros">Parceiros</Link>
            <a href="#recursos">Recursos</a>
          </nav>

          <div className="orcaly-header-actions hidden items-center gap-2 sm:flex">
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro">Criar minha conta</Link>
          </div>

          <details className="orcaly-mobile-menu relative sm:hidden">
            <summary aria-label="Abrir menu"><span aria-hidden="true"><i/><i/><i/></span></summary>
            <nav aria-label="Navegação móvel" className="absolute right-0 top-14 w-[min(88vw,340px)]">
              <div className="grid gap-1 text-sm font-semibold">
                <a href="#produto">Produto</a>
                <a href="#segmentos">Soluções</a>
                <a href="#planos">Planos</a>
                <Link href="/parceiros">Parceiros</Link>
                <a href="#recursos">Recursos</a>
              </div>
              <div className="orcaly-mobile-actions grid grid-cols-2 gap-2"><Link href="/login">Entrar</Link><Link href="/cadastro">Criar conta</Link></div>
            </nav>
          </details>
        </div>
      </header>

      <section className="orcaly-hero">
        <div className="orcaly-hero-noise" aria-hidden="true" />
        <div className="orcaly-hero-orb orcaly-hero-orb-a" aria-hidden="true" />
        <div className="orcaly-hero-orb orcaly-hero-orb-b" aria-hidden="true" />
        <div className="orcaly-hero-inner mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="orcaly-hero-copy marketing-enter text-center">
            <div className="orcaly-hero-badge mx-auto"><span/>O sistema que entende como sua empresa trabalha.</div>
            <h1>Seu site, pedidos, clientes e operação. Tudo trabalhando junto.</h1>
            <p>Crie a presença digital da sua empresa, receba vendas e orçamentos e acompanhe toda a operação em um único painel adaptado ao seu segmento.</p>
            <div className="orcaly-hero-actions">
              <Link href="/cadastro">Criar minha conta</Link>
              <a href="#produto">Ver o Orçaly funcionando <ArrowIcon/></a>
            </div>
            <div className="orcaly-hero-benefits">
              {['Seu próprio site', 'Painel adaptado', 'Pedidos e clientes centralizados'].map((item) => <span key={item}><i><CheckIcon/></i>{item}</span>)}
            </div>
            <div className="orcaly-payment-note"><ProductIcon type="lock"/><span>Pagamentos online via Mercado Pago quando configurados no marketplace.</span></div>
          </div>
          <HeroProductVisual />
        </div>
      </section>

      <section id="produto" className="marketing-section orcaly-product-theater scroll-mt-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Veja o Orçaly funcionando" title="O cliente entra. O Orçaly organiza. Sua equipe executa." text="A mesma informação atravessa a jornada sem obrigar a empresa a reconstruir o contexto em planilha, conversa e memória humana." align="center" invert />
          <div className="orcaly-workflow-rail">
            {[
              ['site', 'Site', 'Cliente encontra produto ou serviço'],
              ['order', 'Pedido / orçamento', 'A solicitação chega estruturada'],
              ['panel', 'Painel', 'A equipe vê o que precisa agir'],
              ['ops', 'Operação', 'Status e próxima ação avançam'],
              ['client', 'Cliente', 'Acompanha e recebe retorno'],
            ].map(([icon, title, text], index) => <article key={title}><span className="orcaly-workflow-index">0{index + 1}</span><i><ProductIcon type={icon as 'site' | 'order' | 'panel' | 'ops' | 'client'}/></i><div><h3>{title}</h3><p>{text}</p></div>{index < 4 ? <b aria-hidden="true">→</b> : null}</article>)}
          </div>
          <div className="orcaly-demo-stage"><ProductDemoTabs /></div>
        </div>
      </section>

      <section id="recursos" className="marketing-section orcaly-features-section scroll-mt-24">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="orcaly-heading-row"><SectionHeading eyebrow="Produto real" title="Menos lista de features. Mais clareza sobre o que muda na rotina." text="Cada módulo existe para reduzir uma quebra específica entre presença digital, venda e execução." /></div>
          <div className="orcaly-feature-bento">
            {marketingFeatures.map((feature, index) => (
              <article key={feature.key} className={`orcaly-feature-card orcaly-feature-${index + 1}`}>
                <div className="orcaly-feature-top"><span><ProductIcon type={feature.key === 'site' ? 'site' : feature.key === 'whatsapp' ? 'phone' : feature.key === 'financeiro' ? 'chart' : feature.key === 'crm' ? 'client' : 'panel'}/></span><i aria-hidden="true">0{index + 1}</i></div>
                <h3>{feature.title}</h3>
                <p>{feature.benefit}</p>
                <div className="orcaly-feature-visual" aria-hidden="true"><span/><span/><span/><span/></div>
                <div className="orcaly-feature-bullets">{feature.bullets.map((bullet) => <span key={bullet}>{bullet}</span>)}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section orcaly-site-showcase">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-8">
          <div><SectionHeading eyebrow="Site próprio" title="Seu negócio merece um endereço que trabalha junto com a operação." text="A empresa escolhe um subdomínio público no cadastro e personaliza identidade, catálogo, serviços e informações pelo painel." invert /><div className="orcaly-site-pills">{['Logo e cores', 'Banner', 'Produtos ou serviços', 'WhatsApp', 'Carrinho ou orçamento'].map((item) => <span key={item}>{item}</span>)}</div></div>
          <div className="orcaly-public-site-frame">
            <div className="orcaly-public-site-toolbar"><span>suaempresa.orcaly.com.br</span><b>Site publicado</b></div>
            <div className="orcaly-public-site-hero"><p>Sua marca</p><h3>Produtos e serviços com um próximo passo claro.</h3><span>Ver catálogo</span></div>
            <div className="orcaly-public-site-grid">{['Categoria', 'Produto', 'Contato'].map((item) => <div key={item}>{item}</div>)}</div>
          </div>
        </div>
      </section>

      <section className="marketing-section orcaly-whatsapp-section">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="orcaly-whatsapp-shell">
            <div><p className="orcaly-eyebrow">WhatsApp</p><h2>Continue usando o WhatsApp. Só pare de usar ele como sistema de gestão.</h2><p>O cliente pode continuar conversando pelo canal que já conhece. O Orçaly mantém pedido, proposta, status, histórico e próxima ação organizados fora da conversa.</p></div>
            <div className="orcaly-whatsapp-flow">{['Contato', 'Pedido', 'Orçaly', 'Status', 'Equipe'].map((item, index) => <article key={item}><span><ProductIcon type={index === 0 ? 'phone' : index === 1 ? 'order' : index === 2 ? 'panel' : index === 3 ? 'ops' : 'client'}/></span><p>{item}</p>{index < 4 ? <i aria-hidden="true"/> : null}</article>)}</div>
          </div>
        </div>
      </section>

      <section id="segmentos" className="marketing-section orcaly-segments-section scroll-mt-24">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Soluções por segmento" title="O painel muda porque a operação muda." text="O Orçaly já possui tipos de negócio e módulos próprios. A landing agora mostra essas diferenças em vez de vender uma promessa genérica." align="center" />
          <div className="orcaly-segment-mosaic">
            {primarySolutions.map((solution, index) => <Link key={solution.slug} href={`/solucoes/${solution.slug}`} className={`orcaly-segment-card orcaly-segment-${index + 1}`}><div className="orcaly-segment-orbit" aria-hidden="true"><i/><i/><i/></div><p>{solution.eyebrow}</p><h3>{solution.label}</h3><span>{solution.description}</span><div>{solution.workflow.slice(0,4).map((step) => <b key={step}>{step}</b>)}</div><strong>Ver solução <ArrowIcon/></strong></Link>)}
          </div>
        </div>
      </section>

      <section className="marketing-section orcaly-how-section">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8"><SectionHeading eyebrow="Como funciona" title="Da escolha do negócio ao primeiro cliente, sem montar cinco ferramentas." align="center" />
          <div className="orcaly-how-timeline">{[
            ['1', 'Escolha seu negócio', 'A estrutura parte do tipo de operação.'],
            ['2', 'Configure a empresa', 'Marca, produtos, serviços e informações.'],
            ['3', 'Compartilhe seu endereço', 'Use site, WhatsApp, QR Code ou redes sociais.'],
            ['4', 'Receba clientes', 'Pedidos e solicitações chegam com contexto.'],
            ['5', 'Acompanhe a operação', 'Status, financeiro e próxima ação ficam visíveis.'],
          ].map(([number,title,text], index) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div>{index < 4 ? <i aria-hidden="true"/> : null}</article>)}</div>
        </div>
      </section>

      <section className="marketing-section orcaly-trust-section">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:items-center lg:px-8"><div><SectionHeading eyebrow="Confiança" title="A confiança vem do produto e dos limites claros." text="Em vez de números sem fonte ou promessas absolutas, a página mostra o que o sistema realmente faz e como os fluxos são protegidos." /></div><div className="orcaly-trust-cards">{[
          ['lock', 'Acesso autenticado', 'Áreas administrativas exigem autenticação e os novos fluxos validam contexto no servidor.'],
          ['panel', 'Dados por empresa', 'As estruturas operacionais usam company_id quando aplicável para separar os ambientes.'],
          ['chart', 'Pagamento por provider', 'Pagamentos online do marketplace usam a integração existente com Mercado Pago quando configurada.'],
        ].map(([icon,title,text], index) => <article key={title}><span><ProductIcon type={icon as 'lock'|'panel'|'chart'}/></span><i aria-hidden="true">0{index+1}</i><h3>{title}</h3><p>{text}</p></article>)}</div></div>
      </section>

      <section id="planos" className="marketing-section orcaly-pricing-section scroll-mt-24">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Planos" title="Escolha pelo momento da empresa, não por uma tabela interminável." text="Os preços e o fluxo de cadastro atuais foram preservados. O destaque muda apenas a forma de explicar para quem cada plano faz sentido." align="center" />
          <div className="orcaly-pricing-grid">
            {marketingPlans.map((plan) => <article key={plan.id} className={plan.featured ? 'is-featured' : ''}><div className="orcaly-plan-head"><p>{plan.name}</p>{plan.featured ? <span>Recomendado</span> : null}</div><div className="orcaly-plan-price">{money(plan.price)}<span>/mês</span></div><p className="orcaly-plan-audience">{plan.audience}</p><div className="orcaly-plan-outcome"><p>O que resolve</p><strong>{plan.outcome}</strong></div><ul>{plan.highlights.map((item) => <li key={item}><span><CheckIcon/></span>{item}</li>)}</ul><Link href={marketingPlanSignupHref(plan.id)}>Criar conta com {plan.name}</Link></article>)}
          </div>
          <div className="orcaly-plan-selector-wrap"><PlanSelector /></div>
        </div>
      </section>

      <section className="marketing-section orcaly-faq-section">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-[.72fr_1.28fr] lg:px-8"><div className="orcaly-faq-heading"><SectionHeading eyebrow="Perguntas frequentes" title="Antes de criar sua conta." /></div>
          <div className="orcaly-faq-list">{marketingFaq.map((item, index) => <details key={item.question}><summary><span><i>0{index+1}</i>{item.question}</span><b aria-hidden="true">+</b></summary><p>{item.answer}</p></details>)}</div>
        </div>
      </section>

      <section id="contato" className="marketing-section orcaly-contact-section">
        <div className="orcaly-contact-shell mx-auto grid max-w-[1280px] overflow-hidden lg:grid-cols-[1.02fr_.98fr]">
          <div className="orcaly-contact-copy"><p className="orcaly-eyebrow">Fale com a gente</p><h2>Quer entender como o Orçaly encaixa na sua empresa?</h2><p>Estamos por aqui para tirar dúvidas e ajudar você a encontrar a melhor forma de usar o Orçaly no seu negócio.</p><a href="mailto:orcalybr@gmail.com?subject=Quero%20conhecer%20o%20Or%C3%A7aly">orcalybr@gmail.com</a></div>
          <div className="orcaly-contact-steps">{[
            ['Seu segmento', 'Conte como sua empresa vende ou atende.'],
            ['Sua rotina', 'Mostre onde pedidos, clientes ou propostas se perdem hoje.'],
            ['Seu próximo passo', 'Compare a estrutura e escolha o plano no cadastro.'],
          ].map(([title,text], index) => <article key={title}><span>0{index+1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}<Link href="/cadastro">Criar minha conta <ArrowIcon/></Link></div>
        </div>
      </section>

      <section className="marketing-section orcaly-final-cta">
        <div className="orcaly-final-cta-shell mx-auto max-w-[1200px] text-center">
          <div className="orcaly-final-orbit" aria-hidden="true"><i/><i/><i/><i/></div>
          <p className="orcaly-eyebrow">Pronto para começar?</p><h2>Organize sua empresa sem transformar sua rotina em outro trabalho.</h2><p>Crie sua conta, escolha o tipo de negócio e monte a estrutura pública e operacional da empresa.</p><Link href="/cadastro">Criar minha conta <ArrowIcon/></Link>
        </div>
      </section>

      <footer className="orcaly-footer">
        <div className="orcaly-footer-main mx-auto grid max-w-[1320px] gap-10 md:grid-cols-[1.35fr_repeat(3,.65fr)]">
          <div><Image src="/logo-orcaly.png" alt="Orçaly" width={170} height={50} className="h-10 w-auto object-contain"/><p>Site, clientes, vendas e operação no mesmo fluxo, adaptado ao tipo de empresa.</p><a href="mailto:orcalybr@gmail.com">orcalybr@gmail.com</a></div>
          <div><p>Produto</p><div><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#produto">Como funciona</a></div></div>
          <div><p>Soluções</p><div>{primarySolutions.slice(0,5).map((item)=><Link key={item.slug} href={`/solucoes/${item.slug}`}>{item.shortLabel}</Link>)}</div></div>
          <div><p>Empresa</p><div><Link href="/parceiros">Parceiros</Link><a href="#contato">Contato</a><Link href="/suporte">Suporte</Link><Link href="/login">Entrar</Link></div></div>
        </div>
        <div className="orcaly-footer-bottom mx-auto max-w-[1320px]"><span>© {new Date().getFullYear()} Orçaly. Todos os direitos reservados.</span><span>Pagamentos online do marketplace via Mercado Pago quando configurados.</span></div>
      </footer>

      <HomeAiChat />
    </main>
  )
}
