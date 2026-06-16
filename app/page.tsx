import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbff] text-slate-950">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#f7fbff] to-blue-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-180px] top-[-180px] h-[460px] w-[460px] rounded-full bg-blue-200/60 blur-3xl" />
          <div className="absolute right-[-180px] top-[120px] h-[420px] w-[420px] rounded-full bg-cyan-200/50 blur-3xl" />
          <div className="absolute bottom-[-200px] left-[35%] h-[480px] w-[480px] rounded-full bg-orange-100/70 blur-3xl" />
        </div>

        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center rounded-3xl border border-blue-100 bg-white px-4 py-3 shadow-lg shadow-blue-950/5"
          >
            <img
              src="/logo-orcaly.png"
              alt="Orcaly"
              className="h-11 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-black text-slate-600 md:flex">
            <a href="#beneficios" className="transition hover:text-[#05245c]">
              Benef&iacute;cios
            </a>
            <a href="#planos" className="transition hover:text-[#05245c]">
              Planos
            </a>
            <Link href="/login" className="transition hover:text-[#05245c]">
              Entrar
            </Link>
          </nav>

          <Link
            href="/cadastro?plano=profissional"
            className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-[#031a43]"
          >
            Come&ccedil;ar agora
          </Link>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-28 lg:pt-16">
          <div>
            <div className="inline-flex rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5">
              Sistema completo para empresas que querem vender com mais organiza&ccedil;&atilde;o
            </div>

            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-[#071b3a] sm:text-6xl lg:text-7xl">
              Pare de perder cliente no WhatsApp bagun&ccedil;ado.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              O Or&ccedil;aly transforma pedidos, or&ccedil;amentos, produtos e clientes em um painel claro,
              bonito e pronto para sua empresa vender melhor todos os dias.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cadastro?plano=profissional"
                className="rounded-2xl bg-[#05245c] px-7 py-4 text-center font-black text-white shadow-xl shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43]"
              >
                Quero organizar minha empresa
              </Link>

              <a
                href="#planos"
                className="rounded-2xl border border-blue-100 bg-white px-7 py-4 text-center font-black text-[#05245c] shadow-sm shadow-blue-950/5 transition hover:bg-blue-50"
              >
                Ver planos
              </a>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-3xl font-black text-[#071b3a]">24h</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Pedidos entrando mesmo fora do hor&aacute;rio
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-3xl font-black text-[#071b3a]">CRM</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Clientes e hist&oacute;rico em um s&oacute; lugar
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-3xl font-black text-[#071b3a]">Pix</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Pagamentos e planos integrados
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2.25rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/10">
              <div className="rounded-[1.75rem] bg-gradient-to-br from-blue-50 to-white p-5 text-slate-950">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
                      Vis&atilde;o do painel
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
                  <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-950/5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black text-[#071b3a]">Maria Oliveira</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          Total em pedidos: R$ 1.240,00
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">
                        Cliente fiel
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-950/5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black text-[#071b3a]">Anderson Silva</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          Total em pedidos: R$ 680,00
                        </p>
                      </div>
                      <span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">
                        N&atilde;o fechou
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-950/5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black text-[#071b3a]">Loja Central</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          Total em pedidos: R$ 2.890,00
                        </p>
                      </div>
                      <span className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700">
                        Inativo h&aacute; 30 dias
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-[#05245c] p-5 text-white shadow-xl shadow-blue-950/15">
                  <p className="text-sm font-bold text-blue-100">
                    O preju&iacute;zo invis&iacute;vel
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
              Venda com mem&oacute;ria comercial
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              O sistema lembra quem pediu, quem comprou, quem sumiu e quem merece uma abordagem.
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5">
            <p className="text-4xl">⚡</p>
            <h3 className="mt-5 text-2xl font-black text-[#071b3a]">
              Menos bagun&ccedil;a operacional
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              Produtos, pedidos, pagamentos e clientes saem do improviso e entram em um fluxo profissional.
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5">
            <p className="text-4xl">📈</p>
            <h3 className="mt-5 text-2xl font-black text-[#071b3a]">
              Atendimento com mais confian&ccedil;a
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              Organiza&ccedil;&atilde;o transmite profissionalismo desde o primeiro contato.
              O cliente entende melhor, confia mais e decide com menos atrito.
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
            Comece antes que outro concorrente pare&ccedil;a mais organizado que voc&ecirc;.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            O plano escolhido aqui ser&aacute; levado automaticamente para o cadastro.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="relative rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
            <h3 className="text-3xl font-black text-[#071b3a]">Essencial</h3>
            <p className="mt-2 leading-7 text-slate-600">
              Para come&ccedil;ar com uma estrutura profissional.
            </p>
            <div className="mt-6 flex items-end gap-1">
              <span className="text-5xl font-black text-[#071b3a]">R$ 49,90</span>
              <span className="pb-2 font-bold text-slate-500">/m&ecirc;s</span>
            </div>
            <ul className="mt-6 grid gap-3">
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>P&aacute;gina p&uacute;blica da empresa</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Or&ccedil;amentos online</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Cadastro de produtos</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Painel de pedidos</li>
            </ul>
            <Link href="/cadastro?plano=basico" className="mt-7 block rounded-2xl bg-blue-50 px-5 py-4 text-center font-black text-[#05245c] transition hover:bg-blue-100">
              Assinar Essencial
            </Link>
          </div>

          <div className="relative rounded-[2rem] border border-[#05245c] bg-white p-7 shadow-xl shadow-blue-950/5 ring-4 ring-blue-100 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#05245c] px-5 py-2 text-sm font-black text-white shadow-lg shadow-blue-950/20">
              Mais escolhido
            </div>
            <h3 className="text-3xl font-black text-[#071b3a]">Profissional</h3>
            <p className="mt-2 leading-7 text-slate-600">
              O plano mais indicado para vender com mais organiza&ccedil;&atilde;o.
            </p>
            <div className="mt-6 flex items-end gap-1">
              <span className="text-5xl font-black text-[#071b3a]">R$ 99,90</span>
              <span className="pb-2 font-bold text-slate-500">/m&ecirc;s</span>
            </div>
            <ul className="mt-6 grid gap-3">
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Tudo do Essencial</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Mini-CRM de clientes</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Hist&oacute;rico de pedidos</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Filtros comerciais</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Prioridade nas melhorias</li>
            </ul>
            <Link href="/cadastro?plano=profissional" className="mt-7 block rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white transition hover:bg-[#031a43]">
              Assinar Profissional
            </Link>
          </div>

          <div className="relative rounded-[2rem] border border-blue-100 bg-white p-7 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
            <h3 className="text-3xl font-black text-[#071b3a]">Premium</h3>
            <p className="mt-2 leading-7 text-slate-600">
              Para empresas que querem operar com mais controle.
            </p>
            <div className="mt-6 flex items-end gap-1">
              <span className="text-5xl font-black text-[#071b3a]">R$ 149,90</span>
              <span className="pb-2 font-bold text-slate-500">/m&ecirc;s</span>
            </div>
            <ul className="mt-6 grid gap-3">
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Tudo do Profissional</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Mais personaliza&ccedil;&atilde;o</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Acompanhamento avan&ccedil;ado</li>
              <li className="flex gap-3 text-sm font-bold leading-6 text-slate-600"><span className="text-emerald-600">✓</span>Recursos premium</li>
            </ul>
            <Link href="/cadastro?plano=premium" className="mt-7 block rounded-2xl bg-blue-50 px-5 py-4 text-center font-black text-[#05245c] transition hover:bg-blue-100">
              Assinar Premium
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
