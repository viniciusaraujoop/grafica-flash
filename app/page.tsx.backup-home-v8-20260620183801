import Link from 'next/link'

const segmentos = [
  'Gráficas e personalizados',
  'Assistências técnicas',
  'Salões e estética',
  'Oficinas e automotivo',
  'Docerias e encomendas',
  'Serviços e reformas',
]

const problemas = [
  {
    titulo: 'WhatsApp cheio, venda perdida',
    texto: 'O cliente chama, manda informação pela metade, some no meio da conversa e o pedido fica perdido no caos.',
  },
  {
    titulo: 'Orçamento sem presença profissional',
    texto: 'Mandar preço solto no chat funciona, mas não transmite confiança. E confiança vende, infelizmente humanos compram com emoção.',
  },
  {
    titulo: 'Empresa boa parecendo improvisada',
    texto: 'Sem site, catálogo, proposta e acompanhamento, até uma empresa excelente pode parecer pequena demais.',
  },
]

const solucoes = [
  {
    titulo: 'Site profissional automático',
    texto: 'Cada empresa ganha um site bonito, claro e adaptado ao tipo de serviço que ela oferece.',
  },
  {
    titulo: 'Pedido inteligente',
    texto: 'O cliente responde perguntas certas, manda detalhes importantes e evita aquele festival de “qual tamanho mesmo?”.',
  },
  {
    titulo: 'Proposta com cara de venda',
    texto: 'Em vez de preço jogado no WhatsApp, a empresa envia uma proposta organizada, bonita e fácil de aprovar.',
  },
]

const recursos = [
  'Site editável sem código',
  'Link com nome da empresa',
  'Catálogo de produtos e serviços',
  'Pedidos organizados',
  'Propostas profissionais',
  'Acompanhamento de oportunidades',
  'Histórico de clientes',
  'Painel simples para vender melhor',
]

const passos = [
  {
    numero: '01',
    titulo: 'Cadastre sua empresa',
    texto: 'Informe o tipo de negócio, dados principais e escolha o plano. O Orçaly já entende o caminho inicial.',
  },
  {
    numero: '02',
    titulo: 'Receba seu site pronto',
    texto: 'Seu site nasce com textos, seções e estrutura pensados para o segmento da empresa.',
  },
  {
    numero: '03',
    titulo: 'Edite tudo sem código',
    texto: 'Mude cores, textos, seções, botões e conteúdo pelo painel. Nada de abrir arquivo, sofrer com terminal e invocar demônios do deploy.',
  },
  {
    numero: '04',
    titulo: 'Venda com mais organização',
    texto: 'Receba pedidos, acompanhe clientes e transforme solicitações em propostas profissionais.',
  },
]

