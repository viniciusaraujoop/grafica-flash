import Link from 'next/link'

const metrics = [
  {
    emoji: '💬',
    label: 'Clientes aguardando retorno',
    value: 0,
    description: 'Clientes que precisam de uma nova mensagem ou ligação.',
  },
  {
    emoji: '📄',
    label: 'Propostas sem resposta',
    value: 0,
    description: 'Propostas enviadas que ainda não tiveram retorno.',
  },
  {
    emoji: '⏰',
    label: 'Follow-ups vencidos hoje',
    value: 0,
    description: 'Retornos que precisam de atenção imediata.',
  },
  {
    emoji: '💰',
    label: 'Valor em oportunidades',
    value: 'R$ 0,00',
    description: 'Estimativa de oportunidades comerciais abertas.',
  },
]

const pipeline = [
  'Novo contato',
  'Aguardando resposta',
  'Retornar hoje',
  'Proposta enviada',
  'Negociação',
  'Ganhou',
  'Perdido',
]

const futureActions = [
  'Chamar cliente no WhatsApp',
  'Marcar como resolvido',
  'Agendar retorno',
  'Marcar como perdido',
  'Vincular proposta',
  'Vincular orçamento',
  'Vincular cliente',
]

export default function FollowUpPage() {
  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2.4rem] border border-blue-100 bg-white p-6 shadow-2xl shadow-blue-950/10 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/painel" className="text-sm font-black text-[#05245c]">
                ← Voltar ao painel
              </Link>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Comercial</p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-[1.4rem] bg-blue-50 text-3xl ring-1 ring-blue-100">💬</span>
                <h1 className="text-4xl font-black leading-[1.03] tracking-[-0.06em] sm:text-6xl">Follow-up Comercial</h1>
              </div>
              <p className="mt-4 max-w-3xl font-bold leading-8 text-slate-500">
                Acompanhe clientes, propostas e oportunidades que precisam de retorno para não deixar venda morrer no limbo do WhatsApp, esse cemitério elegante de oportunidades.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/painel/crm" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c]">
                Ver CRM
              </Link>
              <Link href="/painel/propostas" className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
                Ver propostas
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="mb-4 inline-flex rounded-2xl bg-blue-50 px-3 py-2 text-2xl ring-1 ring-blue-100">{metric.emoji}</div>
              <p className="text-sm font-black text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">{metric.value}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{metric.description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Pipeline comercial</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Oportunidades que precisam de retorno</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">MVP visual</span>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-blue-100">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 bg-[#f8fbff] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                <span>Cliente</span>
                <span>Origem</span>
                <span>Próxima ação</span>
                <span>Status</span>
              </div>
              <div className="p-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-2xl">💬</div>
                <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]">Nenhum follow-up pendente.</h3>
                <p className="mx-auto mt-3 max-w-2xl font-bold leading-7 text-slate-500">
                  Quando clientes, propostas ou orçamentos ficarem sem resposta, eles aparecerão aqui para você retomar o contato.
                </p>
                <Link href="/painel/crm" className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
                  Adicionar lembrete de follow-up
                </Link>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-xl font-black tracking-[-0.04em]">Status previstos</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {pipeline.map((item) => (
                  <span key={item} className="rounded-full border border-blue-100 bg-[#f8fbff] px-3 py-2 text-sm font-black text-[#05245c]">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-xl font-black tracking-[-0.04em]">Ações preparadas</h2>
              <div className="mt-4 grid gap-3">
                {futureActions.map((item) => (
                  <div key={item} className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4 font-bold leading-6 text-slate-600">
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}
