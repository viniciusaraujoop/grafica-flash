import Link from 'next/link'
import { getModuleById, getSafeModuleHref, type PanelModule } from '@/lib/panel-modules'
import { getUpgradeMessage } from '@/lib/plan-limits'

type PanelPlaceholderPageProps = {
  moduleId: string
}

type SafePanelModule = Pick<
  PanelModule,
  'id' | 'emoji' | 'label' | 'description' | 'status' | 'requiredPlan' | 'href' | 'fallbackHref' | 'relatedHref' | 'futureActions' | 'group'
>

function fallbackLabel(moduleId: string) {
  return moduleId
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function statusLabel(status?: SafePanelModule['status']) {
  if (status === 'active') return 'Disponível'
  if (status === 'beta') return 'Beta'
  if (status === 'coming_soon') return 'Em preparação'

  return 'Em breve'
}

function groupLabel(group?: SafePanelModule['group']) {
  if (group === 'financeiro') return 'Financeiro'
  if (group === 'comercial') return 'Comercial'
  if (group === 'presenca_digital') return 'Presença digital'
  if (group === 'operacao') return 'Operação por segmento'
  if (group === 'sistema') return 'Sistema'
  if (group === 'relatorios') return 'Relatórios'

  return 'Painel'
}

function fallbackActions(label: string) {
  return [
    `Organizar ${label.toLowerCase()} no painel`,
    'Vincular clientes, pedidos ou propostas',
    'Acompanhar status e histórico',
    'Manter o fluxo no mesmo padrão visual do Orçaly',
  ]
}

export default function PanelPlaceholderPage({ moduleId }: PanelPlaceholderPageProps) {
  const found = getModuleById(moduleId) as SafePanelModule | undefined

  const title = found?.label || fallbackLabel(moduleId)
  const emoji = found?.emoji || '🧩'
  const description = found?.description || 'Este módulo está preparado para entrar no painel do Orçaly sem criar rota quebrada nem jogar tudo em pedidos.'
  const status = statusLabel(found?.status)
  const planMessage = getUpgradeMessage(found?.requiredPlan)
  const relatedHref = found?.relatedHref || found?.fallbackHref || (found ? getSafeModuleHref(found) : '/painel')
  const actions = found?.futureActions?.length ? found.futureActions : fallbackActions(title)

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2.4rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/10">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] lg:items-end sm:p-8">
            <div>
              <Link href="/painel" className="text-sm font-black text-[#05245c]">
                ← Voltar ao painel
              </Link>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">
                {groupLabel(found?.group)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-[1.4rem] bg-blue-50 text-3xl ring-1 ring-blue-100">
                  {emoji}
                </span>
                <h1 className="max-w-4xl text-4xl font-black leading-[1.03] tracking-[-0.06em] sm:text-6xl">
                  {title}
                </h1>
              </div>

              <p className="mt-4 max-w-3xl font-bold leading-8 text-slate-500">
                {description}
              </p>
            </div>

            <aside className="rounded-[1.7rem] bg-[#05245c] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Status</p>
              <p className="mt-2 text-2xl font-black">{status}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-white/65">{planMessage}</p>
            </aside>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Rota segura</p>
            <p className="mt-2 text-2xl font-black">Sem 404</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">O módulo tem uma tela pronta mesmo antes da função completa.</p>
          </div>

          <div className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Visual</p>
            <p className="mt-2 text-2xl font-black">Preservado</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Segue o padrão aprovado do painel, sem layout paralelo.</p>
          </div>

          <div className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plano</p>
            <p className="mt-2 text-2xl font-black">{found?.requiredPlan ? 'Controlado' : 'Global'}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{planMessage}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">O que este módulo permitirá fazer</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {actions.map((item) => (
                <div key={item} className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4 font-bold leading-6 text-slate-600">
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-xl font-black tracking-[-0.04em]">Ações</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              Essa tela evita link quebrado e mantém a navegação organizada até o módulo virar função completa.
            </p>

            <div className="mt-5 grid gap-2">
              <Link href="/painel" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">
                Voltar ao painel
              </Link>

              {relatedHref !== `/painel/${moduleId}` ? (
                <Link href={relatedHref} className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                  Módulo relacionado
                </Link>
              ) : null}

              <Link href="/assinatura" className="rounded-2xl bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">
                Ver assinatura
              </Link>
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}
