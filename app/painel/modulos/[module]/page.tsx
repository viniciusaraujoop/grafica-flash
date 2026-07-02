import Link from 'next/link'
import { getModuleById, getSafeModuleHref } from '@/lib/segment-modules'

type PageProps = {
  params: Promise<{ module: string }>
}

function statusLabel(status?: string) {
  if (status === 'active') return 'Disponível'
  if (status === 'beta') return 'Beta'
  if (status === 'coming_soon') return 'Em preparação'
  return 'Em breve'
}

function fallbackModule(moduleId: string) {
  const label = moduleId
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

  return {
    id: moduleId,
    label,
    description: 'Este módulo está sendo preparado para o painel do Orçaly.',
    status: 'coming_soon',
    futureActions: [
      'Organizar informações do módulo',
      'Vincular dados da empresa',
      'Evitar perda de histórico',
      'Acompanhar status no painel',
    ],
    relatedHref: '/painel',
  }
}

export default async function ModuloSegmentoPlaceholderPage({ params }: PageProps) {
  const { module } = await params
  const found = getModuleById(module)
  const data = found || fallbackModule(module)

  const relatedHref = found?.relatedHref || (found ? getSafeModuleHref(found) : '/painel')
  const futureActions = found?.futureActions?.length
    ? found.futureActions
    : [
      'Centralizar dados do módulo',
      'Vincular pedidos, clientes ou lançamentos',
      'Acompanhar status',
      'Gerar uma visão mais organizada da operação',
    ]

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2.3rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/10">
          <div className="bg-[#05245c] px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/50">Módulo do painel</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-5xl">{data.label}</h1>
            <p className="mt-4 max-w-3xl font-bold leading-8 text-blue-100">{data.description}</p>

            <span className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-black">
              Status: {statusLabel(data.status)}
            </span>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px] sm:p-10">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em]">O que este módulo permitirá fazer</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {futureActions.map((item) => (
                  <div key={item} className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4 font-bold text-slate-600">
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.7rem] bg-[#f8fbff] p-5">
              <p className="text-sm font-black text-[#05245c]">Enquanto isso</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                Use os módulos disponíveis do painel. O Orçaly não joga você em um 404 nem manda tudo para pedidos fingindo que está tudo bem.
              </p>

              <div className="mt-5 grid gap-2">
                <Link href="/painel" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                  Voltar ao painel
                </Link>
                <Link href={relatedHref} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">
                  Ir para módulo relacionado
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
