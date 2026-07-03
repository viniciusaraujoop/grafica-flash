import PanelModuleShell, { PanelEmptyState } from '@/components/painel/PanelModuleShell'

const futureActions = [
  "Pedidos por período",
  "Receita estimada",
  "Produtos mais pedidos",
  "Clientes recorrentes",
  "Orçamentos em aberto",
  "Taxa de aprovação"
]

export default function Page() {
  return (
    <PanelModuleShell
      eyebrow="Relatórios"
      title="Relatórios"
      description="Acompanhe pedidos por período, receita estimada, produtos mais pedidos, clientes recorrentes e oportunidades abertas."
      status="Em preparação"
      actions={[
        { label: 'Voltar ao painel', href: '/painel' },
        { label: 'Módulo relacionado', href: "/painel/auditoria", primary: true },
      ]}
      metrics={[
        { label: 'Status', value: 'Em preparação', description: 'Estrutura pronta para evolução segura.' },
        { label: 'Visual', value: 'Preservado', description: 'Segue o padrão atual aprovado do painel.' },
        { label: 'Banco', value: 'Sem alteração', description: 'Não cria tabela nem policy neste pacote.' },
      ]}
    >
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Recursos previstos</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {futureActions.map((item) => (
              <div key={item} className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4 font-bold leading-6 text-slate-600">
                ✓ {item}
              </div>
            ))}
          </div>
        </div>

        <PanelEmptyState
          title="Módulo preparado, sem quebrar nada"
          description="Esta tela mantém o visual atual do painel e deixa o caminho pronto para a próxima fase, sem alterar login, assinatura, banco ou rotas críticas."
          actionLabel="Voltar ao painel"
          actionHref="/painel"
        />
      </section>
    </PanelModuleShell>
  )
}
