import { normalizeBusinessType, type BusinessType } from '@/lib/business-types'

export type AttentionPriority = 'critical' | 'high' | 'normal' | 'info'
export type OrderWorkflowStage = {
  id: string
  label: string
  aliases: string[]
  terminal?: boolean
}

export type SmartNavGroup = {
  id: 'principal' | 'sales' | 'operations' | 'management' | 'tools'
  label: string
  items: Array<{ id: string; label: string; href: string; description: string }>
}

const baseOrderStages: Record<BusinessType, OrderWorkflowStage[]> = {
  graphic: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'pendente'] },
    { id: 'quote', label: 'Orçamento', aliases: ['orcamento', 'em analise', 'analise', 'proposta enviada'] },
    { id: 'waiting_customer', label: 'Aguardando cliente', aliases: ['aguardando cliente', 'aguardando resposta'] },
    { id: 'waiting_art', label: 'Aguardando arte', aliases: ['aguardando arte', 'arte'] },
    { id: 'approval', label: 'Aprovação', aliases: ['aguardando aprovacao', 'aprovacao', 'aprovado'] },
    { id: 'production', label: 'Produção', aliases: ['em producao', 'producao'] },
    { id: 'ready', label: 'Pronto', aliases: ['pronto', 'pronto para retirada'] },
    { id: 'delivered', label: 'Entregue', aliases: ['entregue', 'concluido'], terminal: true },
  ],
  custom_products: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'pendente'] },
    { id: 'quote', label: 'Orçamento', aliases: ['orcamento', 'em analise', 'analise', 'proposta enviada'] },
    { id: 'waiting_customer', label: 'Aguardando cliente', aliases: ['aguardando cliente', 'aguardando resposta'] },
    { id: 'waiting_art', label: 'Aguardando arte', aliases: ['aguardando arte', 'arte'] },
    { id: 'approval', label: 'Aprovação', aliases: ['aguardando aprovacao', 'aprovacao', 'aprovado'] },
    { id: 'production', label: 'Produção', aliases: ['em producao', 'producao'] },
    { id: 'ready', label: 'Pronto', aliases: ['pronto', 'pronto para retirada'] },
    { id: 'delivered', label: 'Entregue', aliases: ['entregue', 'concluido'], terminal: true },
  ],
  food: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'pendente'] },
    { id: 'confirmed', label: 'Confirmado', aliases: ['confirmado', 'aprovado'] },
    { id: 'preparing', label: 'Em preparo', aliases: ['em preparo', 'preparo', 'em producao'] },
    { id: 'ready', label: 'Pronto', aliases: ['pronto', 'pronto para retirada'] },
    { id: 'delivery', label: 'Saiu para entrega', aliases: ['saiu para entrega', 'em entrega'] },
    { id: 'delivered', label: 'Entregue', aliases: ['entregue', 'concluido'], terminal: true },
  ],
  technical_assistance: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'solicitado'] },
    { id: 'diagnosis', label: 'Diagnóstico', aliases: ['diagnostico', 'em diagnostico', 'em analise'] },
    { id: 'approval', label: 'Aguardando aprovação', aliases: ['aguardando aprovacao', 'proposta enviada'] },
    { id: 'repair', label: 'Em reparo', aliases: ['em reparo', 'manutencao', 'em manutencao', 'em producao'] },
    { id: 'tests', label: 'Testes', aliases: ['testes', 'em testes'] },
    { id: 'ready', label: 'Pronto', aliases: ['pronto'] },
    { id: 'delivered', label: 'Entregue', aliases: ['entregue', 'concluido'], terminal: true },
  ],
  services: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'solicitado', 'pendente'] },
    { id: 'analysis', label: 'Em análise', aliases: ['em analise', 'analise'] },
    { id: 'proposal', label: 'Proposta', aliases: ['proposta', 'proposta enviada', 'orcamento'] },
    { id: 'approved', label: 'Aprovado', aliases: ['aprovado', 'confirmado'] },
    { id: 'execution', label: 'Execução', aliases: ['execucao', 'em execucao', 'em andamento', 'em producao'] },
    { id: 'completed', label: 'Concluído', aliases: ['concluido', 'entregue'], terminal: true },
  ],
  auto: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'solicitado'] },
    { id: 'diagnosis', label: 'Diagnóstico', aliases: ['diagnostico', 'em diagnostico', 'em analise'] },
    { id: 'approval', label: 'Aguardando aprovação', aliases: ['aguardando aprovacao', 'proposta enviada'] },
    { id: 'repair', label: 'Em serviço', aliases: ['em reparo', 'manutencao', 'em andamento', 'em producao'] },
    { id: 'ready', label: 'Pronto', aliases: ['pronto'] },
    { id: 'delivered', label: 'Entregue', aliases: ['entregue', 'concluido'], terminal: true },
  ],
  store: [
    { id: 'received', label: 'Recebido', aliases: ['recebido', 'novo', 'pendente'] },
    { id: 'confirmed', label: 'Confirmado', aliases: ['confirmado', 'aprovado'] },
    { id: 'separation', label: 'Separação', aliases: ['separacao', 'em separacao', 'em producao'] },
    { id: 'ready', label: 'Pronto', aliases: ['pronto'] },
    { id: 'delivery', label: 'Em entrega', aliases: ['em entrega', 'saiu para entrega'] },
    { id: 'delivered', label: 'Entregue', aliases: ['entregue', 'concluido'], terminal: true },
  ],
  beauty: [
    { id: 'requested', label: 'Solicitado', aliases: ['solicitado', 'recebido', 'novo'] },
    { id: 'scheduled', label: 'Agendado', aliases: ['agendado', 'confirmado'] },
    { id: 'service', label: 'Em atendimento', aliases: ['em atendimento', 'em andamento'] },
    { id: 'completed', label: 'Atendido', aliases: ['atendido', 'concluido', 'entregue'], terminal: true },
  ],
  barber: [
    { id: 'requested', label: 'Solicitado', aliases: ['solicitado', 'recebido', 'novo'] },
    { id: 'scheduled', label: 'Agendado', aliases: ['agendado', 'confirmado'] },
    { id: 'service', label: 'Em atendimento', aliases: ['em atendimento', 'em andamento'] },
    { id: 'completed', label: 'Atendido', aliases: ['atendido', 'concluido', 'entregue'], terminal: true },
  ],
  events: [
    { id: 'received', label: 'Solicitação', aliases: ['solicitado', 'recebido', 'novo'] },
    { id: 'proposal', label: 'Proposta', aliases: ['proposta', 'proposta enviada', 'orcamento'] },
    { id: 'confirmed', label: 'Confirmado', aliases: ['confirmado', 'aprovado'] },
    { id: 'preparation', label: 'Preparação', aliases: ['preparacao', 'em andamento', 'producao'] },
    { id: 'execution', label: 'Execução', aliases: ['execucao', 'em execucao'] },
    { id: 'completed', label: 'Concluído', aliases: ['concluido', 'entregue'], terminal: true },
  ],
}

