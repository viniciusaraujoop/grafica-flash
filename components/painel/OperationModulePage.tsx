import PanelModuleShell, { PanelEmptyState } from '@/components/painel/PanelModuleShell'
import type { OperationPageDefinition } from '@/lib/operation-pages'

export default function OperationModulePage({ definition }: { definition: OperationPageDefinition }) {
  return (
    <PanelModuleShell
      eyebrow={definition.eyebrow}
      title={definition.title}
      description={definition.description}
      status={definition.status}
      metrics={definition.metrics}
      actions={definition.actions}
    >
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          {definition.sections.map((section) => (
            <article key={section.title} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">{section.title}</p>
              <h2 className="mt-1 text-2xl font-black text-[#071b3a]">{section.description}</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {section.items.map((item) => (
                  <div key={item} className="rounded-2xl bg-[#f5f8ff] p-4 font-bold text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="grid content-start gap-5">
          <PanelEmptyState
            title={definition.emptyTitle}
            description={definition.emptyDescription}
            actionLabel={definition.emptyActionLabel}
            actionHref={definition.emptyActionHref}
          />

          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Integração</p>
            <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Financeiro + operação</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
              Este módulo fica preparado para vincular clientes, pedidos, propostas e lançamentos financeiros sem automatizar nada perigoso agora.
            </p>
          </section>
        </aside>
      </section>
    </PanelModuleShell>
  )
}
