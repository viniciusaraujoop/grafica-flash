'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import HomeAiChat from '@/components/home/HomeAiChat'

// ORCALY_HOME_CONVERSION_V2

type SegmentKey =
  | 'food'
  | 'graphic'
  | 'beauty'
  | 'assistance'
  | 'store'
  | 'services'

type Segment = {
  key: SegmentKey
  label: string
  eyebrow: string
  title: string
  description: string
  idealFor: string
  features: string[]
  gradient: string
  soft: string
  icon: string
}

type Plan = {
  key: 'basico' | 'profissional' | 'premium'
  name: string
  price: number
  description: string
  idealFor: string
  highlights: string[]
  featured?: boolean
  badge?: string
}

const segments: Segment[] = [
  {
    key: 'food',
    label: 'Food',
    eyebrow: 'Cardápio, pedidos e entrega',
    title: 'Venda pelo cardápio digital sem transformar o WhatsApp em planilha.',
    description:
      'Organize produtos, adicionais, variações, retirada, entrega e acompanhamento do pedido em uma experiência feita para negócios de alimentação.',
    idealFor:
      'Restaurantes, hamburguerias, pizzarias, docerias, marmitarias e delivery local.',
    features: [
      'Cardápio com fotos',
      'Carrinho e adicionais',
      'Entrega ou retirada',
      'Pedidos centralizados',
    ],
    gradient: 'from-emerald-400 via-cyan-400 to-blue-500',
    soft: 'bg-emerald-50 text-emerald-700',
    icon: '🍔',
  },
  {
    key: 'graphic',
    label: 'Gráfica',
    eyebrow: 'Orçamento, arte e produção',
    title: 'Receba as informações certas antes de começar o orçamento.',
    description:
      'Medidas, quantidades, acabamentos, arquivos e aprovação de arte ficam organizados para reduzir retrabalho e acelerar a produção.',
    idealFor:
      'Gráficas, comunicação visual, personalizados, brindes e impressão.',
    features: [
      'Upload de arte',
      'Medidas e quantidades',
      'Propostas profissionais',
      'Aprovação de arte',
    ],
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    soft: 'bg-indigo-50 text-indigo-700',
    icon: '🖨️',
  },
  {
    key: 'beauty',
    label: 'Beauty',
    eyebrow: 'Serviços e atendimento',
    title: 'Apresente seus serviços com uma experiência à altura da sua marca.',
    description:
      'Mostre serviços, valores, duração, galeria e formas de contato em uma página profissional, leve e fácil de compartilhar.',
    idealFor:
      'Salões, barbearias, clínicas, estéticas e profissionais autônomos.',
    features: [
      'Serviços organizados',
      'Página profissional',
      'Galeria e depoimentos',
      'Contato integrado',
    ],
    gradient: 'from-fuchsia-500 via-pink-500 to-orange-400',
    soft: 'bg-fuchsia-50 text-fuchsia-700',
    icon: '✨',
  },
  {
    key: 'assistance',
    label: 'Assistência',
    eyebrow: 'Fotos, defeitos e status',
    title: 'Organize cada aparelho desde a entrada até a entrega.',
    description:
      'Registre modelo, defeito, fotos, análise, proposta e andamento do serviço sem perder o histórico do cliente.',
    idealFor:
      'Assistências técnicas, manutenção e conserto de equipamentos.',
    features: [
      'Registro com fotos',
      'Descrição do defeito',
      'Proposta de serviço',
      'Acompanhamento de status',
    ],
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    soft: 'bg-amber-50 text-amber-800',
    icon: '🛠️',
  },
  {
    key: 'store',
    label: 'Loja',
    eyebrow: 'Catálogo e pedidos',
    title: 'Transforme seus produtos em uma vitrine que ajuda a vender.',
    description:
      'Cadastre fotos, vídeos, descrições, preços e variações em um catálogo bonito para divulgar no Instagram, WhatsApp e anúncios.',
    idealFor:
      'Lojas locais, vendedores, pequenos comércios e negócios de produtos.',
    features: [
      'Catálogo online',
      'Fotos e vídeos',
      'Variações de produto',
      'Pedidos organizados',
    ],
    gradient: 'from-cyan-400 via-blue-500 to-indigo-500',
    soft: 'bg-cyan-50 text-cyan-800',
    icon: '🛍️',
  },
  {
    key: 'services',
    label: 'Serviços',
    eyebrow: 'Propostas e acompanhamento',
    title: 'Do primeiro contato à entrega, tudo fica mais claro.',
    description:
      'Centralize solicitações, propostas, prazos, tarefas e histórico do cliente em um fluxo profissional para empresas de serviço.',
    idealFor:
      'Manutenção, reformas, instalações, consultorias e serviços locais.',
    features: [
      'Solicitação de orçamento',
      'Propostas e prazos',
      'Histórico do cliente',
      'Status do atendimento',
    ],
    gradient: 'from-violet-500 via-blue-500 to-cyan-400',
    soft: 'bg-violet-50 text-violet-700',
    icon: '📋',
  },
]

