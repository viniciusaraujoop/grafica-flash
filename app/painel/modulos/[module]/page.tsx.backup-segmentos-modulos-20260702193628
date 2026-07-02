import Link from 'next/link'
import { getPanelModuleById, getModuleHref, knownExistingPanelRoutes } from '@/lib/panel-modules'

type PageProps = {
  params: Promise<{ module: string }>
}

const fallbackDescriptions: Record<string, { title: string; description: string; primaryHref?: string; primaryLabel?: string }> = {
  artes: {
    title: 'Artes recebidas',
    description: 'Este módulo faz parte do Orçaly Gráfica. Aqui você poderá gerenciar arquivos enviados pelos clientes, aprovar artes, solicitar correções e acompanhar o vínculo com os orçamentos.',
    primaryHref: '/painel/orcamento-inteligente',
    primaryLabel: 'Ir para orçamentos',
  },
  'aprovacao-arte': {
    title: 'Aprovação de arte',
    description: 'Acompanhe aprovações, reprovações, novas versões e observações internas antes de mandar pedidos para produção.',
    primaryHref: '/painel/producao',
    primaryLabel: 'Abrir produção',
  },
  'notas-fiscais': {
    title: 'Notas fiscais',
    description: 'Controle notas cadastradas manualmente, XML, PDF/DANFE, valor total, cliente, fornecedor, pedido vinculado e status. Não é emissão fiscal completa, é organização e leitura de documentos.',
    primaryHref: '/painel/financeiro',
    primaryLabel: 'Abrir financeiro',
  },
  'entradas-saidas': {
    title: 'Entradas e saídas',
    description: 'Registre receitas, despesas, contas a receber, contas a pagar e acompanhe o resultado da empresa com mais clareza.',
    primaryHref: '/painel/financeiro',
    primaryLabel: 'Abrir financeiro',
  },
  entregas: {
    title: 'Entregas',
    description: 'Organize pedidos em rota, retirada, taxa de entrega, regiões atendidas e status de entrega para operações Food e Loja.',
    primaryHref: '/painel/pedidos',
    primaryLabel: 'Ver pedidos',
  },
  agenda: {
    title: 'Agenda',
    description: 'Controle horários, serviços marcados, confirmações e atendimentos para beleza, barbearia e eventos.',
    primaryHref: '/painel/pedidos',
    primaryLabel: 'Ver agendamentos',
  },
  analises: {
    title: 'Análises',
    description: 'Receba fotos, defeitos, modelos, diagnóstico, aprovação e status técnico para assistência e oficina.',
    primaryHref: '/painel/pedidos',
    primaryLabel: 'Ver solicitações',
  },
  'ordens-servico': {
    title: 'Ordens de serviço',
    description: 'Controle equipamento, defeito, peças, diagnóstico, aprovação, reparo, teste final e retirada.',
    primaryHref: '/painel/producao',
    primaryLabel: 'Abrir operação',
  },
}

function prettify(value: string) {
  return value
    .replace(/_/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function PainelModuloPlaceholderPage({ params }: PageProps) {
  const { module } = await params
  const normalized = module.replace(/_/g, '-')
  const moduleConfig = getPanelModuleById(normalized)
  const fallback = fallbackDescriptions[normalized]

  const title = moduleConfig?.label || fallback?.title || prettify(normalized)
  const description = moduleConfig?.description || fallback?.description || 'Este módulo faz parte da expansão operacional do Orçaly. Ele será ativado em uma próxima etapa sem quebrar o painel atual.'
  const moduleHref = moduleConfig ? getModuleHref(moduleConfig, knownExistingPanelRoutes) : ''
  const canOpenRealModule = moduleHref && !moduleHref.includes('/painel/modulos/')

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2.3rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/10">
          <div className="relative overflow-hidden bg-[#05245c] p-8 text-white sm:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">Módulo do painel</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-6xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-blue-100">{description}</p>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <article className="rounded-[1.6rem] bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Status</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">Em preparação</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Sem 404, sem gambiarra jogando tudo para pedidos.</p>
            </article>
            <article className="rounded-[1.6rem] bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Dados</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">Preservados</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Este placeholder não cria tabela nem apaga nada.</p>
            </article>
            <article className="rounded-[1.6rem] bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Próximo passo</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">Usar módulo atual</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Enquanto isso, use os módulos já ativos do painel.</p>
            </article>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-blue-50 p-6 sm:p-8">
            <Link href="/painel" className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
              Voltar ao painel
            </Link>

            {canOpenRealModule ? (
              <Link href={moduleHref} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c]">
                Abrir módulo disponível
              </Link>
            ) : fallback?.primaryHref ? (
              <Link href={fallback.primaryHref} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c]">
                {fallback.primaryLabel || 'Abrir módulo relacionado'}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
