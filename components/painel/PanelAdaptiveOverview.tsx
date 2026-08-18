'use client'

import Link from 'next/link'
import type { PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'
import styles from './PanelOverviewV2.module.css'

type ActionItem = {
  label: string
  description: string
  href: string
  code: string
}

const existingRoutes = new Set<string>([
  '/painel', '/painel/admin', '/painel/agenda', '/painel/analises', '/painel/aparelhos', '/painel/aprovacao-arte',
  '/painel/aprovacao-cliente', '/painel/artes', '/painel/assinatura', '/painel/assistente', '/painel/auditoria',
  '/painel/catalogo', '/painel/central-operacional', '/painel/checklist-evento', '/painel/clientes', '/painel/comissoes',
  '/painel/configuracoes', '/painel/configuracoes/equipe', '/painel/contas-pagar', '/painel/contas-receber', '/painel/contratos',
  '/painel/crm', '/painel/cupom', '/painel/cupons', '/painel/datas', '/painel/defeitos', '/painel/destaques', '/painel/diagnostico',
  '/painel/entradas-saidas', '/painel/entregas', '/painel/equipamentos', '/painel/equipe', '/painel/equipe-evento', '/painel/estoque',
  '/painel/eventos', '/painel/financeiro', '/painel/financeiro/contas-a-pagar', '/painel/financeiro/contas-a-receber',
  '/painel/financeiro/entradas', '/painel/financeiro/lancamentos', '/painel/financeiro/materiais', '/painel/financeiro/saidas',
  '/painel/follow-up', '/painel/formas-pagamento', '/painel/fotos', '/painel/garantias', '/painel/historico', '/painel/horarios',
  '/painel/itens-alugados', '/painel/lembretes', '/painel/manutencao', '/painel/mao-de-obra', '/painel/marketplace', '/painel/materiais',
  '/painel/mensagens', '/painel/modulo/assinatura', '/painel/modulos/[module]', '/painel/notas-fiscais', '/painel/notificacoes',
  '/painel/notificacoes/inteligentes', '/painel/onboarding', '/painel/oportunidades', '/painel/orcamento/[id]', '/painel/orcamento-inteligente',
  '/painel/orcamento-tecnico', '/painel/ordens-servico', '/painel/pacotes', '/painel/pagamentos', '/painel/pagamentos/configuracao',
  '/painel/pagamentos/vendas', '/painel/pecas', '/painel/pedidos', '/painel/pedidos/[id]', '/painel/prazos', '/painel/producao',
  '/painel/produtos', '/painel/produtos/[id]', '/painel/produtos/ia', '/painel/profissionais', '/painel/promocoes', '/painel/proposta/[id]',
  '/painel/propostas', '/painel/relatorios', '/painel/revisoes', '/painel/segmento', '/painel/segmentos', '/painel/setup',
  '/painel/sinal-pagamento', '/painel/site', '/painel/solicitacoes', '/painel/tarefas', '/painel/taxas-entrega', '/painel/veiculos', '/painel/whatsapp',
])

const segmentContent: Record<string, { label: string; title: string; description: string; actions: ActionItem[] }> = {
  food: {
    label: 'Food', title: 'Pedidos e entregas', description: 'Acessos essenciais da operação de hoje.',
    actions: [
      { label: 'Ver pedidos', description: 'Pedidos e status.', href: '/painel/pedidos', code: 'PD' },
      { label: 'Editar catálogo', description: 'Cardápio e disponibilidade.', href: '/painel/catalogo', code: 'CT' },
      { label: 'Ver entregas', description: 'Operação de entrega.', href: '/painel/entregas', code: 'EN' },
      { label: 'Horários', description: 'Quando a empresa atende.', href: '/painel/horarios', code: 'HR' },
    ],
  },
  graphic: {
    label: 'Gráfica', title: 'Orçamentos e produção', description: 'Atalhos do fluxo comercial e produtivo.',
    actions: [
      { label: 'Novo produto', description: 'Produtos e serviços.', href: '/painel/produtos', code: 'PR' },
      { label: 'Propostas', description: 'Negociações comerciais.', href: '/painel/propostas', code: 'PP' },
      { label: 'Artes', description: 'Arquivos e aprovações.', href: '/painel/artes', code: 'AR' },
      { label: 'Produção', description: 'Trabalhos em andamento.', href: '/painel/producao', code: 'PO' },
    ],
  },
  auto: {
    label: 'Auto e oficina', title: 'Ordens e manutenção', description: 'Atalhos centrais da rotina da oficina.',
    actions: [
      { label: 'Ordens', description: 'Serviços abertos.', href: '/painel/ordens-servico', code: 'OS' },
      { label: 'Veículos', description: 'Veículos cadastrados.', href: '/painel/veiculos', code: 'VE' },
      { label: 'Diagnósticos', description: 'Avaliação e aprovação.', href: '/painel/diagnostico', code: 'DG' },
      { label: 'Peças', description: 'Itens e materiais.', href: '/painel/pecas', code: 'PC' },
    ],
  },
  assistance: {
    label: 'Assistência técnica', title: 'Aparelhos e manutenção', description: 'Atalhos do atendimento técnico.',
    actions: [
      { label: 'Aparelhos', description: 'Equipamentos recebidos.', href: '/painel/aparelhos', code: 'AP' },
      { label: 'Diagnósticos', description: 'Avaliação técnica.', href: '/painel/diagnostico', code: 'DG' },
      { label: 'Manutenção', description: 'Trabalhos em andamento.', href: '/painel/manutencao', code: 'MT' },
      { label: 'Garantias', description: 'Garantias e retornos.', href: '/painel/garantias', code: 'GT' },
    ],
  },
  beauty: {
    label: 'Beauty e barbearia', title: 'Agenda e atendimento', description: 'Atalhos para a rotina de atendimento.',
    actions: [
      { label: 'Agenda', description: 'Horários do dia.', href: '/painel/agenda', code: 'AG' },
      { label: 'Profissionais', description: 'Equipe de atendimento.', href: '/painel/profissionais', code: 'PF' },
      { label: 'Serviços', description: 'Itens oferecidos.', href: '/painel/produtos', code: 'SV' },
      { label: 'Clientes', description: 'Histórico e contatos.', href: '/painel/clientes', code: 'CL' },
    ],
  },
  events: {
    label: 'Eventos', title: 'Eventos e execução', description: 'Atalhos para preparar e acompanhar eventos.',
    actions: [
      { label: 'Eventos', description: 'Eventos e datas.', href: '/painel/eventos', code: 'EV' },
      { label: 'Contratos', description: 'Documentos e acordos.', href: '/painel/contratos', code: 'CO' },
      { label: 'Pacotes', description: 'Ofertas e serviços.', href: '/painel/pacotes', code: 'PA' },
      { label: 'Checklist', description: 'Preparação do evento.', href: '/painel/checklist-evento', code: 'CK' },
    ],
  },
  store: {
    label: 'Loja e comércio', title: 'Produtos e vendas', description: 'Atalhos para estoque, pedidos e catálogo.',
    actions: [
      { label: 'Produtos', description: 'Itens à venda.', href: '/painel/produtos', code: 'PR' },
      { label: 'Pedidos', description: 'Compras e status.', href: '/painel/pedidos', code: 'PD' },
      { label: 'Estoque', description: 'Disponibilidade.', href: '/painel/estoque', code: 'ES' },
      { label: 'Catálogo', description: 'Vitrine comercial.', href: '/painel/catalogo', code: 'CT' },
    ],
  },
  services: {
    label: 'Serviços', title: 'Comercial e execução', description: 'Atalhos para demandas, propostas e clientes.',
    actions: [
      { label: 'Solicitações', description: 'Novas demandas.', href: '/painel/solicitacoes', code: 'SO' },
      { label: 'Propostas', description: 'Negociações.', href: '/painel/propostas', code: 'PP' },
      { label: 'Tarefas', description: 'Trabalho em andamento.', href: '/painel/tarefas', code: 'TF' },
      { label: 'Clientes', description: 'Contatos e histórico.', href: '/painel/clientes', code: 'CL' },
    ],
  },
}

function normalizeSegment(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['food', 'restaurante', 'lanchonete', 'delivery', 'alimenticio'].includes(normalized)) return 'food'
  if (['graphic', 'grafica', 'custom_products', 'personalizados'].includes(normalized)) return 'graphic'
  if (['auto', 'oficina', 'automotive', 'automotivo'].includes(normalized)) return 'auto'
  if (['technical_assistance', 'assistencia', 'assistencia_tecnica'].includes(normalized)) return 'assistance'
  if (['beauty', 'barber', 'barbearia', 'beleza', 'estetica'].includes(normalized)) return 'beauty'
  if (['events', 'eventos'].includes(normalized)) return 'events'
  if (['store', 'loja', 'retail', 'comercio'].includes(normalized)) return 'store'
  return 'services'
}

export default function PanelAdaptiveOverview({ company }: { company: PanelPremiumCompany }) {
  const segmentKey = normalizeSegment(company.business_type || company.site_template)
  const content = segmentContent[segmentKey] || segmentContent.services
  const actions = content.actions.filter((action) => existingRoutes.has(action.href)).slice(0, 4)
  if (!actions.length) return null

  return (
    <section className={styles.overviewStrip} aria-labelledby="panel-adaptive-overview-title">
      <div className={styles.overviewCopy}>
        <span className={styles.overviewEyebrow}>{content.label}</span>
        <div className="min-w-0">
          <h2 id="panel-adaptive-overview-title" className={styles.overviewTitle}>{content.title}</h2>
          <p className={styles.overviewDescription}>{content.description}</p>
        </div>
      </div>

      <div className={styles.overviewActions} aria-label="Ações rápidas da operação">
        {actions.map((action, index) => (
          <Link key={action.href} href={action.href} className={styles.overviewAction} style={{ animationDelay: `${80 + index * 45}ms` }}>
            <span className={styles.overviewCode} aria-hidden="true">{action.code}</span>
            <span className="min-w-0 flex-1">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            <span className={styles.overviewArrow} aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
