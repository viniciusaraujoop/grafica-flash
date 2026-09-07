export const FOUNDER_PLAN_CONFIG = {
  basico: {
    label: 'Básico',
    founderPriceCents: 3490,
    normalPriceCents: 4990,
  },
  profissional: {
    label: 'Profissional',
    founderPriceCents: 6990,
    normalPriceCents: 9990,
  },
  premium: {
    label: 'Premium',
    founderPriceCents: 9990,
    normalPriceCents: 14990,
  },
} as const

export type FounderPlanKey = keyof typeof FOUNDER_PLAN_CONFIG

export const FOUNDER_STATUS_LABELS = {
  pending: 'Pendente',
  activated: 'Ativado',
  revoked: 'Revogado',
  expired: 'Expirado',
} as const

export function normalizeFounderPlan(
  value: unknown,
): FounderPlanKey | null {
  const plan = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (plan === 'basico' || plan === 'essencial') return 'basico'
  if (
    plan === 'profissional' ||
    plan === 'intermediario'
  ) {
    return 'profissional'
  }
  if (plan === 'premium') return 'premium'

  return null
}

export function founderNumberLabel(value: number) {
  return `#${String(value).padStart(2, '0')}`
}

export function moneyFromCents(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100)
}
