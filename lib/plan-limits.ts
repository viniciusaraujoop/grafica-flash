export type PlanId = 'basic' | 'intermediate' | 'premium'

export type FeatureId =
  | 'site'
  | 'pedidos'
  | 'produtos'
  | 'whatsapp'
  | 'crm'
  | 'financeiro'
  | 'cupons'
  | 'galeria'
  | 'video_produtos'
  | 'notas_fiscais'
  | 'propostas'
  | 'producao'
  | 'relatorios'
  | 'dominio_proprio'
  | 'modulos_avancados'
  | 'permissoes_equipe'

export type PlanLimits = {
  id: PlanId
  label: string
  monthlyPrice: number
  maxProducts: number | null
  features: FeatureId[]
}

export const planLimits: Record<PlanId, PlanLimits> = {
  basic: {
    id: 'basic',
    label: 'Básico',
    monthlyPrice: 49.9,
    maxProducts: 30,
    features: ['site', 'pedidos', 'produtos', 'whatsapp'],
  },
  intermediate: {
    id: 'intermediate',
    label: 'Profissional',
    monthlyPrice: 99.9,
    maxProducts: 150,
    features: ['site', 'pedidos', 'produtos', 'whatsapp', 'crm', 'financeiro', 'cupons', 'galeria', 'video_produtos'],
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    monthlyPrice: 149.9,
    maxProducts: null,
    features: [
      'site',
      'pedidos',
      'produtos',
      'whatsapp',
      'crm',
      'financeiro',
      'cupons',
      'galeria',
      'video_produtos',
      'notas_fiscais',
      'propostas',
      'producao',
      'relatorios',
      'dominio_proprio',
      'modulos_avancados',
      'permissoes_equipe',
    ],
  },
}

export function normalizePlan(plan: unknown): PlanId {
  const value = String(plan || '').trim().toLowerCase()

  if (value === 'premium') return 'premium'
  if (value === 'pro' || value === 'profissional' || value === 'intermediate' || value === 'intermediario') return 'intermediate'

  return 'basic'
}

export function getPlanLimits(plan: unknown) {
  return planLimits[normalizePlan(plan)]
}

export function canUseFeature(plan: unknown, feature: FeatureId) {
  return getPlanLimits(plan).features.includes(feature)
}

export function getRequiredPlan(feature: FeatureId): PlanId {
  if (planLimits.basic.features.includes(feature)) return 'basic'
  if (planLimits.intermediate.features.includes(feature)) return 'intermediate'
  return 'premium'
}

export function getPlanLabel(plan: unknown) {
  return getPlanLimits(plan).label
}

export function getUpgradeMessage(requiredPlan: PlanId | null | undefined) {
  if (!requiredPlan) return 'Disponível no seu plano atual.'

  return `Recurso disponível no plano ${getPlanLimits(requiredPlan).label}.`
}

export function planCanAccess(currentPlan: unknown, requiredPlan: PlanId | null | undefined) {
  if (!requiredPlan) return true

  const order: Record<PlanId, number> = {
    basic: 1,
    intermediate: 2,
    premium: 3,
  }

  return order[normalizePlan(currentPlan)] >= order[requiredPlan]
}
