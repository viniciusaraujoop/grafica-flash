import Link from 'next/link'

const planos = [
  {
    nome: 'Essencial',
    preco: 'R$ 97',
    descricao: 'Para empresas que querem começar com uma estrutura digital simples e profissional.',
    destaque: false,
    recursos: [
      'Página personalizada',
      'Catálogo de produtos ou serviços',
      'Pedidos e orçamentos online',
      'Painel básico de controle',
      'Link exclusivo da empresa',
      'Suporte inicial',
    ],
  },
  {
    nome: 'Profissional',
    preco: 'R$ 197',
    descricao: 'Para empresas que querem vender, atender e organizar melhor.',
    destaque: true,
    recursos: [
      'Tudo do Essencial',
      'Marketplace com imagens',
      'Orçamentos em PDF',
      'Envio pelo WhatsApp',
      'Identidade visual da empresa',
      'Controle de status',
      'Suporte prioritário',
    ],
  },
  {
    nome: 'Premium',
    preco: 'R$ 397',
    descricao: 'Para empresas que precisam de automações, equipe e controle avançado.',
    destaque: false,
    recursos: [
      'Tudo do Profissional',
      'Automações personalizadas',
      'Múltiplos usuários',
      'Relatórios gerenciais',
      'Domínio personalizado',
      'Fluxos de atendimento',
      'Acompanhamento dedicado',
    ],
  },
]

const recursos = [
  {
    titulo: 'Marketplace próprio',
    texto: 'Apresente produtos e serviços em uma página moderna, organizada e fácil de acessar.',
  },
  {
    titulo: 'Pedidos e orçamentos',
    texto: 'Receba solicitações completas, com informações claras desde o primeiro contato.',
  },
  {
    titulo: 'Controle da operação',
    texto: 'Acompanhe pedidos, clientes, status, serviços e histórico em um painel simples.',
  },
  {
    titulo: 'Automações sob medida',
    texto: 'Reduza tarefas repetitivas e deixe sua empresa mais rápida no atendimento.',
  },
]

