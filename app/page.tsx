'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type SegmentKey = 'services' | 'graphic' | 'food' | 'beauty' | 'assistance' | 'store'

type HeroSegment = {
  type: string
  structure: string
  badge: string
  color: string
}

type SegmentTab = {
  key: SegmentKey
  label: string
  title: string
  description: string
  idealFor: string
  includes: string[]
  accent: string
}

type SimpleCard = {
  title: string
  text: string
}

const heroSegments: HeroSegment[] = [
  {
    type: 'Alimentício',
    structure: 'Cardápio + pedidos + entrega + WhatsApp',
    badge: 'Orçaly Food',
    color: 'from-emerald-400 to-cyan-400',
  },
  {
    type: 'Gráfica',
    structure: 'Orçamentos + upload de arte + produção',
    badge: 'Orçaly Gráfica',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    type: 'Estética',
    structure: 'Serviços + agendamento + atendimento',
    badge: 'Orçaly Beauty',
    color: 'from-fuchsia-400 to-purple-500',
  },
  {
    type: 'Assistência',
    structure: 'Fotos + defeitos + status + proposta',
    badge: 'Orçaly Assistência',
    color: 'from-amber-400 to-orange-500',
  },
]

const understandCards: SimpleCard[] = [
  {
    title: 'Gráfica',
    text: 'Receba artes, medidas, quantidades e prazos de forma organizada.',
  },
  {
    title: 'Alimentício',
    text: 'Monte cardápios, receba pedidos e envie tudo direto para o WhatsApp.',
  },
  {
    title: 'Estética e beleza',
    text: 'Apresente serviços, organize atendimentos e facilite agendamentos.',
  },
  {
    title: 'Assistência técnica',
    text: 'Receba fotos, defeitos, modelos e acompanhe cada etapa do atendimento.',
  },
  {
    title: 'Lojas e serviços',
    text: 'Crie catálogo, receba pedidos e transforme visitantes em clientes.',
  },
]

const segmentTabs: SegmentTab[] = [
  {
    key: 'services',
    label: 'Serviços',
    title: 'Orçaly Serviços',
    description: 'Pedidos, propostas e acompanhamentos para empresas prestadoras de serviço.',
    idealFor: 'Serviços locais, consultorias, manutenção, reformas, instalações e atendimentos personalizados.',
    includes: [
      'Solicitação de orçamento',
      'Propostas',
      'Prazos',
      'Status do atendimento',
      'Histórico do cliente',
      'Link profissional',
    ],
    accent: 'bg-blue-600',
  },
  {
    key: 'graphic',
    label: 'Gráficas',
    title: 'Orçaly Gráfica',
    description: 'Orçamentos com medidas, artes, acabamentos e produção organizada.',
    idealFor: 'Gráficas, comunicação visual, personalizados, brindes e impressão.',
    includes: [
      'Upload de arte',
      'Medidas e quantidades',
      'Propostas profissionais',
      'Aprovação de arte',
      'Status de produção',
      'Catálogo de serviços',
    ],
    accent: 'bg-indigo-600',
  },
  {
    key: 'food',
    label: 'Food',
    title: 'Orçaly Food',
    description: 'Cardápio digital, pedidos online e atendimento direto pelo WhatsApp.',
    idealFor: 'Restaurantes, hamburguerias, pizzarias, marmitarias, docerias e delivery local.',
    includes: [
      'Cardápio com fotos',
      'Produtos, adicionais e variações',
      'Carrinho de pedido',
      'Entrega ou retirada',
      'Mensagem pronta no WhatsApp',
      'Status do pedido',
    ],
    accent: 'bg-emerald-600',
  },
  {
    key: 'beauty',
    label: 'Estética',
    title: 'Orçaly Beauty',
    description: 'Serviços, atendimento e agendamentos em uma página profissional.',
    idealFor: 'Estéticas, barbearias, salões, clínicas e profissionais autônomos.',
    includes: [
      'Lista de serviços',
      'Valores e duração',
      'Botão de agendamento',
      'WhatsApp integrado',
      'Página premium da empresa',
      'Depoimentos e galeria',
    ],
    accent: 'bg-fuchsia-600',
  },
  {
    key: 'assistance',
    label: 'Assistência',
    title: 'Orçaly Assistência',
    description: 'Organize solicitações, defeitos, fotos e status de atendimento.',
    idealFor: 'Assistência técnica, manutenção, conserto de celulares, eletrônicos e equipamentos.',
    includes: [
      'Solicitação com fotos',
      'Marca e modelo do aparelho',
      'Descrição do problema',
      'Status de análise',
      'Proposta de serviço',
      'Histórico do cliente',
    ],
    accent: 'bg-orange-500',
  },
  {
    key: 'store',
    label: 'Lojas',
    title: 'Orçaly Loja',
    description: 'Catálogo, produtos, variações e pedidos em uma vitrine digital.',
    idealFor: 'Lojas locais, vendedores, pequenos comércios e negócios com produtos.',
    includes: [
      'Catálogo online',
      'Fotos e vídeos dos produtos',
      'Variações',
      'Pedido pelo WhatsApp',
      'Página própria',
      'Organização de clientes',
    ],
    accent: 'bg-cyan-600',
  },
]