const plans: Plan[] = [
  {
    key: 'basico',
    name: 'Básico',
    price: 49.9,
    description: 'A estrutura essencial para começar organizado.',
    idealFor: 'Quem precisa sair do improviso e criar presença digital.',
    highlights: [
      'Página pública',
      'Pedidos e clientes',
      'Catálogo essencial',
      'Personalização da marca',
    ],
  },
  {
    key: 'profissional',
    name: 'Intermediário',
    price: 99.9,
    description: 'Mais controle comercial para vender e acompanhar.',
    idealFor: 'Negócios em operação que precisam centralizar a rotina.',
    highlights: [
      'Tudo do plano Básico',
      'Catálogo completo',
      'Propostas e follow-up',
      'Relatórios operacionais',
    ],
    featured: true,
    badge: 'Melhor equilíbrio',
  },
  {
    key: 'premium',
    name: 'Premium',
    price: 149.9,
    description: 'Recursos avançados para uma operação em crescimento.',
    idealFor: 'Empresas que querem automatizar e ganhar escala.',
    highlights: [
      'Tudo do Intermediário',
      'Automações',
      'Recuperação de oportunidades',
      'Recursos avançados',
    ],
  },
]

const comparisonRows = [
  {
    feature: 'Página pública e identidade visual',
    basico: true,
    profissional: true,
    premium: true,
  },
  {
    feature: 'Pedidos e clientes',
    basico: true,
    profissional: true,
    premium: true,
  },
  {
    feature: 'Catálogo essencial',
    basico: true,
    profissional: true,
    premium: true,
  },
  {
    feature: 'Catálogo completo',
    basico: false,
    profissional: true,
    premium: true,
  },
  {
    feature: 'Propostas e follow-up',
    basico: false,
    profissional: true,
    premium: true,
  },
  {
    feature: 'Relatórios operacionais',
    basico: false,
    profissional: true,
    premium: true,
  },
  {
    feature: 'Automações',
    basico: false,
    profissional: false,
    premium: true,
  },
  {
    feature: 'Recuperação de oportunidades',
    basico: false,
    profissional: false,
    premium: true,
  },
  {
    feature: 'Recursos avançados',
    basico: false,
    profissional: false,
    premium: true,
  },
] as const

const benefits = [
  {
    number: '01',
    title: 'Uma plataforma, vários segmentos',
    text: 'A estrutura muda conforme o tipo de negócio, sem obrigar sua empresa a trabalhar como um sistema genérico manda.',
  },
  {
    number: '02',
    title: 'Seu cliente entende o próximo passo',
    text: 'Páginas, formulários e chamadas para ação deixam a jornada mais simples para pedir, comprar ou solicitar atendimento.',
  },
  {
    number: '03',
    title: 'Sua equipe enxerga a operação',
    text: 'Pedidos, clientes, propostas e status deixam de viver espalhados entre conversas, anotações e memória humana.',
  },
]

const journey = [
  {
    step: '1',
    title: 'Escolha o segmento',
    text: 'O Orçaly prepara a base mais adequada para o seu tipo de venda.',
  },
  {
    step: '2',
    title: 'Personalize sua presença',
    text: 'Adicione logo, cores, textos, fotos, serviços ou produtos.',
  },
  {
    step: '3',
    title: 'Compartilhe seu link',
    text: 'Divulgue no Instagram, WhatsApp, QR Code, cartão ou anúncio.',
  },
  {
    step: '4',
    title: 'Receba tudo organizado',
    text: 'A operação chega ao painel com informações mais completas e claras.',
  },
]