const segmentos = [
  'Serviços de TI',
  'Locadoras',
  'Imobiliárias',
  'Clínicas',
  'Assistências',
  'Consultorias',
  'Comércios',
  'Serviços sob demanda',
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7fbff] pb-24 text-slate-950 md:pb-0">
      <style>
        {`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(22px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes floatSoft {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }

          @keyframes shine {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }

          @keyframes progressMove {
            0%, 100% {
              width: 48%;
            }
            50% {
              width: 86%;
            }
          }

          .fade-up {
            animation: fadeUp .7s cubic-bezier(.2,.8,.2,1) both;
          }

          .fade-up-delay-1 {
            animation: fadeUp .85s cubic-bezier(.2,.8,.2,1) .08s both;
          }

          .fade-up-delay-2 {
            animation: fadeUp .95s cubic-bezier(.2,.8,.2,1) .16s both;
          }

          .float-soft {
            animation: floatSoft 5s ease-in-out infinite;
          }

          .shine::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(
              110deg,
              transparent,
              rgba(255,255,255,.55),
              transparent
            );
            animation: shine 5s ease-in-out infinite;
          }

          .progress-move {
            animation: progressMove 4s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .fade-up,
            .fade-up-delay-1,
            .fade-up-delay-2,
            .float-soft,
            .shine::after,
            .progress-move {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-200/70 blur-3xl" />
        <div className="absolute right-[-160px] top-[12%] h-[360px] w-[360px] rounded-full bg-cyan-200/60 blur-3xl" />
        <div className="absolute bottom-[-180px] left-[25%] h-[380px] w-[380px] rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 py-4 sm:px-5 sm:py-6">
        <header className="fade-up flex items-center justify-between gap-4 rounded-[1.5rem] border border-white bg-white/90 px-4 py-3 shadow-xl shadow-blue-950/5 backdrop-blur-xl sm:rounded-[2rem] sm:px-5 sm:py-4">
          <Link href="/" className="flex min-w-0 items-center">
            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[190px]"
            />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a href="#recursos" className="transition hover:text-[#05245c]">
              Recursos
            </a>

            <a href="#planos" className="transition hover:text-[#05245c]">
              Planos
            </a>

            <a href="#segmentos" className="transition hover:text-[#05245c]">
              Segmentos
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="#planos"
              className="hidden rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:bg-blue-50 sm:inline-block"
            >
              Planos
            </a>

            <Link
              href="/login"
              className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#031a43] sm:px-5"
            >
              Entrar
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-10 py-12 sm:py-16 lg:min-h-[78vh] lg:grid-cols-[1.04fr_.96fr]">
          <div className="fade-up-delay-1 min-w-0">
            <div className="inline-flex max-w-full rounded-full border border-blue-100 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#05245c] shadow-sm sm:text-xs sm:tracking-[0.22em]">
              Plataforma completa para empresas
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-[#071b3a] sm:text-5xl md:text-6xl lg:text-7xl">
              Sua empresa pronta para vender, atender e operar melhor.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Marketplace, pedidos, orçamentos, controle e automações em uma
              plataforma feita para sua operação. Você cuida da entrega. O
              Orçaly organiza o resto.
            </p>

            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <a
                href="#planos"
                className="rounded-2xl bg-[#05245c] px-6 py-4 text-center font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43]"
              >
                Conhecer planos
              </a>

              <Link
                href="/login"
                className="rounded-2xl border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] shadow-sm transition hover:-translate-y-1 hover:bg-blue-50"
              >
                Acessar painel
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-3xl font-black text-[#05245c]">Venda</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Produtos e serviços online
                </p>
              </div>

              <div className="rounded-3xl border border-white bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-3xl font-black text-[#05245c]">Controle</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Painel da operação
                </p>
              </div>

              <div className="rounded-3xl border border-white bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-3xl font-black text-[#05245c]">Auto</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Processos automatizados
                </p>
              </div>
            </div>
          </div>

          <div className="fade-up-delay-2 min-w-0">
            <div className="float-soft rounded-[2rem] border border-white bg-white p-3 shadow-2xl shadow-blue-950/10 sm:rounded-[2.7rem] sm:p-4">
              <div className="rounded-[1.6rem] border border-blue-100 bg-white p-4 sm:rounded-[2.2rem] sm:p-6">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <img
                      src="/icone-orcaly.png"
                      alt="Ícone Orçaly"
                      className="h-12 w-12 shrink-0 rounded-2xl bg-blue-50 object-contain p-2 shadow-lg shadow-blue-950/10 sm:h-16 sm:w-16"
                    />

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-500">
                        Operação digital
                      </p>

                      <p className="truncate text-xl font-black text-[#071b3a] sm:text-2xl">
                        Painel inteligente
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700 sm:px-4 sm:text-sm">
                    Ativo
                  </span>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-3xl border border-blue-100 bg-[#f7fbff] p-4 shadow-sm sm:p-5">
                    <p className="text-sm font-bold text-slate-500">
                      Link da empresa
                    </p>

                    <p className="mt-1 break-all font-black text-[#05245c]">
                      /empresa/sua-marca
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-3xl border border-blue-100 bg-[#f7fbff] p-4 shadow-sm sm:p-5">
                      <p className="text-sm font-bold text-slate-500">
                        Pedidos
                      </p>

                      <p className="mt-2 text-3xl font-black text-[#071b3a] sm:text-4xl">
                        128
                      </p>
                    </div>

                    <div className="rounded-3xl border border-blue-100 bg-[#f7fbff] p-4 shadow-sm sm:p-5">
                      <p className="text-sm font-bold text-slate-500">
                        Em aberto
                      </p>

                      <p className="mt-2 text-3xl font-black text-[#071b3a] sm:text-4xl">
                        14
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <p className="font-black text-[#071b3a]">
                        Fluxo automatizado
                      </p>

                      <p className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700 shadow-sm">
                        Online
                      </p>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div className="progress-move h-full rounded-full bg-gradient-to-r from-[#05245c] via-cyan-400 to-emerald-400" />
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-600">
                      Solicitações, respostas e processos em um só lugar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="py-10 sm:py-12">
          <div className="mb-8 grid gap-4 md:grid-cols-[1fr_.75fr] md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                Recursos
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071b3a] sm:text-4xl">
                Tudo para sua empresa operar com mais controle.
              </h2>
            </div>

            <p className="text-slate-600">
              Uma estrutura digital para vender, atender, organizar e automatizar
              sem depender de improviso.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recursos.map((recurso) => (
              <div
                key={recurso.titulo}
                className="rounded-[2rem] border border-white bg-white p-6 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-[#05245c] to-emerald-400" />

                <h3 className="text-xl font-black text-[#071b3a]">
                  {recurso.titulo}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {recurso.texto}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="segmentos" className="py-10 sm:py-14">
          <div className="overflow-hidden rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-blue-950/5 sm:rounded-[2.5rem] sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                  Para qualquer segmento
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071b3a] sm:text-4xl">
                  O sistema se adapta ao seu tipo de negócio.
                </h2>

                <p className="mt-4 text-slate-600">
                  Produto, serviço, locação, atendimento técnico, venda sob
                  encomenda ou operação interna. O Orçaly acompanha seu fluxo.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {segmentos.map((segmento) => (
                  <div
                    key={segmento}
                    className="rounded-2xl border border-blue-100 bg-[#f7fbff] px-4 py-4 font-black text-[#071b3a] shadow-sm"
                  >
                    {segmento}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className="py-12 sm:py-16">
          <div className="mb-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Planos
            </p>

            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight text-[#071b3a] sm:text-4xl md:text-5xl">
              Escolha a estrutura ideal para sua empresa.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Comece com o essencial e evolua para controle, equipe e automações.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {planos.map((plano) => (
              <div
                key={plano.nome}
                className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-xl transition hover:-translate-y-2 hover:shadow-2xl ${
                  plano.destaque
                    ? 'shine border-blue-200 bg-gradient-to-br from-white via-blue-50 to-emerald-50 text-slate-950 shadow-blue-950/10'
                    : 'border-white bg-white text-slate-950 shadow-blue-950/5'
                }`}
              >
                {plano.destaque && (
                  <div className="mb-4 inline-flex rounded-full bg-[#05245c] px-3 py-1 text-xs font-black text-white lg:absolute lg:right-5 lg:top-5 lg:mb-0">
                    Recomendado
                  </div>
                )}

                <h3 className="text-2xl font-black text-[#071b3a]">
                  {plano.nome}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {plano.descricao}
                </p>

                <div className="mt-6 flex items-end gap-2">
                  <p className="text-5xl font-black text-[#05245c]">
                    {plano.preco}
                  </p>

                  <p className="mb-2 text-sm font-bold text-slate-500">
                    /mês
                  </p>
                </div>

                <div className="my-6 h-px bg-blue-100" />

                <ul className="space-y-3">
                  {plano.recursos.map((recurso) => (
                    <li key={recurso} className="flex gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />

                      <span className="text-slate-700">
                        {recurso}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/cadastro?plano=${plano.nome.toLowerCase()}`}
                  className={`relative z-10 mt-8 block rounded-2xl px-5 py-4 text-center font-black transition hover:-translate-y-1 ${
                    plano.destaque
                      ? 'bg-[#05245c] text-white hover:bg-[#031a43]'
                      : 'border border-blue-100 bg-white text-[#05245c] hover:bg-blue-50'
                  }`}
                >
                  Escolher plano
              </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12 text-center sm:py-14">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-white bg-white p-6 shadow-xl shadow-blue-950/5 sm:rounded-[2.5rem] sm:p-10">
            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="mx-auto mb-8 h-14 w-auto object-contain sm:h-16"
            />

            <h2 className="text-3xl font-black tracking-tight text-[#071b3a] sm:text-4xl md:text-5xl">
              Você cuida da entrega. O Orçaly cuida da estrutura digital.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-slate-600">
              Venda, organize, acompanhe e automatize sua operação em uma
              plataforma moderna para empresas.
            </p>

            <Link
              href="/cadastro?plano=profissional"
              className="mt-8 inline-block rounded-2xl bg-[#05245c] px-7 py-4 font-black text-white transition hover:-translate-y-1 hover:bg-[#031a43]"
            >
              Começar agora
            </Link>
          </div>
        </section>
      </section>

      <div className="fixed bottom-3 left-3 right-3 z-40 rounded-[1.5rem] border border-white bg-white/95 p-3 shadow-2xl shadow-blue-950/15 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <a
            href="#planos"
            className="rounded-2xl border border-blue-100 px-4 py-3 text-center text-sm font-black text-[#05245c]"
          >
            Ver planos
          </a>

          <Link
            href="/login"
            className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  )
}