function normalized(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function operationalSegment(value: unknown): BusinessType {
  return normalizeBusinessType(value)
}

export function orderWorkflowFor(value: unknown) {
  return baseOrderStages[operationalSegment(value)] || baseOrderStages.services
}

export function orderStageForStatus(status: unknown, businessType: unknown) {
  const value = normalized(status)
  if (value.includes('cancel')) {
    return { id: 'cancelled', label: 'Cancelado', aliases: ['cancelado'], terminal: true } satisfies OrderWorkflowStage
  }

  const stages = orderWorkflowFor(businessType)
  return stages.find((stage) => stage.aliases.some((alias) => value === normalized(alias) || value.includes(normalized(alias)))) || stages[0]
}

export function canonicalOrderStatus(stageId: string, businessType: unknown) {
  if (stageId === 'cancelled') return 'Cancelado'
  return orderWorkflowFor(businessType).find((stage) => stage.id === stageId)?.label || 'Recebido'
}

export function attentionPriority(value: unknown): AttentionPriority {
  const priority = normalized(value)
  if (['critica', 'critico', 'urgent', 'urgente'].some((term) => priority.includes(term))) return 'critical'
  if (['alta', 'high'].some((term) => priority.includes(term))) return 'high'
  if (['info', 'informativa'].some((term) => priority.includes(term))) return 'info'
  return 'normal'
}

export const attentionPriorityLabels: Record<AttentionPriority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  normal: 'Normal',
  info: 'Informativa',
}

