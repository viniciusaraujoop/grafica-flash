export type OrcalyPlanId = 'basico' | 'profissional' | 'premium'

export type OrcalyPlan = {
  id: OrcalyPlanId
  nome: string
  nomeComercial: string
  preco: number
  precoFormatado: string
  periodo: string
  destaque: string
  descricao: string
  recursos: string[]
}

export const orcalyPlans: Record<OrcalyPlanId, OrcalyPlan> = {
  basico: {
    id: 'basico',
    nome: 'Básico',
    nomeComercial: 'Básico',
    preco: 49.9,
    precoFormatado: 'R$ 49,90',
    periodo: '/mês',
    destaque: 'Para começar',
    descricao: 'Ideal para organizar pedidos, catálogo, site público e orçamento online.',
    recursos: [
      'Site público da empresa',
      'Catálogo de produtos e serviços',
      'Pedidos e orçamentos',
      'Painel básico de acompanhamento',
      'Link para atendimento no WhatsApp',
    ],
  },
  profissional: {
    id: 'profissional',
    nome: 'Profissional',
    nomeComercial: 'Intermediário',
    preco: 99.9,
    precoFormatado: 'R$ 99,90',
    periodo: '/mês',
    destaque: 'Mais vendido',
    descricao: 'Para empresas que querem vender com mais controle, propostas e operação organizada.',
    recursos: [
      'Tudo do plano Básico',
      'Propostas profissionais',
      'Gestão de clientes',
      'Produção e status de pedidos',
      'Cupons e marketplace',
      'Configuração avançada do site',
    ],
  },
  premium: {
    id: 'premium',
    nome: 'Premium',
    nomeComercial: 'Premium',
    preco: 149.9,
    precoFormatado: 'R$ 149,90',
    periodo: '/mês',
    destaque: 'Mais completo',
    descricao: 'Para empresas que querem automações, IA, área do cliente e recursos avançados.',
    recursos: [
      'Tudo do plano Profissional',
      'IA para orçamento inteligente',
      'Área do cliente final',
      'WhatsApp IA e automações',
      'QR Code da empresa',
      'Pedidos recorrentes',
      'Central operacional completa',
    ],
  },
}

export const orcalyPlansList = [
  orcalyPlans.basico,
  orcalyPlans.profissional,
  orcalyPlans.premium,
]

export function normalizeOrcalyPlan(value: unknown): OrcalyPlanId {
  if (value === 'basico' || value === 'profissional' || value === 'premium') return value
  return 'profissional'
}

export function getOrcalyPlan(value: unknown): OrcalyPlan {
  return orcalyPlans[normalizeOrcalyPlan(value)]
}

export function formatPlanPrice(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
