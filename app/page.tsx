import Link from 'next/link'

const segmentos = [
  'Gráficas',
  'Assistências técnicas',
  'Salões e estética',
  'Oficinas',
  'Docerias e encomendas',
  'Serviços e reformas',
]

const dores = [
  {
    titulo: 'Pedidos perdidos no WhatsApp',
    texto: 'O cliente manda mensagem incompleta, a conversa se perde e a venda esfria.',
  },
  {
    titulo: 'Orçamento com cara de improviso',
    texto: 'Preço enviado solto no chat passa pouca confiança e abre espaço para negociação ruim.',
  },
  {
    titulo: 'Empresa pequena parecendo menor ainda',
    texto: 'Sem site, catálogo e proposta profissional, a empresa boa parece amadora.',
  },
]

const solucoes = [
  'Site profissional criado automaticamente para cada empresa',
  'Link próprio com nome da empresa no domínio',
  'Catálogo de produtos e serviços editável',
  'Pedido inteligente com perguntas por tipo de negócio',
  'Propostas profissionais com aprovação do cliente',
  'Painel para organizar pedidos, clientes e oportunidades',
]

const passos = [
  {
    numero: '01',
    titulo: 'A empresa se cadastra',
    texto: 'Ela escolhe o tipo de negócio e o Orçaly prepara a estrutura inicial automaticamente.',
  },
  {
    numero: '02',
    titulo: 'Ganha um site profissional',
    texto: 'O site já nasce com textos, seções, cores e fluxo de pedido adaptados ao segmento.',
  },
  {
    numero: '03',
    titulo: 'Recebe pedidos organizados',
    texto: 'O cliente envia as informações certas e a empresa transforma isso em proposta.',
  },
]

