export const PERFORMANCE_PERIODS = [
  '7',
  '30',
  '90',
  'all',
] as const

export type PerformancePeriod =
  (typeof PERFORMANCE_PERIODS)[number]

export const PERFORMANCE_PERIOD_LABELS: Record<
  PerformancePeriod,
  string
> = {
  '7': '7 dias',
  '30': '30 dias',
  '90': '90 dias',
  all: 'Desde o início',
}

export const PERFORMANCE_STAGE_LABELS = {
  novo: 'Novo',
  contatado: 'Contatado',
  interessado: 'Interessado',
  demonstracao: 'Demonstração',
  convite_fundador: 'Convite Founder',
  conta_ativada: 'Conta ativada',
  cliente: 'Cliente',
  perdido: 'Perdido',
} as const

export type PerformanceStage =
  keyof typeof PERFORMANCE_STAGE_LABELS

export const PERFORMANCE_STAGES = Object.keys(
  PERFORMANCE_STAGE_LABELS,
) as PerformanceStage[]

export function parsePerformancePeriod(
  value: unknown,
): PerformancePeriod {
  const normalized = String(value || '').trim()

  if (
    PERFORMANCE_PERIODS.includes(
      normalized as PerformancePeriod,
    )
  ) {
    return normalized as PerformancePeriod
  }

  return '30'
}

export function performancePeriodStart(
  period: PerformancePeriod,
  now = new Date(),
) {
  if (period === 'all') return null

  const days = Number(period)
  return new Date(
    now.getTime() - days * 24 * 60 * 60 * 1000,
  )
}

export function safeRate(
  numerator: number,
  denominator: number,
) {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}
