'use client'

import Link from 'next/link'
import type { PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'

type ActionItem = {
  label: string
  description: string
  href: string
  code: string
}

const existingRoutes = new Set<string>([
  '/painel',
  '/painel/admin',
  '/painel/agenda',
  '/painel/analises',
  '/painel/aparelhos',
  '/painel/aprovacao-arte',
  '/painel/aprovacao-cliente',
  '/painel/artes',
  '/painel/assinatura',
  '/painel/assistente',
  '/painel/auditoria',
  '/painel/catalogo',
  '/painel/central-operacional',
  '/painel/checklist-evento',
  '/painel/clientes',
  '/painel/comissoes',
  '/painel/configuracoes',
  '/painel/configuracoes/equipe',
  '/painel/contas-pagar',
  '/painel/contas-receber',
  '/painel/contratos',
  '/painel/crm',
  '/painel/cupom',
  '/painel/cupons',
  '/painel/datas',
  '/painel/defeitos',
  '/painel/destaques',
  '/painel/diagnostico',
  '/painel/entradas-saidas',
  '/painel/entregas',
  '/painel/equipamentos',
  '/painel/equipe',
  '/painel/equipe-evento',
  '/painel/estoque',
  '/painel/eventos',
  '/painel/financeiro',
  '/painel/financeiro/contas-a-pagar',
  '/painel/financeiro/contas-a-receber',
  '/painel/financeiro/entradas',
  '/painel/financeiro/lancamentos',
  '/painel/financeiro/materiais',
  '/painel/financeiro/saidas',
  '/painel/follow-up',
  '/painel/formas-pagamento',
  '/painel/fotos',
  '/painel/garantias',
  '/painel/historico',
  '/painel/horarios',
  '/painel/itens-alugados',
  '/painel/lembretes',
  '/painel/manutencao',
  '/painel/mao-de-obra',
  '/painel/marketplace',
  '/painel/materiais',
  '/painel/mensagens',
  '/painel/modulo/assinatura',
  '/painel/modulos/[module]',
  '/painel/notas-fiscais',
  '/painel/notificacoes',
  '/painel/notificacoes/inteligentes',
  '/painel/onboarding',
  '/painel/oportunidades',
  '/painel/orcamento/[id]',
  '/painel/orcamento-inteligente',
  '/painel/orcamento-tecnico',
  '/painel/ordens-servico',
  '/painel/pacotes',
  '/painel/pagamentos',
  '/painel/pagamentos/configuracao',
  '/painel/pagamentos/vendas',
  '/painel/pecas',
  '/painel/pedidos',
  '/painel/pedidos/[id]',
  '/painel/prazos',
  '/painel/producao',
  '/painel/produtos',
  '/painel/produtos/[id]',
  '/painel/produtos/ia',
  '/painel/profissionais',
  '/painel/promocoes',
  '/painel/proposta/[id]',
  '/painel/propostas',
  '/painel/relatorios',
  '/painel/revisoes',
  '/painel/segmento',
  '/painel/segmentos',
  '/painel/setup',
  '/painel/sinal-pagamento',
  '/painel/site',
  '/painel/solicitacoes',
  '/painel/tarefas',
  '/painel/taxas-entrega',
  '/painel/veiculos',
  '/painel/whatsapp',
])

const segmentContent: Record<string, {
  label: string
  title: string
  description: string
  actions: ActionItem[]
}> = {
  food: {
    label: 'Food',
    title: 'Operacao de pedidos e entregas',
    description: 'Acesse rapidamente cardapio, pedidos, entregas, regioes e horarios de atendimento.',
    actions: [
      { label: 'Ver pedidos', description: 'Acompanhe pedidos e status.', href: '/painel/pedidos', code: 'PD' },
      { label: 'Editar catalogo', description: 'Organize cardapio e disponibilidade.', href: '/painel/catalogo', code: 'CT' },
      { label: 'Ver entregas', description: 'Monitore a operacao de entrega.', href: '/painel/entregas', code: 'EN' },
      { label: 'Configurar horarios', description: 'Defina quando a empresa atende.', href: '/painel/horarios', code: 'HR' },
    ],
  },
  graphic: {
    label: 'Grafica',
    title: 'Orcamentos, artes e producao',
    description: 'Centralize produtos, propostas, aprovacoes e etapas de producao.',
    actions: [
      { label: 'Novo produto', description: 'Cadastre produtos e servicos.', href: '/painel/produtos', code: 'PR' },
      { label: 'Ver propostas', description: 'Acompanhe propostas comerciais.', href: '/painel/propostas', code: 'PP' },
      { label: 'Ver artes', description: 'Organize arquivos e aprovacoes.', href: '/painel/artes', code: 'AR' },
      { label: 'Acompanhar producao', description: 'Veja trabalhos em andamento.', href: '/painel/producao', code: 'PO' },
    ],
  },
  auto: {
    label: 'Auto e oficina',
    title: 'Ordens, veiculos e manutencao',
    description: 'Acesse ordens de servico, diagnosticos, pecas e andamento da oficina.',
    actions: [
      { label: 'Ordens de servico', description: 'Acompanhe os servicos abertos.', href: '/painel/ordens-servico', code: 'OS' },
      { label: 'Veiculos', description: 'Consulte veiculos cadastrados.', href: '/painel/veiculos', code: 'VE' },
      { label: 'Diagnosticos', description: 'Organize avaliacao e aprovacao.', href: '/painel/diagnostico', code: 'DG' },
      { label: 'Pecas', description: 'Acompanhe itens e materiais.', href: '/painel/pecas', code: 'PC' },
    ],
  },
  assistance: {
    label: 'Assistencia tecnica',
    title: 'Aparelhos, diagnosticos e manutencao',
    description: 'Organize aparelhos recebidos, defeitos, aprovacoes e entrega ao cliente.',
    actions: [
      { label: 'Aparelhos', description: 'Consulte os equipamentos recebidos.', href: '/painel/aparelhos', code: 'AP' },
      { label: 'Diagnosticos', description: 'Acompanhe avaliacao tecnica.', href: '/painel/diagnostico', code: 'DG' },
      { label: 'Manutencao', description: 'Veja trabalhos em andamento.', href: '/painel/manutencao', code: 'MT' },
      { label: 'Garantias', description: 'Consulte garantias e retornos.', href: '/painel/garantias', code: 'GT' },
    ],
  },
  beauty: {
    label: 'Beauty e barbearia',
    title: 'Agenda, profissionais e servicos',
    description: 'Acesse agenda, equipe, servicos e relacionamento com clientes.',
    actions: [
      { label: 'Ver agenda', description: 'Acompanhe os horarios do dia.', href: '/painel/agenda', code: 'AG' },
      { label: 'Profissionais', description: 'Gerencie a equipe de atendimento.', href: '/painel/profissionais', code: 'PF' },
      { label: 'Produtos e servicos', description: 'Organize os itens oferecidos.', href: '/painel/produtos', code: 'SV' },
      { label: 'Clientes', description: 'Consulte historico e contatos.', href: '/painel/clientes', code: 'CL' },
    ],
  },
  events: {
    label: 'Eventos',
    title: 'Datas, contratos e execucao',
    description: 'Organize eventos futuros, pacotes, contratos, equipe e checklist.',
    actions: [
      { label: 'Proximos eventos', description: 'Consulte eventos e datas.', href: '/painel/eventos', code: 'EV' },
      { label: 'Contratos', description: 'Acompanhe documentos e acordos.', href: '/painel/contratos', code: 'CO' },
      { label: 'Pacotes', description: 'Organize ofertas e servicos.', href: '/painel/pacotes', code: 'PA' },
      { label: 'Checklist', description: 'Controle a preparacao do evento.', href: '/painel/checklist-evento', code: 'CK' },
    ],
  },
  store: {
    label: 'Loja e comercio',
    title: 'Produtos, estoque e vendas',
    description: 'Acesse rapidamente produtos, pedidos, estoque e catalogo digital.',
    actions: [
      { label: 'Produtos', description: 'Gerencie o que esta a venda.', href: '/painel/produtos', code: 'PR' },
      { label: 'Pedidos', description: 'Acompanhe compras e status.', href: '/painel/pedidos', code: 'PD' },
      { label: 'Estoque', description: 'Consulte disponibilidade.', href: '/painel/estoque', code: 'ES' },
      { label: 'Catalogo', description: 'Veja a vitrine comercial.', href: '/painel/catalogo', code: 'CT' },
    ],
  },
  services: {
    label: 'Servicos',
    title: 'Solicitacoes, propostas e acompanhamento',
    description: 'Organize demandas, propostas, prazos e relacionamento com clientes.',
    actions: [
      { label: 'Solicitacoes', description: 'Veja novas demandas.', href: '/painel/solicitacoes', code: 'SO' },
      { label: 'Propostas', description: 'Acompanhe negociacoes.', href: '/painel/propostas', code: 'PP' },
      { label: 'Tarefas', description: 'Organize o trabalho em andamento.', href: '/painel/tarefas', code: 'TF' },
      { label: 'Clientes', description: 'Consulte contatos e historico.', href: '/painel/clientes', code: 'CL' },
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

export default function PanelAdaptiveOverview({
  company,
}: {
  company: PanelPremiumCompany
}) {
  const segmentKey = normalizeSegment(company.business_type || company.site_template)
  const content = segmentContent[segmentKey] || segmentContent.services
  const actions = content.actions.filter((action) => existingRoutes.has(action.href)).slice(0, 4)

  if (!actions.length) return null

  return (
    <section className="panel-adaptive-overview" aria-labelledby="panel-adaptive-overview-title">
      <div className="panel-adaptive-overview-copy">
        <span>{content.label}</span>
        <h2 id="panel-adaptive-overview-title">{content.title}</h2>
        <p>{content.description}</p>
      </div>

      <div className="panel-adaptive-actions" aria-label="Acoes rapidas da operacao">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="panel-adaptive-action-card">
            <span className="panel-adaptive-action-code" aria-hidden="true">{action.code}</span>
            <span className="min-w-0">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            <span className="panel-adaptive-action-arrow" aria-hidden="true">&#8594;</span>
          </Link>
        ))}
      </div>
    </section>
  )
}