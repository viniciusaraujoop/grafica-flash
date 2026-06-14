import Link from 'next/link'

const servicos = [
  'Banner em lona',
  'Furadinho',
  'Adesivo',
  'Cartão de visita',
  'Faixa',
  'Placa PVC',
  'Plotagem',
  'Panfletos',
]

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-3 text-sm font-bold text-orange-400">
          Gráfica Flash
        </p>

        <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
          Orçamento rápido para banners, adesivos, furadinhos e materiais gráficos.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-neutral-300">
          Solicite seu material gráfico informando medidas, quantidade e detalhes.
          A gráfica recebe tudo organizado em um painel interno.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/orcamento"
            className="rounded-xl bg-orange-400 px-6 py-3 text-center font-bold text-neutral-950"
          >
            Pedir orçamento
          </Link>

          <Link
            href="/painel"
            className="rounded-xl border border-neutral-700 px-6 py-3 text-center font-bold"
          >
            Ver painel da gráfica
          </Link>
        </div>

        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">Serviços disponíveis</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {servicos.map((servico) => (
              <div
                key={servico}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
              >
                <h3 className="font-bold">{servico}</h3>
                <p className="mt-2 text-sm text-neutral-400">
                  Informe medida, quantidade e observações para receber orçamento.
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}