const timeline = [
  ['01', 'Escolha o tipo de negócio', 'Serviços, Food, Gráfica, Beauty, Assistência, Loja ou outro segmento.'],
  ['02', 'O Orçaly aplica o modelo certo', 'Textos, formulários, status, catálogo e recursos ficam mais alinhados ao seu tipo de venda.'],
  ['03', 'Sua empresa ganha uma página profissional', 'Logo, cores, mídia, catálogo e CTA prontos para divulgar.'],
  ['04', 'Seus clientes pedem, compram ou solicitam atendimento', 'O fluxo fica claro para quem chega pelo Instagram, WhatsApp, QR Code ou anúncio.'],
  ['05', 'Tudo chega organizado no painel', 'Pedidos, orçamentos, clientes, propostas e status ficam centralizados.'],
]

const oneLinkItems = [
  'Logo da empresa',
  'Cores personalizadas',
  'Fotos e vídeos',
  'Catálogo ou cardápio',
  'Botão WhatsApp',
  'Pedidos e orçamentos',
  'Status de atendimento',
]

const beforeAfter = [
  ['Pedido perdido no WhatsApp', 'Tudo salvo no painel'],
  ['Cliente manda informação incompleta', 'Formulário adaptado ao segmento'],
  ['Orçamento feito manualmente', 'Proposta organizada'],
  ['Site genérico', 'Página feita para o tipo do negócio'],
  ['Sem histórico', 'Clientes, pedidos e status registrados'],
  ['Tudo depende de conversa', 'Link profissional funcionando 24h'],
]

const commonResources = [
  'Página própria',
  'Painel de pedidos',
  'Catálogo ou serviços',
  'Botão WhatsApp',
  'Personalização visual',
  'Fotos e vídeos',
  'Clientes e histórico',
  'Status de atendimento',
]

const segmentResources = [
  'Food: cardápio, carrinho, adicionais e entrega',
  'Gráfica: upload de arte, medidas e aprovação',
  'Beauty: serviços, horários e agendamento',
  'Assistência: fotos, defeitos e análise',
  'Loja: catálogo, variações e pedidos',
  'Serviços: propostas, prazos e acompanhamento',
]

const marketplaceItems = [
  'Até 4 fotos por item',
  'Vídeo curto de até 30 segundos',
  'Descrição detalhada',
  'Preço ou valor sob consulta',
  'Botão de pedido ou orçamento',
  'Categorias por segmento',
]

const editorItems = [
  'Logo e identidade visual',
  'Cores e botões',
  'Textos principais',
  'Galeria e vídeos',
  'FAQ e depoimentos',
  'Modelo por segmento',
]

