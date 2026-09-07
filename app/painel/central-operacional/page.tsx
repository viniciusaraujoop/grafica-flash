'use client'

import { useState } from 'react'
import Link from 'next/link'
import TodayOperationsCenter from '@/components/painel/TodayOperationsCenter'

type Tab = 'today' | 'operation' | 'sales' | 'pending' | 'tools'

const tabs: Array<{ id: Tab; label: string; description: string }> = [
  { id: 'today', label: 'Hoje', description: 'O que precisa de atenção agora.' },
  { id: 'operation', label: 'Operação', description: 'Pedidos, produção, entregas e execução.' },
  { id: 'sales', label: 'Comercial', description: 'CRM, propostas, clientes e follow-up.' },
  { id: 'pending', label: 'Pendências', description: 'Próximas ações e notificações.' },
  { id: 'tools', label: 'Ferramentas', description: 'Balcão, QR Code, recorrência, portal e IA.' },
]

const operationCards = [
  { title: 'Pedidos 2.0', description: 'Lista, Kanban, calendário, prazos e responsáveis.', href: '/painel/pedidos', action: 'Abrir pedidos' },
  { title: 'Produção / execução', description: 'Acompanhe o trabalho depois da aprovação comercial.', href: '/painel/producao', action: 'Ver produção' },
  { title: 'Entregas', description: 'Organize o que está pronto, em rota ou aguardando retirada.', href: '/painel/entregas', action: 'Ver entregas' },
  { title: 'Aprovação de arte', description: 'Pendências de cliente, revisão e aprovação em um único fluxo.', href: '/painel/aprovacao-arte', action: 'Ver aprovações' },
]

const salesCards = [
  { title: 'CRM 2.0', description: 'Leads, temperatura, próxima ação e negociação.', href: '/painel/crm', action: 'Abrir CRM' },
  { title: 'Propostas', description: 'Crie, envie e acompanhe propostas comerciais.', href: '/painel/propostas', action: 'Ver propostas' },
  { title: 'Follow-up', description: 'Retornos previstos e clientes sem resposta.', href: '/painel/follow-up', action: 'Ver follow-ups' },
  { title: 'Clientes', description: 'Histórico, relacionamento e novas oportunidades.', href: '/painel/clientes', action: 'Ver clientes' },
]

const pendingCards = [
  { title: 'Próximas ações', description: 'Tarefas conectadas a lead, pedido ou proposta.', href: '/painel/tarefas', action: 'Abrir tarefas' },
  { title: 'Notificações', description: 'Eventos importantes que pedem leitura ou resolução.', href: '/painel/notificacoes', action: 'Ver notificações' },
  { title: 'Follow-up vencido', description: 'Retome clientes e oportunidades antes que esfriem.', href: '/painel/follow-up', action: 'Resolver follow-up' },
  { title: 'Financeiro', description: 'Recebimentos, vencimentos e pendências de caixa.', href: '/painel/financeiro', action: 'Abrir financeiro' },
]

const toolCards = [
  { title: 'Modo balcão', description: 'Proposta rápida para atendimento presencial.', href: '/painel/central-operacional/ferramentas', tag: 'Ferramenta existente' },
  { title: 'QR Code', description: 'Conecte atendimento físico à vitrine e orçamento digital.', href: '/painel/central-operacional/ferramentas', tag: 'Ferramenta existente' },
  { title: 'Repetir pedido', description: 'Reutilize pedidos anteriores de clientes recorrentes.', href: '/painel/central-operacional/ferramentas', tag: 'Ferramenta existente' },
  { title: 'Área do cliente', description: 'Gere magic link do portal sem senha administrativa.', href: '/painel/central-operacional/ferramentas', tag: 'Ferramenta existente' },
  { title: 'IA de orçamento', description: 'Transforme a descrição livre do cliente em briefing estruturado.', href: '/painel/central-operacional/ferramentas', tag: 'Ferramenta existente' },
  { title: 'Modelos por nicho', description: 'Ajuste perguntas, categorias e status por tipo de negócio.', href: '/painel/central-operacional/ferramentas', tag: 'Ferramenta existente' },
]

export default function CentralOperacionalPage() {
  const [activeTab, setActiveTab] = useState<Tab>('today')

  return (
    <main className="grid gap-4 text-[#10233f]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,.055)] sm:p-6">
        <span className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#4776ad]">Central operacional</span>
        <h2 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">Do que aconteceu ao que precisa ser feito.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">A operação foi separada por contexto. Ferramentas continuam disponíveis, mas não competem mais com pedidos, clientes e pendências do dia.</p>

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Áreas da central operacional">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3.5 py-2.5 text-xs font-extrabold transition duration-200 ${activeTab === tab.id ? 'bg-white text-[#0b3b78] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-400">{tabs.find((tab) => tab.id === activeTab)?.description}</p>
      </section>

      <section role="tabpanel">
        {activeTab === 'today' ? <TodayOperationsCenter /> : null}
        {activeTab === 'operation' ? <CardGrid eyebrow="Operação" title="Execute sem perder contexto" cards={operationCards} /> : null}
        {activeTab === 'sales' ? <CardGrid eyebrow="Comercial" title="Da conversa ao fechamento" cards={salesCards} /> : null}
        {activeTab === 'pending' ? <CardGrid eyebrow="Pendências" title="Cada contador leva a uma ação" cards={pendingCards} /> : null}
        {activeTab === 'tools' ? (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,.05)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4776ad]">Ferramentas</span><h3 className="mt-1 text-xl font-bold tracking-[-.03em]">Recursos especializados, sem poluir a operação</h3></div>
              <Link href="/painel/central-operacional/ferramentas" className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-center text-xs font-bold text-white">Abrir central de ferramentas</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {toolCards.map((card) => <Link key={card.title} href={card.href} className="rounded-[1.15rem] border border-slate-200 p-4 transition duration-200 hover:-translate-y-px hover:border-blue-200 hover:shadow-md"><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-blue-600">{card.tag}</span><h4 className="mt-3 text-sm font-extrabold text-slate-800">{card.title}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{card.description}</p><span className="mt-3 block text-xs font-bold text-[#4776ad]">Abrir →</span></Link>)}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}

function CardGrid({ eyebrow, title, cards }: { eyebrow: string; title: string; cards: Array<{ title: string; description: string; href: string; action: string }> }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,.05)] sm:p-6">
      <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4776ad]">{eyebrow}</span>
      <h3 className="mt-1 text-xl font-bold tracking-[-.03em]">{title}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <Link key={card.title} href={card.href} className="group rounded-[1.15rem] border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-px hover:border-blue-200 hover:shadow-md motion-safe:animate-[orcaly-hub-card_180ms_ease-out_both]" style={{ animationDelay: `${index * 35}ms` }}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-xs font-black text-[#174e93] group-hover:bg-blue-50" aria-hidden="true">{index + 1}</span>
            <h4 className="mt-3 text-sm font-extrabold text-slate-800">{card.title}</h4>
            <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{card.description}</p>
            <span className="mt-3 block text-xs font-bold text-[#4776ad]">{card.action} →</span>
          </Link>
        ))}
      </div>
      <style jsx global>{`@keyframes orcaly-hub-card { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:none } } @media (prefers-reduced-motion: reduce) { [class*='orcaly-hub-card'] { animation:none !important } }`}</style>
    </section>
  )
}