const commonManagement = [
  { id: 'finance', label: 'Financeiro', href: '/painel/financeiro', description: 'Recebimentos, despesas e caixa.' },
  { id: 'reports', label: 'Relatórios', href: '/painel/relatorios', description: 'Indicadores para decidir.' },
]

const commonSales = [
  { id: 'customers', label: 'Clientes', href: '/painel/clientes', description: 'Histórico e relacionamento.' },
  { id: 'crm', label: 'CRM', href: '/painel/crm', description: 'Leads, retornos e oportunidades.' },
  { id: 'follow-up', label: 'Follow-up', href: '/painel/follow-up', description: 'Quem precisa de resposta.' },
]

export function smartNavigationFor(businessType: unknown): SmartNavGroup[] {
  const segment = operationalSegment(businessType)

  const principalBySegment: Record<BusinessType, SmartNavGroup['items']> = {
    graphic: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Pedidos', href: '/painel/pedidos', description: 'Orçamentos e pedidos.' },
      { id: 'proposals', label: 'Orçamentos', href: '/painel/propostas', description: 'Propostas comerciais.' },
      { id: 'production', label: 'Produção', href: '/painel/producao', description: 'Fila produtiva.' },
    ],
    custom_products: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Pedidos', href: '/painel/pedidos', description: 'Pedidos e personalização.' },
      { id: 'proposals', label: 'Orçamentos', href: '/painel/propostas', description: 'Propostas comerciais.' },
      { id: 'production', label: 'Produção', href: '/painel/producao', description: 'Fila produtiva.' },
    ],
    food: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Pedidos', href: '/painel/pedidos', description: 'Pedidos do dia.' },
      { id: 'menu', label: 'Cardápio', href: '/painel/produtos', description: 'Itens e disponibilidade.' },
      { id: 'delivery', label: 'Entregas', href: '/painel/entregas', description: 'Saídas e entregas.' },
    ],
    technical_assistance: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Ordens', href: '/painel/pedidos', description: 'Ordens e solicitações.' },
      { id: 'devices', label: 'Aparelhos', href: '/painel/aparelhos', description: 'Equipamentos recebidos.' },
      { id: 'diagnosis', label: 'Diagnóstico', href: '/painel/diagnostico', description: 'Análises técnicas.' },
      { id: 'maintenance', label: 'Manutenção', href: '/painel/manutencao', description: 'Execução dos reparos.' },
    ],
    auto: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Ordens', href: '/painel/pedidos', description: 'Ordens de serviço.' },
      { id: 'vehicles', label: 'Veículos', href: '/painel/veiculos', description: 'Veículos dos clientes.' },
      { id: 'diagnosis', label: 'Diagnóstico', href: '/painel/diagnostico', description: 'Avaliações e aprovação.' },
    ],
    store: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Pedidos', href: '/painel/pedidos', description: 'Pedidos e vendas.' },
      { id: 'products', label: 'Produtos', href: '/painel/produtos', description: 'Catálogo e estoque.' },
      { id: 'stock', label: 'Estoque', href: '/painel/estoque', description: 'Disponibilidade.' },
    ],
    beauty: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'agenda', label: 'Agenda', href: '/painel/agenda', description: 'Atendimentos e horários.' },
      { id: 'customers', label: 'Clientes', href: '/painel/clientes', description: 'Histórico de clientes.' },
      { id: 'services', label: 'Serviços', href: '/painel/produtos', description: 'Serviços oferecidos.' },
    ],
    barber: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'agenda', label: 'Agenda', href: '/painel/agenda', description: 'Atendimentos e horários.' },
      { id: 'customers', label: 'Clientes', href: '/painel/clientes', description: 'Histórico de clientes.' },
      { id: 'services', label: 'Serviços', href: '/painel/produtos', description: 'Serviços oferecidos.' },
    ],
    events: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'events', label: 'Eventos', href: '/painel/eventos', description: 'Datas e execução.' },
      { id: 'proposals', label: 'Orçamentos', href: '/painel/propostas', description: 'Propostas comerciais.' },
      { id: 'tasks', label: 'Checklist', href: '/painel/tarefas', description: 'Próximas ações.' },
    ],
    services: [
      { id: 'today', label: 'Hoje', href: '/painel/inicio', description: 'Sua central do dia.' },
      { id: 'orders', label: 'Pedidos', href: '/painel/pedidos', description: 'Solicitações e execução.' },
      { id: 'proposals', label: 'Propostas', href: '/painel/propostas', description: 'Propostas comerciais.' },
      { id: 'tasks', label: 'Tarefas', href: '/painel/tarefas', description: 'Próximas ações.' },
    ],
  }

  return [
    { id: 'principal', label: 'Principal', items: principalBySegment[segment] },
    { id: 'sales', label: 'Vendas', items: commonSales },
    {
      id: 'operations',
      label: 'Operação',
      items: [
        { id: 'operational-center', label: 'Central operacional', href: '/painel/central-operacional', description: 'Hoje, pendências e ferramentas.' },
        { id: 'tasks', label: 'Tarefas', href: '/painel/tarefas', description: 'Próximas ações da equipe.' },
        { id: 'notifications', label: 'Notificações', href: '/painel/notificacoes', description: 'Eventos que pedem atenção.' },
      ],
    },
    { id: 'management', label: 'Gestão', items: commonManagement },
    {
      id: 'tools',
      label: 'Mais ferramentas',
      items: [
        { id: 'products', label: 'Produtos/Serviços', href: '/painel/produtos', description: 'Catálogo e oferta.' },
        { id: 'site', label: 'Minha Vitrine', href: '/painel/site', description: 'Site e presença comercial.' },
        { id: 'payments', label: 'Pagamentos', href: '/painel/pagamentos', description: 'Recebimentos online.' },
        { id: 'settings', label: 'Configurações', href: '/painel/configuracoes', description: 'Empresa, equipe e preferências.' },
        { id: 'subscription', label: 'Assinatura', href: '/painel/assinatura', description: 'Plano e cobrança.' },
      ],
    },
  ]
}

export const crmStages = [
  { id: 'novo_lead', label: 'Novo lead' },
  { id: 'em_atendimento', label: 'Em atendimento' },
  { id: 'orcamento_enviado', label: 'Orçamento enviado' },
  { id: 'aguardando_resposta', label: 'Aguardando resposta' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'perdido', label: 'Perdido' },
  { id: 'recorrente', label: 'Recorrente' },
] as const

export type LeadTemperature = 'cold' | 'warm' | 'hot'

export function leadTemperatureFrom(lead: { proximo_contato_em?: string | null; etapa?: string | null; valor_estimado?: number | null }): LeadTemperature {
  const stage = String(lead.etapa || '')
  if (['negociacao', 'orcamento_enviado', 'aguardando_resposta'].includes(stage)) return 'hot'
  if (Number(lead.valor_estimado || 0) > 0 || lead.proximo_contato_em) return 'warm'
  return 'cold'
}

export const leadTemperatureLabels: Record<LeadTemperature, string> = {
  cold: 'Frio',
  warm: 'Morno',
  hot: 'Quente',
}