const howItWorks = [
  ['01', 'Escolha seu tipo de negócio', 'O Orçaly entende o segmento e prepara a base ideal.'],
  ['02', 'Personalize sua página', 'Adicione logo, cores, textos, fotos, vídeos e informações.'],
  ['03', 'Compartilhe seu link', 'Use suaempresa.orcaly.com.br no Instagram, WhatsApp, cartão ou QR Code.'],
  ['04', 'Receba tudo organizado', 'Pedidos, orçamentos, clientes e status chegam direto no painel.'],
]

const footerSegments = ['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços']

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  invert = false,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  invert?: boolean
}) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${invert ? 'text-cyan-100' : 'text-[#05245c]'}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-3 text-[2rem] font-black leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-6xl ${invert ? 'text-white' : 'text-[#061a36]'}`}>
        {title}
      </h2>
      {subtitle ? (
        <p className={`mx-auto mt-4 max-w-3xl text-base font-semibold leading-7 sm:text-lg sm:leading-8 ${invert ? 'text-white/72' : 'text-[#607895]'}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

function CheckItem({ children, invert = false }: { children: string; invert?: boolean }) {
  return (
    <li className={`flex gap-3 rounded-2xl px-4 py-3 text-sm font-black ${invert ? 'bg-white/10 text-white' : 'bg-white text-[#05245c] shadow-sm shadow-blue-950/5'}`}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${invert ? 'bg-white text-[#05245c]' : 'bg-[#05245c] text-white'}`}>
        ✓
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  )
}

function MiniBrowserMockup() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-3 shadow-2xl shadow-blue-950/10">
      <div className="rounded-[1.55rem] bg-[#061a36] p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-300" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-300" />
          </div>
          <div className="min-w-0 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/75">
            suaempresa.orcaly.com.br
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.3rem] bg-white p-4 text-[#061a36]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#05245c]">Página premium</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">Seu negócio pronto para vender melhor.</h3>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">Logo, cores, fotos, vídeos, catálogo e botão de contato em um só link.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {['Catálogo', 'WhatsApp', 'Status', 'Pedidos'].map((item) => (
                <span key={item} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {[
              ['X-Bacon especial', 'Food', 'R$ 24,90'],
              ['Banner 90x120', 'Gráfica', 'Sob consulta'],
              ['Limpeza de pele', 'Beauty', 'R$ 120,00'],
            ].map(([title, tag, price]) => (
              <div key={title} className="flex items-center justify-between gap-3 rounded-[1.2rem] bg-white/10 p-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{title}</p>
                  <p className="mt-1 text-xs font-bold text-white/55">{tag}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">{price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SegmentAnimationCard({ segment }: { segment: HeroSegment }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white p-5 shadow-2xl shadow-blue-950/10">
      <div className={`absolute right-[-80px] top-[-80px] h-48 w-48 rounded-full bg-gradient-to-br ${segment.color} opacity-20 blur-2xl`} />
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Estrutura inteligente</p>
        <div className="mt-5 rounded-[1.5rem] bg-[#061a36] p-5 text-white">
          <span className={`inline-flex rounded-full bg-gradient-to-r ${segment.color} px-4 py-2 text-xs font-black text-white shadow-lg`}>
            {segment.badge}
          </span>
          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-white/45">Tipo de negócio</p>
              <p className="mt-2 text-3xl font-black tracking-[-0.05em]">{segment.type}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-[#061a36]">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Estrutura criada</p>
              <p className="mt-2 text-xl font-black tracking-[-0.03em]">{segment.structure}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {['Site', 'Pedidos', 'Painel'].map((item) => (
            <div key={item} className="rounded-2xl bg-[#f5f8ff] p-3 text-center">
              <p className="text-xs font-black text-[#05245c]">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [activeSegment, setActiveSegment] = useState<SegmentKey>('food')
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroSegments.length)
    }, 2800)

    return () => window.clearInterval(timer)
  }, [])

  const currentHero = heroSegments[heroIndex]
  const selectedSegment = useMemo(
    () => segmentTabs.find((item) => item.key === activeSegment) ?? segmentTabs[0],
    [activeSegment]
  )

  return (
    <main className="w-full overflow-x-hidden bg-white text-[#061a36]" style={{ colorScheme: 'light' }}>
      <style>{`
        html, body {
          max-width: 100%;
          overflow-x: hidden;
        }

        @keyframes fadeUpOrcaly {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes floatOrcaly {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes pulseRingOrcaly {
          0%, 100% { box-shadow: 0 0 0 0 rgba(5, 36, 92, .18); }
          50% { box-shadow: 0 0 0 14px rgba(5, 36, 92, 0); }
        }

        .fade-up-orcaly {
          animation: fadeUpOrcaly .75s ease-out both;
        }

        .float-orcaly {
          animation: floatOrcaly 6s ease-in-out infinite;
        }

        .pulse-ring-orcaly {
          animation: pulseRingOrcaly 2.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-up-orcaly,
          .float-orcaly,
          .pulse-ring-orcaly {
            animation: none;
          }
        }
      `}</style>

      <header className="sticky top-0 z-50 w-full border-b border-blue-100 bg-white/92 shadow-sm shadow-blue-950/5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" aria-label="Página inicial do Orçaly" className="min-w-0">
            <img src="/logo-orcaly.png" alt="Orçaly" className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[185px]" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-black text-[#526b88] lg:flex">
            <a href="#segmentos" className="transition hover:text-[#05245c]">Segmentos</a>
            <a href="#link" className="transition hover:text-[#05245c]">Página própria</a>
            <a href="#recursos" className="transition hover:text-[#05245c]">Recursos</a>
            <a href="#como-funciona" className="transition hover:text-[#05245c]">Como funciona</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="rounded-2xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-black text-[#05245c] sm:px-4">
              Entrar
            </Link>
            <Link href="/cadastro" className="hidden rounded-2xl bg-[#05245c] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-950/15 sm:inline-flex">
              Começar
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#f6f9ff]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-320px] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-blue-100 blur-3xl" />
          <div className="absolute bottom-[-260px] right-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute bottom-[120px] left-[-200px] h-[420px] w-[420px] rounded-full bg-purple-100 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-9 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:px-8 lg:py-24">
          <div className="fade-up-orcaly text-center lg:text-left">
            <div className="mx-auto inline-flex max-w-full items-center rounded-full border border-blue-100 bg-white px-3 py-2 shadow-sm lg:mx-0">
              <span className="mr-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#05245c] sm:text-xs">
                Especializado para vender. Unificado para escalar.
              </span>
            </div>

            <h1 className="mx-auto mt-5 max-w-5xl text-[2.45rem] font-black leading-[1.01] tracking-[-0.065em] text-[#061a36] sm:text-6xl sm:leading-[0.97] lg:mx-0 lg:text-7xl">
              O Orçaly entende o seu negócio e entrega a estrutura certa para vender melhor.
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base font-semibold leading-7 text-[#4f6885] sm:text-xl sm:leading-8 lg:mx-0">
              Uma plataforma que se adapta ao seu segmento para organizar pedidos, orçamentos, propostas, cardápios, serviços e atendimentos em um só lugar.
            </p>

            <div className="mt-7 grid gap-3 sm:mx-auto sm:max-w-lg sm:grid-cols-2 lg:mx-0">
              <Link href="/cadastro" className="pulse-ring-orcaly rounded-[1.3rem] bg-[#05245c] px-6 py-4 text-center font-black text-white shadow-xl shadow-blue-950/20">
                Começar agora
              </Link>
              <a href="#segmentos" className="rounded-[1.3rem] border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] shadow-lg shadow-blue-950/5">
                Ver soluções por segmento
              </a>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-black text-[#607895] lg:justify-start">
              {['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços'].map((item) => (
                <span key={item} className="rounded-full border border-blue-100 bg-white px-3 py-2 shadow-sm">
                  Orçaly {item}
                </span>
              ))}
            </div>
          </div>

          <div className="fade-up-orcaly">
            <div className="float-orcaly">
              <SegmentAnimationCard segment={currentHero} />
            </div>
          </div>
        </div>
      </section>

      <section id="entende" className="overflow-hidden bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="O Orçaly te entende"
            title="Não é um sistema genérico. É uma estrutura feita para o jeito que sua empresa vende."
            subtitle="Cada negócio tem uma forma diferente de atender, vender e organizar pedidos. O Orçaly identifica o tipo da sua empresa e entrega uma experiência adaptada com textos, páginas, formulários, status, catálogo e recursos pensados para sua operação."
          />

          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {understandCards.map((card) => (
              <article key={card.title} className="group rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-5 shadow-lg shadow-blue-950/5 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-white text-lg font-black text-[#05245c] shadow-sm transition group-hover:bg-[#05245c] group-hover:text-white">
                  {card.title.slice(0, 1)}
                </div>
                <h3 className="text-xl font-black tracking-[-0.03em] text-[#071b3a]">{card.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#607895]">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="segmentos" className="overflow-hidden bg-[#f8fbff] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Soluções por segmento"
            title="Cada negócio é diferente. O Orçaly se adapta ao seu."
            subtitle="Clique em um segmento e veja como o mesmo SaaS entrega textos, recursos e fluxos especializados."
          />

          <div className="mt-9 rounded-[2rem] border border-blue-100 bg-white p-3 shadow-2xl shadow-blue-950/8 sm:p-4">
            <div className="flex gap-2 overflow-x-auto rounded-[1.4rem] bg-[#f3f7ff] p-2">
              {segmentTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={activeSegment === tab.key}
                  onClick={() => setActiveSegment(tab.key)}
                  className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black transition ${
                    activeSegment === tab.key
                      ? 'bg-[#05245c] text-white shadow-lg shadow-blue-950/15'
                      : 'text-[#526b88] hover:bg-white hover:text-[#05245c]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
              <div className="rounded-[1.8rem] bg-[#061a36] p-6 text-white">
                <span className={`inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ${selectedSegment.accent}`}>
                  {selectedSegment.label}
                </span>
                <h3 className="mt-5 text-4xl font-black tracking-[-0.055em] sm:text-5xl">{selectedSegment.title}</h3>
                <p className="mt-4 text-lg font-semibold leading-8 text-white/74">{selectedSegment.description}</p>
                <div className="mt-6 rounded-2xl bg-white/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Ideal para</p>
                  <p className="mt-2 font-bold leading-7 text-white">{selectedSegment.idealFor}</p>
                </div>
              </div>

              <div className="rounded-[1.8rem] bg-[#f8fbff] p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#05245c]">Inclui</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedSegment.includes.map((item) => (
                    <CheckItem key={item}>{item}</CheckItem>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fluxo" className="overflow-hidden bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Experiência ideal"
            title="Escolha seu segmento. O Orçaly monta a experiência ideal."
            subtitle="O sistema não força a empresa a se adaptar ao software. Ele prepara a base para o jeito que a empresa vende."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {timeline.map(([number, title, text], index) => (
              <article key={number} className="relative rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-5 shadow-lg shadow-blue-950/5">
                {index < timeline.length - 1 ? (
                  <span className="absolute right-[-14px] top-10 z-10 hidden h-7 w-7 rounded-full border border-blue-100 bg-white text-center text-sm font-black leading-7 text-[#05245c] lg:block">
                    →
                  </span>
                ) : null}
                <p className="text-4xl font-black text-[#05245c]">{number}</p>
                <h3 className="mt-4 text-lg font-black tracking-[-0.025em]">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#607895]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="link" className="overflow-hidden bg-[#05245c] px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-center lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Um link. Várias possibilidades.</p>
            <h2 className="mt-3 text-[2rem] font-black leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Uma página profissional para o seu negócio funcionar melhor.
            </h2>
            <p className="mt-4 text-base font-semibold leading-7 text-white/74 sm:text-lg sm:leading-8">
              Cada empresa ganha um link próprio no Orçaly, com visual premium, informações personalizadas, catálogo, mídia, vídeos, botão de contato e fluxo adaptado ao seu segmento.
            </p>

            <div className="mt-7 rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Exemplo</p>
              <p className="mt-2 break-all text-2xl font-black tracking-[-0.03em] text-white sm:text-4xl">suaempresa.orcaly.com.br</p>
            </div>
          </div>

          <div className="space-y-5">
            <MiniBrowserMockup />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {oneLinkItems.map((item) => (
                <div key={item} className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-black text-white">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="antes-depois" className="overflow-hidden bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Antes e depois"
            title="Do atendimento bagunçado para uma operação organizada."
            subtitle="Seu cliente pede. O Orçaly organiza. Sua empresa vende melhor."
          />

          <div className="mt-9 overflow-hidden rounded-[2rem] border border-blue-100 bg-[#f8fbff] shadow-2xl shadow-blue-950/8">
            <div className="grid bg-[#061a36] text-white sm:grid-cols-2">
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">Antes</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Com Orçaly</p>
              </div>
            </div>

            <div className="grid">
              {beforeAfter.map(([before, after]) => (
                <article key={before} className="grid border-t border-blue-100 bg-white sm:grid-cols-2">
                  <div className="p-5 font-bold leading-7 text-slate-500">{before}</div>
                  <div className="border-t border-blue-100 bg-emerald-50 p-5 font-black leading-7 text-emerald-800 sm:border-l sm:border-t-0">
                    {after}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="overflow-hidden bg-[#f8fbff] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Core único. Experiência especializada."
            title="O mesmo Orçaly. Recursos diferentes para cada operação."
          />

          <div className="mt-9 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/6 sm:p-8">
              <h3 className="text-3xl font-black tracking-[-0.045em]">Todos os negócios recebem</h3>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {commonResources.map((item) => (
                  <CheckItem key={item}>{item}</CheckItem>
                ))}
              </ul>
            </article>

            <article className="rounded-[2rem] bg-[#061a36] p-6 text-white shadow-xl shadow-blue-950/15 sm:p-8">
              <h3 className="text-3xl font-black tracking-[-0.045em]">Cada segmento ganha recursos específicos</h3>
              <ul className="mt-6 grid gap-3">
                {segmentResources.map((item) => (
                  <CheckItem key={item} invert>{item}</CheckItem>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="marketplace" className="overflow-hidden bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-center lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Marketplace e vitrine</p>
            <h2 className="mt-3 text-[2rem] font-black leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Mostre seus produtos e serviços com aparência profissional.
            </h2>
            <p className="mt-4 text-base font-semibold leading-7 text-[#607895] sm:text-lg sm:leading-8">
              Cadastre produtos, serviços, fotos, vídeos curtos, descrições, preços, variações e detalhes importantes. O Orçaly transforma tudo em uma vitrine bonita, rápida e fácil de compartilhar.
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-[#f8fbff] p-5 shadow-2xl shadow-blue-950/8">
            <div className="grid gap-4 sm:grid-cols-2">
              {marketplaceItems.map((item) => (
                <article key={item} className="rounded-[1.5rem] bg-white p-5 shadow-lg shadow-blue-950/5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#05245c] text-sm font-black text-white">✓</span>
                  <h3 className="mt-4 font-black tracking-[-0.025em] text-[#071b3a]">{item}</h3>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="editor" className="overflow-hidden bg-[#f8fbff] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Editor em tempo real"
            title="Edite seu site e veja tudo mudando na hora."
            subtitle="Altere logo, cores, textos, fotos, vídeos, seções e informações do seu negócio com prévia em tempo real. Você não precisa entender de código para ter uma presença digital profissional."
          />

          <div className="mt-9 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/8">
              <div className="rounded-[1.6rem] bg-[#061a36] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black">Prévia ao vivo</p>
                  <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-100">Salvando alterações</span>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-2xl bg-white p-4 text-[#061a36]">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400" />
                    <div className="mt-4 h-4 w-28 rounded-full bg-slate-200" />
                    <div className="mt-2 h-3 w-40 rounded-full bg-slate-100" />
                    <div className="mt-5 h-10 rounded-2xl bg-[#05245c]" />
                  </div>
                  <div className="grid gap-3">
                    {['Headline', 'Cores', 'Galeria', 'FAQ'].map((item) => (
                      <div key={item} className="rounded-2xl bg-white/10 p-4">
                        <p className="text-sm font-black">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {editorItems.map((item) => (
                <div key={item} className="rounded-2xl border border-blue-100 bg-white p-5 font-black text-[#05245c] shadow-lg shadow-blue-950/5">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="overflow-hidden bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Como funciona"
            title="Como o Orçaly entrega a estrutura certa para sua empresa"
          />

          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map(([number, title, text]) => (
              <article key={number} className="rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-6 shadow-lg shadow-blue-950/5 transition hover:-translate-y-1 hover:bg-white">
                <p className="text-5xl font-black tracking-[-0.07em] text-[#05245c]">{number}</p>
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#607895]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2.3rem] border border-blue-100 bg-[#05245c] p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-12">
          <img src="/icone-orcaly.png" alt="Ícone Orçaly" className="mx-auto h-14 w-14 object-contain sm:h-16 sm:w-16" />
          <h2 className="mx-auto mt-5 max-w-5xl text-[2rem] font-black leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
            Seu negócio já tem um jeito próprio de vender. Agora ele pode ter uma estrutura à altura.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-7 text-white/75 sm:text-lg sm:leading-8">
            Crie sua página, escolha seu segmento e comece a organizar pedidos, orçamentos ou atendimentos com uma experiência feita para o seu tipo de empresa.
          </p>

          <div className="mt-7 grid gap-3 sm:mx-auto sm:max-w-xl sm:grid-cols-2">
            <Link href="/cadastro" className="rounded-[1.25rem] bg-white px-6 py-4 font-black text-[#05245c]">
              Criar minha estrutura no Orçaly
            </Link>
            <a href="#segmentos" className="rounded-[1.25rem] border border-white/20 bg-white/10 px-6 py-4 font-black text-white">
              Ver segmentos disponíveis
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-blue-100 bg-[#f8fbff] px-4 py-10">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <img src="/logo-orcaly.png" alt="Orçaly" className="h-11 w-auto max-w-[170px] object-contain" />
            <p className="mt-4 max-w-xl text-sm font-bold leading-7 text-[#607895]">
              O Orçaly entende o segmento da empresa e entrega uma estrutura especializada para vender, organizar e atender melhor, mantendo um único SaaS modular.
            </p>
            <p className="mt-4 text-sm font-black text-[#05245c]">Especializado para vender. Unificado para escalar.</p>
          </div>

          <div>
            <p className="font-black text-[#071b3a]">Links úteis</p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-[#607895]">
              <a href="#segmentos" className="hover:text-[#05245c]">Segmentos</a>
              <a href="#marketplace" className="hover:text-[#05245c]">Marketplace</a>
              <a href="#editor" className="hover:text-[#05245c]">Editor visual</a>
              <Link href="/login" className="hover:text-[#05245c]">Entrar</Link>
            </div>
          </div>

          <div>
            <p className="font-black text-[#071b3a]">Segmentos</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {footerSegments.map((segment) => (
                <span key={segment} className="rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#05245c]">
                  Orçaly {segment}
                </span>
              ))}
            </div>
            <Link href="/cadastro" className="mt-5 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white">
              Começar agora
            </Link>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-blue-100 bg-white/96 p-3 shadow-2xl shadow-blue-950/15 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <a href="#segmentos" className="rounded-2xl border border-blue-100 bg-white px-3 py-3 text-center text-sm font-black text-[#05245c]">
            Segmentos
          </a>
          <Link href="/cadastro" className="rounded-2xl bg-[#05245c] px-3 py-3 text-center text-sm font-black text-white">
            Começar
          </Link>
        </div>
      </div>
    </main>
  )
}