const recursos = [
  'Editor de site sem código',
  'Subdomínio por empresa',
  'Loja e catálogo profissional',
  'Pedido inteligente',
  'Geração de proposta',
  'Central de oportunidades',
  'Mini-CRM de clientes',
  'Admin master e segurança',
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#071b3a]" style={{ colorScheme: 'light' }}>
      <header className="sticky top-0 z-50 border-b border-[#e6edf8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <img src="/logo-orcaly.png" alt="Orçaly" className="h-10 w-auto object-contain sm:h-12" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black text-[#36516f] lg:flex">
            <a href="#proposta" className="transition hover:text-[#05245c]">Proposta</a>
            <a href="#solucao" className="transition hover:text-[#05245c]">Solução</a>
            <a href="#segmentos" className="transition hover:text-[#05245c]">Segmentos</a>
            <a href="#como-funciona" className="transition hover:text-[#05245c]">Como funciona</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-2xl border border-[#d8e4f4] bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:border-[#05245c] hover:bg-[#f5f8ff]"
            >
              Entrar
            </Link>

            <Link
              href="/cadastro"
              className="hidden rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#05245c]/15 transition hover:bg-[#031a43] sm:inline-flex"
            >
              Começar
            </Link>
          </div>
        </div>
      </header>

      <section id="proposta" className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-260px] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-[#e8f1ff] blur-3xl" />
          <div className="absolute right-[-180px] top-[220px] h-[420px] w-[420px] rounded-full bg-[#dffbed] blur-3xl" />
          <div className="absolute bottom-[-260px] left-[-180px] h-[520px] w-[520px] rounded-full bg-[#edf4ff] blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100vh-82px)] max-w-7xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d8e4f4] bg-white px-4 py-2 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">
              Site, pedidos e propostas para empresas
            </span>
          </div>

          <h1 className="mx-auto max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.06em] text-[#061a36] sm:text-6xl lg:text-8xl">
            Sua empresa com presença digital de gente grande.
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#4d6683] sm:text-xl">
            O Orçaly cria um site profissional para cada negócio, organiza pedidos do WhatsApp, monta propostas bonitas e ajuda pequenas empresas a venderem com mais confiança.
          </p>

          <div className="mt-9 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/cadastro"
              className="rounded-[1.4rem] bg-[#05245c] px-8 py-5 text-base font-black text-white shadow-2xl shadow-[#05245c]/20 transition hover:-translate-y-0.5 hover:bg-[#031a43]"
            >
              Criar meu site agora
            </Link>

            <Link
              href="/login"
              className="rounded-[1.4rem] border border-[#d8e4f4] bg-white px-8 py-5 text-base font-black text-[#05245c] shadow-xl shadow-[#05245c]/5 transition hover:-translate-y-0.5 hover:border-[#05245c]"
            >
              Já tenho conta
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm font-black text-[#607895]">
            <span className="rounded-full bg-[#f2f7ff] px-4 py-2">Sem código</span>
            <span className="rounded-full bg-[#f2f7ff] px-4 py-2">Com domínio por empresa</span>
            <span className="rounded-full bg-[#f2f7ff] px-4 py-2">Feito para vender</span>
          </div>

          <div className="mt-14 w-full max-w-5xl rounded-[2rem] border border-[#d8e4f4] bg-white p-3 shadow-2xl shadow-[#05245c]/10">
            <div className="rounded-[1.5rem] bg-[#f5f8ff] p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['graficaflash.orcaly.com.br', 'Site profissional da empresa'],
                  ['Pedido inteligente', 'Cliente envia tudo organizado'],
                  ['Proposta aprovada', 'Venda acompanhada no painel'],
                ].map(([titulo, texto]) => (
                  <div key={titulo} className="rounded-[1.25rem] border border-white bg-white p-5 text-left shadow-sm">
                    <p className="text-lg font-black text-[#071b3a]">{titulo}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#607895]">{texto}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e6edf8] bg-[#f8fbff] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 text-center md:grid-cols-3">
          {dores.map((dor) => (
            <article key={dor.titulo} className="rounded-[2rem] border border-[#e6edf8] bg-white p-7 shadow-xl shadow-[#05245c]/5">
              <h2 className="text-2xl font-black text-[#071b3a]">{dor.titulo}</h2>
              <p className="mt-3 font-semibold leading-7 text-[#607895]">{dor.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="solucao" className="bg-white px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">A solução</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Um sistema que transforma conversa bagunçada em venda organizada.
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solucoes.map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-[#e6edf8] bg-white p-6 text-center shadow-lg shadow-[#05245c]/5">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#05245c] text-lg font-black text-white">
                  ✓
                </div>
                <p className="font-black leading-6 text-[#071b3a]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="segmentos" className="bg-[#05245c] px-4 py-20 text-center text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#b9d6ff]">Para vários tipos de negócio</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] sm:text-6xl">
            Cada empresa recebe uma estrutura pensada para o que ela vende.
          </h2>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {segmentos.map((segmento) => (
              <span key={segmento} className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur">
                {segmento}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-white px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">Como funciona</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Do cadastro ao pedido, tudo com cara profissional.
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {passos.map((passo) => (
              <article key={passo.numero} className="rounded-[2rem] border border-[#e6edf8] bg-[#f8fbff] p-8 text-center">
                <p className="text-5xl font-black text-[#05245c]">{passo.numero}</p>
                <h3 className="mt-5 text-2xl font-black text-[#071b3a]">{passo.titulo}</h3>
                <p className="mt-3 font-semibold leading-7 text-[#607895]">{passo.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8fbff] px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-[#d8e4f4] bg-white p-8 shadow-2xl shadow-[#05245c]/10 sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#05245c]">O que vem incluso</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Mais que um link. Uma estrutura comercial.
          </h2>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recursos.map((recurso) => (
              <div key={recurso} className="rounded-2xl bg-[#f2f7ff] px-4 py-4 text-sm font-black text-[#05245c]">
                {recurso}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <img src="/icone-orcaly.png" alt="Ícone Orçaly" className="mx-auto h-16 w-16 object-contain" />
          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.04em] text-[#061a36] sm:text-6xl">
            Dê à sua empresa uma presença digital que vende confiança.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-[#607895]">
            Comece com um site profissional, organize pedidos e envie propostas melhores. Sem depender de código, designer ou planilha remendada.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/cadastro" className="rounded-[1.4rem] bg-[#05245c] px-8 py-5 font-black text-white shadow-xl shadow-[#05245c]/20">
              Começar agora
            </Link>
            <Link href="/login" className="rounded-[1.4rem] border border-[#d8e4f4] bg-white px-8 py-5 font-black text-[#05245c]">
              Entrar na minha conta
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e6edf8] bg-white px-4 py-8 text-center">
        <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-10 w-auto object-contain" />
        <p className="mt-4 text-sm font-bold text-[#607895]">
          Orçaly, presença digital, pedidos e propostas para empresas que querem vender melhor.
        </p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d8e4f4] bg-white/95 p-3 shadow-2xl shadow-[#05245c]/15 backdrop-blur sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/login" className="rounded-2xl border border-[#d8e4f4] bg-white px-4 py-3 text-center text-sm font-black text-[#05245c]">
            Entrar
          </Link>
          <Link href="/cadastro" className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white">
            Começar
          </Link>
        </div>
      </div>
    </main>
  )
}
