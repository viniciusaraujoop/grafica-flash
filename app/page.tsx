import Link from 'next/link'

const planos = [
  {
    id: 'basico',
    nome: 'Essencial',
    preco: 'R$ 49,90',
    destaque: false,
    chamada: 'Para começar com uma estrutura profissional.',
    beneficios: [
      'Página pública da empresa',
      'Orçamentos online',
      'Cadastro de produtos',
      'Painel de pedidos',
    ],
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 'R$ 99,90',
    destaque: true,
    chamada: 'O plano mais indicado para vender com mais organização.',
    beneficios: [
      'Tudo do Essencial',
      'Mini-CRM de clientes',
      'Histórico de pedidos',
      'Filtros comerciais',
      'Prioridade nas melhorias',
    ],
  },
  {
    id: 'premium',
    nome: 'Premium',
    preco: 'R$ 149,90',
    destaque: false,
    chamada: 'Para empresas que querem operar com mais controle.',
    beneficios: [
      'Tudo do Profissional',
      'Mais personalização',
      'Acompanhamento avançado',
      'Recursos premium',
    ],
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f8ff] text-slate-950">
      <section className="relative overflow-hidden bg-[#07142f] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-180px] top-[-180px] h-[460px] w-[460px] rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute right-[-180px] top-[120px] h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-[-200px] left-[35%] h-[480px] w-[480px] rounded-full bg-orange-400/20 blur-3xl" />
        </div>

        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center">
            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-bold text-blue-100/80 md:flex">
            <a href="#beneficios" className="hover:text-white">Benefícios</a>
            <a href="#planos" className="hover:text-white">Planos</a>
            <Link href="/login" className="hover:text-white">Entrar</Link>
          </nav>

          <Link
            href="/cadastro?plano=profissional"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#05245c] shadow-lg shadow-black/10 transition hover:-translate-y-0.5"
          >
            Começar agora
          </Link>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-28 lg:pt-16">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100 backdrop-blur">
              Sistema completo para empresas que querem vender com mais organização
            </div>

            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Pare de perder cliente no WhatsApp bagunçado.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100/85 sm:text-xl">
              O Orçaly transforma pedidos, orçamentos, produtos e clientes em um painel claro,
              bonito e pronto para sua empresa vender melhor todos os dias.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cadastro?plano=profissional"
                className="rounded-2xl bg-white px-7 py-4 text-center font-black text-[#05245c] shadow-xl shadow-black/20 transition hover:-translate-y-1"
              >
                Quero organizar minha empresa
              </Link>

              <a
                href="#planos"
                className="rounded-2xl border border-white/15 bg-white/10 px-7 py-4 text-center font-black text-white backdrop-blur transition hover:bg-white/15"
              >
                Ver planos
              </a>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-black">24h</p>
                <p className="mt-2 text-sm font-semibold text-blue-100/75">
                  Pedidos entrando mesmo fora do horário
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-black">CRM</p>
                <p className="mt-2 text-sm font-semibold text-blue-100/75">
                  Clientes e histórico em um só lugar
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-black">Pix</p>
                <p className="mt-2 text-sm font-semibold text-blue-100/75">
                  Pagamentos e planos integrados
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2.25rem] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-[1.75rem] bg-white p-5 text-slate-950">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
                      Visão do painel
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
                      Clientes que ainda podem comprar
                    </h2>
                  </div>

                  <div className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">
                    Ao vivo
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  {[
                    ['Maria Oliveira', 'R$ 1.240,00', 'Cliente fiel'],
                    ['Anderson Silva', 'R$ 680,00', 'Não fechou'],
                    ['Loja Central', 'R$ 2.890,00', 'Inativo há 30 dias'],
                  ].map((item) => (
                    <div key={item[0]} className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black text-[#071b3a]">{item[0]}</p>
                          <p className="mt-1 text-sm font-bold text-slate-500">
                            Total em pedidos: {item[1]}
                          </p>
                        </div>

                        <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#05245c]">
                          {item[2]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-3xl bg-[#07142f] p-5 text-white">
                  <p className="text-sm font-bold text-blue-100/80">
                    O prejuízo invisível
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    Clientes esquecidos viram vendas perdidas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5">
            <p className="text-4xl">🧠</p>
            <h3 className="mt-5 text-2xl font-black text-[#071b3a]">
              Venda com memória comercial
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              O sistema lembra quem pediu, quem comprou, quem sumiu e quem merece uma abordagem.
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5">
            <p className="text-4xl">⚡</p>
            <h3 className="mt-5 text-2xl font-black text-[#071b3a]">
              Menos bagunça operacional
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              Produtos, pedidos, pagamentos e clientes saem do improviso e entram em um fluxo profissional.
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5">
            <p className="text-4xl">📈</p>
            <h3 className="mt-5 text-2xl font-black text-[#071b3a]">
              Sensação de empresa grande
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              Seu cliente percebe organização antes mesmo de comprar. Percepção vende, infelizmente até mais do que bom senso.
            </p>
          </div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
            Escolha seu plano
          </p>
          <h2 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">
            Comece antes que outro concorrente pareça mais organizado que você.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            O plano escolhido aqui será levado automaticamente para o cadastro.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className={`relative rounded-[2rem] border bg-white p-7 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10 ${
                plano.destaque ? 'border-[#05245c] ring-4 ring-blue-100' : 'border-blue-100'
              }`}
            >
              {plano.destaque && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#05245c] px-5 py-2 text-sm font-black text-white shadow-lg shadow-blue-950/20">
                  Mais escolhido
                </div>
              )}

              <h3 className="text-3xl font-black text-[#071b3a]">
                {plano.nome}
              </h3>

              <p className="mt-2 leading-7 text-slate-600">
                {plano.chamada}
              </p>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-black text-[#071b3a]">
                  {plano.preco}
                </span>
                <span className="pb-2 font-bold text-slate-500">/mês</span>
              </div>

              <ul className="mt-6 grid gap-3">
                {plano.beneficios.map((beneficio) => (
                  <li key={beneficio} className="flex gap-3 text-sm font-bold leading-6 text-slate-600">
                    <span className="text-emerald-600">✓</span>
                    {beneficio}
                  </li>
                ))}
              </ul>

              <Link
                href={`/cadastro?plano=${plano.id}`}
                className={`mt-7 block rounded-2xl px-5 py-4 text-center font-black transition ${
                  plano.destaque
                    ? 'bg-[#05245c] text-white hover:bg-[#031a43]'
                    : 'bg-blue-50 text-[#05245c] hover:bg-blue-100'
                }`}
              >
                Assinar {plano.nome}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