const provas = [
  {
    destaque: 'Menos bagunça',
    texto: 'Pedidos deixam de ficar espalhados em conversas soltas.',
  },
  {
    destaque: 'Mais confiança',
    texto: 'A empresa passa a ter presença digital própria e aparência mais profissional.',
  },
  {
    destaque: 'Mais controle',
    texto: 'O painel centraliza site, produtos, pedidos, clientes e oportunidades.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#061a36]" style={{ colorScheme: 'light' }}>
      <header className="sticky top-0 z-50 border-b border-[#e5edf8] bg-white/95 shadow-sm shadow-[#05245c]/5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Página inicial do Orçaly">
            <img src="/logo-orcaly.png" alt="Orçaly" className="h-10 w-auto object-contain sm:h-12" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black text-[#526b88] lg:flex">
            <a href="#proposta" className="transition hover:text-[#05245c]">Proposta</a>
            <a href="#solucao" className="transition hover:text-[#05245c]">Solução</a>
            <a href="#site" className="transition hover:text-[#05245c]">Site profissional</a>
            <a href="#como-funciona" className="transition hover:text-[#05245c]">Como funciona</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-2xl border border-[#d7e3f3] bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:border-[#05245c] hover:bg-[#f5f8ff]"
            >
              Entrar
            </Link>

            <Link
              href="/cadastro"
              className="hidden rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#05245c]/20 transition hover:bg-[#031a43] sm:inline-flex"
            >
              Começar agora
            </Link>
          </div>
        </div>
      </header>

      <section id="proposta" className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-320px] h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[#e7f1ff] blur-3xl" />
          <div className="absolute right-[-220px] top-[260px] h-[460px] w-[460px] rounded-full bg-[#e3fbef] blur-3xl" />
          <div className="absolute bottom-[-280px] left-[-220px] h-[560px] w-[560px] rounded-full bg-[#f0f6ff] blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100vh-82px)] max-w-7xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <div className="mb-7 inline-flex max-w-full items-center gap-2 rounded-full border border-[#d7e3f3] bg-white px-4 py-2 shadow-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#22c55e]" />
            <span className="truncate text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">
              Site, pedidos e propostas em uma única plataforma
            </span>
          </div>

          <h1 className="mx-auto max-w-6xl text-5xl font-black leading-[0.96] tracking-[-0.065em] text-[#061a36] sm:text-6xl lg:text-8xl">
            O site profissional que transforma atendimento em venda.
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#4f6885] sm:text-xl">
            O Orçaly cria uma presença digital completa para empresas que vendem pelo WhatsApp: site próprio, catálogo, pedido inteligente, proposta profissional e painel para acompanhar oportunidades.
          </p>

          <div className="mt-9 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/cadastro"
              className="rounded-[1.4rem] bg-[#05245c] px-8 py-5 text-base font-black text-white shadow-2xl shadow-[#05245c]/25 transition hover:-translate-y-0.5 hover:bg-[#031a43]"
            >
              Criar meu site profissional
            </Link>

            <Link
              href="/login"
              className="rounded-[1.4rem] border border-[#d7e3f3] bg-white px-8 py-5 text-base font-black text-[#05245c] shadow-xl shadow-[#05245c]/5 transition hover:-translate-y-0.5 hover:border-[#05245c]"
            >
              Entrar na minha conta
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm font-black text-[#607895]">
            <span className="rounded-full bg-[#f2f7ff] px-4 py-2">Sem código</span>
            <span className="rounded-full bg-[#f2f7ff] px-4 py-2">Editável pelo painel</span>
            <span className="rounded-full bg-[#f2f7ff] px-4 py-2">Criado para vender</span>
          </div>

          <div className="mt-14 w-full max-w-6xl rounded-[2.25rem] border border-[#d7e3f3] bg-white p-3 shadow-2xl shadow-[#05245c]/12">
            <div className="rounded-[1.7rem] bg-[#f6f9ff] p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#e5edf8] bg-white px-4 py-3 text-left">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#607895]">Exemplo de site</p>
                  <p className="mt-1 break-all text-sm font-black text-[#05245c]">graficaflash.orcaly.com.br</p>
                </div>
                <div className="hidden rounded-full bg-[#e9f8ef] px-3 py-2 text-xs font-black text-[#15803d] sm:block">Publicado</div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[1.5rem] bg-[#05245c] p-7 text-left text-white">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">Site oficial</p>
                  <h2 className="mt-4 text-4xl font-black leading-tight">Impressos e personalizados sob medida</h2>
                  <p className="mt-4 max-w-xl font-semibold leading-7 text-white/78">
                    Escolha o produto, envie as medidas, explique o pedido e receba uma proposta organizada pelo WhatsApp.
                  </p>
                  <div className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#05245c]">
                    Fazer solicitação
                  </div>
                </div>

                <div className="grid gap-3">
                  {['Catálogo editável', 'Pedido inteligente', 'Proposta profissional'].map((item) => (
                    <div key={item} className="rounded-[1.35rem] border border-[#e5edf8] bg-white p-5 text-left shadow-sm">
                      <p className="font-black text-[#071b3a]">{item}</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-[#607895]">
                        Tudo conectado ao painel da empresa, sem depender de código.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e5edf8] bg-[#f8fbff] px-4 py-14 text-center sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {problemas.map((item) => (
            <article key={item.titulo} className="rounded-[2rem] border border-[#e5edf8] bg-white p-7 shadow-xl shadow-[#05245c]/5">
              <h2 className="text-2xl font-black text-[#071b3a]">{item.titulo}</h2>
              <p className="mt-3 font-semibold leading-7 text-[#607895]">{item.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="solucao" className="bg-white px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">A solução</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Não é só um link. É uma estrutura comercial.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#607895]">
            O Orçaly dá para cada empresa uma vitrine profissional, um jeito melhor de receber pedidos e um painel simples para acompanhar o que pode virar venda.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {solucoes.map((item) => (
              <article key={item.titulo} className="rounded-[2rem] border border-[#e5edf8] bg-white p-8 shadow-xl shadow-[#05245c]/6">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#05245c] text-lg font-black text-white">✓</div>
                <h3 className="text-2xl font-black text-[#071b3a]">{item.titulo}</h3>
                <p className="mt-3 font-semibold leading-7 text-[#607895]">{item.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="site" className="bg-[#05245c] px-4 py-20 text-center text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#b9d6ff]">Site profissional editável</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] sm:text-6xl">
            Cada usuário pode mudar o site sem encostar no código.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg font-semibold leading-8 text-white/75">
            Textos, cores, seções, botões, catálogo e conteúdo podem ser ajustados no painel. A empresa tem liberdade para evoluir o site conforme vende mais.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recursos.map((recurso) => (
              <div key={recurso} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm font-black text-white backdrop-blur">
                {recurso}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="segmentos" className="bg-white px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">Feito para vários segmentos</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            O site já nasce com linguagem próxima do tipo de serviço.
          </h2>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {segmentos.map((segmento) => (
              <span key={segmento} className="rounded-full border border-[#d7e3f3] bg-[#f6f9ff] px-5 py-3 text-sm font-black text-[#05245c]">
                {segmento}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-[#f8fbff] px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">Como funciona</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Da primeira visita até a proposta, tudo fica mais organizado.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {passos.map((passo) => (
              <article key={passo.numero} className="rounded-[2rem] border border-[#e5edf8] bg-white p-7 text-center shadow-lg shadow-[#05245c]/5">
                <p className="text-5xl font-black text-[#05245c]">{passo.numero}</p>
                <h3 className="mt-5 text-2xl font-black text-[#071b3a]">{passo.titulo}</h3>
                <p className="mt-3 font-semibold leading-7 text-[#607895]">{passo.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">Resultado esperado</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Uma empresa mais apresentável, organizada e pronta para vender melhor.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {provas.map((item) => (
              <article key={item.destaque} className="rounded-[2rem] border border-[#e5edf8] bg-[#f8fbff] p-8 text-center">
                <h3 className="text-3xl font-black text-[#05245c]">{item.destaque}</h3>
                <p className="mt-3 font-semibold leading-7 text-[#607895]">{item.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8fbff] px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2.5rem] border border-[#d7e3f3] bg-white p-8 shadow-2xl shadow-[#05245c]/12 sm:p-12">
          <img src="/icone-orcaly.png" alt="Ícone Orçaly" className="mx-auto h-16 w-16 object-contain" />
          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Coloque sua empresa em um site que passa confiança.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-[#607895]">
            Comece com um site profissional, organize pedidos e envie propostas melhores. Sem depender de programador, designer ou gambiarra que só funciona na terça-feira.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/cadastro" className="rounded-[1.4rem] bg-[#05245c] px-8 py-5 font-black text-white shadow-xl shadow-[#05245c]/20">
              Criar meu site agora
            </Link>
            <Link href="/login" className="rounded-[1.4rem] border border-[#d7e3f3] bg-white px-8 py-5 font-black text-[#05245c]">
              Entrar
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5edf8] bg-white px-4 py-8 text-center">
        <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-10 w-auto object-contain" />
        <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-6 text-[#607895]">
          Orçaly, site profissional, pedidos inteligentes e propostas para empresas que querem parecer mais confiáveis e vender melhor.
        </p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d7e3f3] bg-white/95 p-3 shadow-2xl shadow-[#05245c]/15 backdrop-blur sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/login" className="rounded-2xl border border-[#d7e3f3] bg-white px-4 py-3 text-center text-sm font-black text-[#05245c]">
            Entrar
          </Link>
          <Link href="/cadastro" className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white">
            Criar site
          </Link>
        </div>
      </div>
    </main>
  )
}