const faqs = [
  {
    question: 'Preciso saber programar?',
    answer:
      'Não. A proposta do Orçaly é permitir que a própria empresa personalize informações, catálogo, serviços e aparência pelo painel.',
  },
  {
    question: 'O Orçaly funciona para qualquer segmento?',
    answer:
      'A plataforma possui estruturas especializadas para Food, Gráfica, Beauty, Assistência, Loja e Serviços, além de uma base modular para outros negócios.',
  },
  {
    question: 'A página da minha empresa funciona no celular?',
    answer:
      'Sim. As páginas públicas e os principais fluxos são preparados para navegação em celular, tablet e computador.',
  },
  {
    question: 'Como falo com a equipe do Orçaly?',
    answer:
      'Você pode entrar em contato pelo e-mail orcalybr@gmail.com. O endereço também fica disponível no menu e no rodapé.',
  },
]

function money(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function CheckIcon({ active = true }: { active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${
        active
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-100 text-slate-400'
      }`}
    >
      {active ? '✓' : '—'}
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  text,
  align = 'center',
  invert = false,
}: {
  eyebrow: string
  title: string
  text?: string
  align?: 'left' | 'center'
  invert?: boolean
}) {
  const centered = align === 'center'

  return (
    <div
      className={`${centered ? 'mx-auto text-center' : ''} max-w-4xl`}
    >
      <p
        className={`text-[0.7rem] font-black uppercase tracking-[0.2em] ${
          invert ? 'text-cyan-200' : 'text-[#1359a5]'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-[2rem] font-black leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-6xl ${
          invert ? 'text-white' : 'text-[#071b3a]'
        }`}
      >
        {title}
      </h2>
      {text ? (
        <p
          className={`mt-4 text-base font-semibold leading-7 sm:text-lg sm:leading-8 ${
            invert ? 'text-white/72' : 'text-[#5d728d]'
          }`}
        >
          {text}
        </p>
      ) : null}
    </div>
  )
}

function DashboardPreview({ segment }: { segment: Segment }) {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        className={`absolute -inset-5 rounded-[2.8rem] bg-gradient-to-br ${segment.gradient} opacity-20 blur-3xl`}
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-2.5 shadow-[0_32px_80px_rgba(7,27,58,0.18)] sm:rounded-[2.5rem] sm:p-3">
        <div className="overflow-hidden rounded-[1.55rem] bg-[#071b3a] text-white sm:rounded-[2rem]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </div>
            <span className="max-w-[70%] truncate rounded-full bg-white/10 px-3 py-1.5 text-[0.65rem] font-black text-white/70 sm:text-xs">
              suaempresa.orcaly.com.br
            </span>
          </div>

          <div className="grid gap-3 p-4 sm:gap-4 sm:p-5 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="rounded-[1.35rem] bg-white p-4 text-[#071b3a]">
              <span
                className={`inline-flex rounded-full bg-gradient-to-r ${segment.gradient} px-3 py-1.5 text-[0.65rem] font-black text-white`}
              >
                Orçaly {segment.label}
              </span>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Visão geral
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-0.055em]">
                Tudo no lugar.
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                Site, clientes, pedidos e rotina reunidos em uma experiência
                mais clara.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  ['12', 'novos pedidos'],
                  ['8', 'em andamento'],
                  ['5', 'clientes'],
                  ['3', 'concluídos'],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-[#f3f7ff] p-3"
                  >
                    <p className="text-xl font-black text-[#05245c]">
                      {value}
                    </p>
                    <p className="mt-1 text-[0.65rem] font-black text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[1.35rem] bg-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/45">
                      Estrutura ativa
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {segment.eyebrow}
                    </p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl">
                    {segment.icon}
                  </span>
                </div>
              </div>

              {segment.features.slice(0, 3).map((feature, index) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-[1.2rem] bg-white p-3.5 text-[#071b3a]"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${segment.gradient} text-xs font-black text-white`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{feature}</p>
                    <p className="mt-1 text-[0.68rem] font-bold text-slate-400">
                      Configurado para seu segmento
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-xl shadow-blue-950/10 sm:left-10 sm:right-10">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-slate-400">
            Um único sistema
          </p>
          <p className="truncate text-sm font-black text-[#05245c]">
            Adaptado para {segment.label}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">
          Online
        </span>
      </div>
    </div>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-[2rem] border p-5 sm:p-6 ${
        plan.featured
          ? 'border-[#1a67bf] bg-[#071b3a] text-white shadow-2xl shadow-blue-950/20 lg:-translate-y-3'
          : 'border-blue-100 bg-white text-[#071b3a] shadow-xl shadow-blue-950/6'
      }`}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-black text-[#071b3a] shadow-lg">
          {plan.badge}
        </span>
      ) : null}

      <div className={plan.badge ? 'pt-3' : ''}>
        <p
          className={`text-xs font-black uppercase tracking-[0.18em] ${
            plan.featured ? 'text-cyan-200' : 'text-[#1359a5]'
          }`}
        >
          Plano {plan.name}
        </p>
        <p className="mt-4 text-4xl font-black tracking-[-0.06em]">
          {money(plan.price)}
          <span
            className={`ml-1 text-sm tracking-normal ${
              plan.featured ? 'text-white/55' : 'text-slate-400'
            }`}
          >
            /mês
          </span>
        </p>
        <p
          className={`mt-3 text-sm font-bold leading-6 ${
            plan.featured ? 'text-white/70' : 'text-[#607895]'
          }`}
        >
          {plan.description}
        </p>
      </div>

      <div
        className={`mt-5 rounded-2xl p-4 ${
          plan.featured ? 'bg-white/10' : 'bg-[#f5f8ff]'
        }`}
      >
        <p
          className={`text-[0.65rem] font-black uppercase tracking-[0.16em] ${
            plan.featured ? 'text-white/45' : 'text-slate-400'
          }`}
        >
          Ideal para
        </p>
        <p className="mt-2 text-sm font-black leading-6">{plan.idealFor}</p>
      </div>

      <ul className="mt-5 grid gap-3">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm font-black">
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] ${
                plan.featured
                  ? 'bg-cyan-300 text-[#071b3a]'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/cadastro"
        className={`mt-7 rounded-2xl px-5 py-4 text-center text-sm font-black transition hover:-translate-y-0.5 ${
          plan.featured
            ? 'bg-white text-[#05245c] shadow-xl shadow-black/15'
            : 'bg-[#05245c] text-white shadow-lg shadow-blue-950/15'
        }`}
      >
        Escolher {plan.name}
      </Link>
    </article>
  )
}

export default function HomePage() {
  const [activeSegment, setActiveSegment] =
    useState<SegmentKey>('food')
  const [heroIndex, setHeroIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const selectedSegment = useMemo(
    () =>
      segments.find((segment) => segment.key === activeSegment) ??
      segments[0],
    [activeSegment],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % segments.length)
    }, 3600)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const nextSegment = segments[heroIndex]
    setActiveSegment(nextSegment.key)
  }, [heroIndex])

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <main
      className="w-full overflow-x-hidden bg-white pb-20 text-[#071b3a] sm:pb-0"
      style={{ colorScheme: 'light' }}
    >
      <style>{`
        html {
          scroll-behavior: smooth;
        }

        @keyframes orcalyFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes orcalyFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-9px);
          }
        }

        .orcaly-fade-up {
          animation: orcalyFadeUp .7s ease-out both;
        }

        .orcaly-float {
          animation: orcalyFloat 6s ease-in-out infinite;
        }

        .orcaly-section {
          content-visibility: auto;
          contain-intrinsic-size: 1px 820px;
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          .orcaly-fade-up,
          .orcaly-float {
            animation: none;
          }
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-blue-100/80 bg-white/90 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Página inicial do Orçaly"
            className="shrink-0"
          >
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={188}
              height={56}
              priority
              className="h-10 w-auto object-contain sm:h-12"
            />
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 rounded-full border border-blue-100 bg-[#f8fbff] p-1.5 text-sm font-black text-[#526b88] lg:flex"
          >
            {[
              ['#segmentos', 'Soluções'],
              ['#recursos', 'Recursos'],
              ['#planos', 'Planos'],
              ['#como-funciona', 'Como funciona'],
              ['#contato', 'Fale conosco'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-2.5 transition hover:bg-white hover:text-[#05245c] hover:shadow-sm"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/login"
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] transition hover:-translate-y-0.5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5"
            >
              Começar agora
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((current) => !current)}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-white text-[#05245c] shadow-sm sm:hidden"
          >
            <span className="grid gap-1.5">
              <span
                className={`block h-0.5 w-5 rounded-full bg-current transition ${
                  menuOpen ? 'translate-y-2 rotate-45' : ''
                }`}
              />
              <span
                className={`block h-0.5 w-5 rounded-full bg-current transition ${
                  menuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block h-0.5 w-5 rounded-full bg-current transition ${
                  menuOpen ? '-translate-y-2 -rotate-45' : ''
                }`}
              />
            </span>
          </button>
        </div>

        {menuOpen ? (
          <div
            id="mobile-navigation"
            className="fixed inset-x-0 top-[68px] bottom-0 z-50 bg-[#071b3a]/35 p-3 backdrop-blur-sm sm:hidden"
            onClick={closeMenu}
          >
            <nav
              aria-label="Navegação móvel"
              className="rounded-[1.8rem] border border-blue-100 bg-white p-3 shadow-2xl shadow-blue-950/20"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid gap-1">
                {[
                  ['#segmentos', 'Soluções por segmento'],
                  ['#recursos', 'Tudo o que você recebe'],
                  ['#planos', 'Comparar planos'],
                  ['#como-funciona', 'Como funciona'],
                  ['#contato', 'Fale conosco'],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-black text-[#526b88] hover:bg-[#f5f8ff] hover:text-[#05245c]"
                  >
                    {label}
                    <span aria-hidden="true">→</span>
                  </a>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-blue-100 pt-3">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="rounded-2xl border border-blue-100 px-4 py-3 text-center text-sm font-black text-[#05245c]"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  onClick={closeMenu}
                  className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white"
                >
                  Começar
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <section className="relative overflow-hidden bg-[#f4f8ff]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-420px] h-[840px] w-[840px] -translate-x-1/2 rounded-full bg-blue-200/60 blur-3xl" />
          <div className="absolute bottom-[-300px] right-[-220px] h-[540px] w-[540px] rounded-full bg-emerald-200/55 blur-3xl" />
          <div className="absolute bottom-[80px] left-[-260px] h-[480px] w-[480px] rounded-full bg-violet-200/45 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[1fr_0.94fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div className="orcaly-fade-up text-center lg:text-left">
            <div className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-2 shadow-sm lg:mx-0">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate text-[0.65rem] font-black uppercase tracking-[0.15em] text-[#1359a5] sm:text-xs">
                Uma plataforma. A estrutura certa para cada negócio.
              </span>
            </div>

            <h1 className="mx-auto mt-6 max-w-4xl text-[2.55rem] font-black leading-[0.99] tracking-[-0.067em] text-[#071b3a] sm:text-6xl lg:mx-0 lg:text-[4.6rem]">
              Organize sua empresa e transforme cada contato em uma chance real
              de venda.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-[#526b88] sm:text-xl sm:leading-8 lg:mx-0">
              Site, catálogo, pedidos, clientes, propostas e operação em um
              sistema que se adapta ao jeito do seu negócio trabalhar.
            </p>

            <div className="mt-7 grid gap-3 sm:mx-auto sm:max-w-xl sm:grid-cols-2 lg:mx-0">
              <Link
                href="/cadastro"
                className="rounded-[1.25rem] bg-[#05245c] px-6 py-4 text-center font-black text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5"
              >
                Criar minha estrutura
              </Link>
              <a
                href="#planos"
                className="rounded-[1.25rem] border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] shadow-lg shadow-blue-950/5 transition hover:-translate-y-0.5"
              >
                Comparar planos
              </a>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2 sm:max-w-xl">
              {[
                ['6', 'segmentos'],
                ['1', 'painel central'],
                ['24h', 'link disponível'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-blue-100 bg-white/75 px-2 py-3 text-center backdrop-blur sm:px-4"
                >
                  <p className="text-lg font-black text-[#05245c] sm:text-2xl">
                    {value}
                  </p>
                  <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="orcaly-fade-up orcaly-float pb-4 sm:pb-0">
            <DashboardPreview segment={selectedSegment} />
          </div>
        </div>
      </section>

      <section className="border-y border-blue-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-blue-100 md:grid-cols-4">
          {[
            ['Página própria', 'Um endereço profissional para divulgar'],
            ['Fluxo especializado', 'Experiência adaptada ao segmento'],
            ['Operação centralizada', 'Menos informação espalhada'],
            ['Visual personalizável', 'Sua marca continua sendo sua'],
          ].map(([title, text]) => (
            <article
              key={title}
              className="bg-white px-4 py-5 text-center sm:px-6 sm:py-6"
            >
              <p className="text-sm font-black text-[#071b3a]">{title}</p>
              <p className="mx-auto mt-1 max-w-[210px] text-xs font-bold leading-5 text-[#71839a]">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="segmentos"
        className="orcaly-section scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Soluções por segmento"
            title="O mesmo sistema, com uma experiência feita para o seu tipo de venda."
            text="Explore cada estrutura e veja como o Orçaly organiza as informações que realmente importam para sua operação."
          />

          <div className="mt-10 rounded-[2rem] border border-blue-100 bg-[#f7faff] p-3 shadow-2xl shadow-blue-950/8 sm:p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {segments.map((segment, index) => (
                <button
                  key={segment.key}
                  type="button"
                  aria-pressed={activeSegment === segment.key}
                  onClick={() => {
                    setActiveSegment(segment.key)
                    setHeroIndex(index)
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    activeSegment === segment.key
                      ? 'bg-[#05245c] text-white shadow-lg shadow-blue-950/15'
                      : 'bg-white text-[#526b88] hover:text-[#05245c]'
                  }`}
                >
                  <span aria-hidden="true">{segment.icon}</span>
                  {segment.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <article className="relative overflow-hidden rounded-[1.7rem] bg-[#071b3a] p-6 text-white sm:p-8">
                <div
                  className={`absolute -right-24 -top-24 h-60 w-60 rounded-full bg-gradient-to-br ${selectedSegment.gradient} opacity-25 blur-3xl`}
                />
                <div className="relative">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${selectedSegment.gradient} px-4 py-2 text-xs font-black text-white`}
                  >
                    <span aria-hidden="true">{selectedSegment.icon}</span>
                    Orçaly {selectedSegment.label}
                  </span>

                  <p className="mt-6 text-xs font-black uppercase tracking-[0.17em] text-cyan-200">
                    {selectedSegment.eyebrow}
                  </p>
                  <h3 className="mt-3 text-3xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl">
                    {selectedSegment.title}
                  </h3>
                  <p className="mt-4 text-base font-semibold leading-7 text-white/72 sm:text-lg">
                    {selectedSegment.description}
                  </p>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/45">
                      Ideal para
                    </p>
                    <p className="mt-2 text-sm font-black leading-6">
                      {selectedSegment.idealFor}
                    </p>
                  </div>
                </div>
              </article>

              <div className="grid gap-3 sm:grid-cols-2">
                {selectedSegment.features.map((feature, index) => (
                  <article
                    key={feature}
                    className="rounded-[1.5rem] border border-blue-100 bg-white p-5 shadow-lg shadow-blue-950/5"
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${selectedSegment.gradient} text-sm font-black text-white shadow-lg`}
                    >
                      {index + 1}
                    </span>
                    <h4 className="mt-5 text-lg font-black tracking-[-0.025em] text-[#071b3a]">
                      {feature}
                    </h4>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#71839a]">
                      Recurso organizado para trabalhar junto com o restante da
                      operação.
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="recursos"
        className="orcaly-section scroll-mt-24 overflow-hidden bg-[#071b3a] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              eyebrow="Mais clareza, menos improviso"
              title="A página vende. O painel organiza. Sua empresa acompanha."
              text="O Orçaly conecta presença digital e operação para que o cliente tenha uma boa experiência e sua equipe receba informações melhores."
              align="left"
              invert
            />

            <Link
              href="/cadastro"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#05245c] shadow-xl shadow-black/15 transition hover:-translate-y-0.5"
            >
              Começar agora
            </Link>
          </div>

          <div className="grid gap-4">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.number}
                className={`rounded-[2rem] border border-white/10 p-6 sm:p-8 ${
                  index === 1
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-500'
                    : 'bg-white/8'
                }`}
              >
                <div className="flex items-start gap-4 sm:gap-6">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${
                      index === 1
                        ? 'bg-white text-[#05245c]'
                        : 'bg-white/10 text-cyan-200'
                    }`}
                  >
                    {benefit.number}
                  </span>
                  <div>
                    <h3 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                      {benefit.title}
                    </h3>
                    <p
                      className={`mt-3 font-semibold leading-7 ${
                        index === 1 ? 'text-white/85' : 'text-white/65'
                      }`}
                    >
                      {benefit.text}
                    </p>
                  </div>
                </div>
              </article>
            ))}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                'Site',
                'Catálogo',
                'Pedidos',
                'Clientes',
                'Propostas',
                'Relatórios',
                'WhatsApp',
                'Operação',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/8 px-3 py-4 text-center text-xs font-black text-white/80 sm:text-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="planos"
        className="orcaly-section scroll-mt-24 bg-[#f5f8ff] px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Planos transparentes"
            title="Escolha a estrutura que acompanha o momento da sua empresa."
            text="Comece com o essencial, avance para mais controle comercial ou use recursos avançados para crescer com mais automação."
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-3 lg:items-stretch">
            {plans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} />
            ))}
          </div>

          <div className="mt-10 hidden overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/6 lg:block">
            <div className="grid grid-cols-[1.45fr_repeat(3,0.85fr)] bg-[#071b3a] text-white">
              <div className="p-5 text-sm font-black">Comparação de recursos</div>
              {plans.map((plan) => (
                <div
                  key={plan.key}
                  className="border-l border-white/10 p-5 text-center text-sm font-black"
                >
                  {plan.name}
                </div>
              ))}
            </div>

            {comparisonRows.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-[1.45fr_repeat(3,0.85fr)] border-t border-blue-100"
              >
                <div className="p-5 text-sm font-black text-[#526b88]">
                  {row.feature}
                </div>
                {(['basico', 'profissional', 'premium'] as const).map(
                  (key) => (
                    <div
                      key={key}
                      className="grid place-items-center border-l border-blue-100 p-5"
                    >
                      <CheckIcon active={row[key]} />
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 lg:hidden">
            {comparisonRows.map((row) => (
              <article
                key={row.feature}
                className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-black text-[#071b3a]">
                  {row.feature}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {plans.map((plan) => {
                    const active = row[plan.key]

                    return (
                      <div
                        key={plan.key}
                        className={`rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-black ${
                          active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {plan.name}
                        <span className="mt-1 block text-xs">
                          {active ? '✓' : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs font-bold leading-5 text-slate-500">
            Os destaques acima apresentam a evolução entre os planos. A
            disponibilidade de módulos também pode variar conforme o segmento e
            a configuração da empresa.
          </p>
        </div>
      </section>

      <section
        id="como-funciona"
        className="orcaly-section scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Começar é simples"
            title="Da escolha do segmento ao primeiro link compartilhado."
            text="Uma jornada curta para colocar a empresa em uma estrutura mais profissional sem precisar montar várias ferramentas separadas."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {journey.map((item, index) => (
              <article
                key={item.step}
                className="relative rounded-[1.8rem] border border-blue-100 bg-[#f8fbff] p-6 shadow-lg shadow-blue-950/5"
              >
                {index < journey.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-3 top-9 z-10 hidden h-7 w-7 place-items-center rounded-full border border-blue-100 bg-white text-sm font-black text-[#05245c] lg:grid"
                  >
                    →
                  </span>
                ) : null}

                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#05245c] text-lg font-black text-white">
                  {item.step}
                </span>
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#607895]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-10 grid gap-5 overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Um link profissional
              </p>
              <h3 className="mt-3 text-3xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl">
                Sua empresa pronta para ser encontrada, entendida e acionada.
              </h3>
              <p className="mt-4 max-w-2xl font-semibold leading-7 text-white/68">
                Use seu endereço no Instagram, WhatsApp, cartão, QR Code ou
                anúncio e leve o cliente direto para a experiência certa.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 sm:p-5">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/45">
                Exemplo de endereço
              </p>
              <p className="mt-3 break-all text-xl font-black text-white sm:text-3xl">
                suaempresa.orcaly.com.br
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {['Logo e cores', 'Produtos', 'Serviços', 'Botão de contato'].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-xl bg-white px-3 py-2.5 text-center text-xs font-black text-[#05245c]"
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="orcaly-section bg-[#f5f8ff] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="Dúvidas frequentes"
            title="O que você precisa saber antes de começar."
          />

          <div className="mt-9 grid gap-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-blue-100 bg-white p-5 shadow-sm open:shadow-lg open:shadow-blue-950/5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-[#071b3a]">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f3f7ff] text-[#05245c] transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#607895]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contato"
        className="orcaly-section scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.2rem] border border-blue-100 bg-[#071b3a] shadow-2xl shadow-blue-950/20 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden p-6 text-white sm:p-10 lg:p-12">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
            <div className="absolute -bottom-28 right-[-70px] h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Fale conosco
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-[1.04] tracking-[-0.055em] sm:text-5xl">
                Quer entender qual estrutura combina com a sua empresa?
              </h2>
              <p className="mt-4 max-w-2xl font-semibold leading-7 text-white/70">
                Envie uma mensagem para a equipe do Orçaly e conte um pouco
                sobre seu negócio.
              </p>

              <a
                href="mailto:orcalybr@gmail.com?subject=Quero%20conhecer%20o%20Or%C3%A7aly"
                className="mt-7 inline-flex max-w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 font-black text-[#05245c] shadow-xl shadow-black/15 transition hover:-translate-y-0.5"
              >
                <span aria-hidden="true">✉</span>
                <span className="truncate">orcalybr@gmail.com</span>
              </a>
            </div>
          </div>

          <div className="grid content-center gap-3 bg-white p-5 sm:p-8">
            {[
              ['1', 'Conte seu segmento', 'Explique o tipo de negócio e o que deseja organizar.'],
              ['2', 'Tire suas dúvidas', 'Compare recursos, planos e a estrutura mais adequada.'],
              ['3', 'Comece pelo cadastro', 'Crie sua conta quando estiver pronto para avançar.'],
            ].map(([number, title, text]) => (
              <article
                key={number}
                className="flex gap-4 rounded-[1.4rem] bg-[#f5f8ff] p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-sm font-black text-white">
                  {number}
                </span>
                <div>
                  <h3 className="font-black text-[#071b3a]">{title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#71839a]">
                    {text}
                  </p>
                </div>
              </article>
            ))}

            <Link
              href="/cadastro"
              className="mt-2 rounded-2xl bg-gradient-to-r from-[#05245c] to-[#1776cf] px-5 py-4 text-center text-sm font-black text-white shadow-lg shadow-blue-950/15"
            >
              Criar minha conta
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-blue-100 bg-[#f7faff] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.25fr_0.75fr_0.75fr]">
          <div>
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={180}
              height={54}
              className="h-11 w-auto object-contain"
            />
            <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-[#607895]">
              Uma plataforma modular para organizar, apresentar e vender melhor
              em diferentes segmentos.
            </p>
            <a
              href="mailto:orcalybr@gmail.com"
              className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#05245c] hover:underline"
            >
              <span aria-hidden="true">✉</span>
              orcalybr@gmail.com
            </a>
          </div>

          <div>
            <p className="font-black text-[#071b3a]">Navegação</p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-[#607895]">
              <a href="#segmentos" className="hover:text-[#05245c]">
                Soluções
              </a>
              <a href="#recursos" className="hover:text-[#05245c]">
                Recursos
              </a>
              <a href="#planos" className="hover:text-[#05245c]">
                Planos
              </a>
              <a href="#contato" className="hover:text-[#05245c]">
                Fale conosco
              </a>
            </div>
          </div>

          <div>
            <p className="font-black text-[#071b3a]">Acesso</p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-[#607895]">
              <Link href="/login" className="hover:text-[#05245c]">
                Entrar
              </Link>
              <Link href="/cadastro" className="hover:text-[#05245c]">
                Criar conta
              </Link>
            </div>
            <p className="mt-6 text-xs font-bold leading-5 text-slate-400">
              © {new Date().getFullYear()} Orçaly. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 p-3 shadow-2xl shadow-blue-950/15 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-[0.82fr_1.18fr] gap-2">
          <a
            href="#planos"
            className="rounded-2xl border border-blue-100 px-3 py-3 text-center text-sm font-black text-[#05245c]"
          >
            Ver planos
          </a>
          <Link
            href="/cadastro"
            className="rounded-2xl bg-[#05245c] px-3 py-3 text-center text-sm font-black text-white"
          >
            Começar agora
          </Link>
        </div>
      </div>
          <HomeAiChat />
</main>
  )
}
