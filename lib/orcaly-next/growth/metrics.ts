/**
 * Growth metric catalogue and derived calculations.
 * A derived metric exists ONLY when every input exists and its denominator is non-zero.
 * Otherwise it is UNKNOWN with a reason — never zero.
 */

import type { BaseMetricKey, DerivedMetricKey, GrowthMetric, GrowthObservation, MetricKey, MetricValue } from './types'
import { ZERO, divideRounded, formatCents, formatCount, ratioToDecimal } from './exact'

export const METRIC_CATALOGUE: Record<BaseMetricKey | DerivedMetricKey, GrowthMetric> = {
  impressions: { key: 'impressions', label: 'Impressões', unit: 'count', better: 'increase' },
  clicks: { key: 'clicks', label: 'Cliques', unit: 'count', better: 'increase' },
  leads: { key: 'leads', label: 'Leads', unit: 'count', better: 'increase' },
  conversions: { key: 'conversions', label: 'Conversões', unit: 'count', better: 'increase' },
  spend_cents: { key: 'spend_cents', label: 'Investimento', unit: 'cents', better: 'decrease' },
  revenue_cents: { key: 'revenue_cents', label: 'Receita atribuída', unit: 'cents', better: 'increase' },
  ctr: { key: 'ctr', label: 'CTR', unit: 'percent', better: 'increase' },
  cpc: { key: 'cpc', label: 'CPC', unit: 'cents', better: 'decrease' },
  cpl: { key: 'cpl', label: 'CPL', unit: 'cents', better: 'decrease' },
  conversion_rate: { key: 'conversion_rate', label: 'Taxa de conversão', unit: 'percent', better: 'increase' },
  cac: { key: 'cac', label: 'CAC', unit: 'cents', better: 'decrease' },
  roas: { key: 'roas', label: 'ROAS', unit: 'ratio', better: 'increase' },
}

/** Formula of each derived metric: numerator / denominator. Documented and tested. */
export const DERIVED_FORMULAS: Record<DerivedMetricKey, { numerator: BaseMetricKey; denominator: BaseMetricKey; description: string }> = {
  ctr: { numerator: 'clicks', denominator: 'impressions', description: 'cliques ÷ impressões' },
  cpc: { numerator: 'spend_cents', denominator: 'clicks', description: 'investimento ÷ cliques' },
  cpl: { numerator: 'spend_cents', denominator: 'leads', description: 'investimento ÷ leads' },
  conversion_rate: { numerator: 'conversions', denominator: 'clicks', description: 'conversões ÷ cliques' },
  cac: { numerator: 'spend_cents', denominator: 'conversions', description: 'investimento ÷ conversões' },
  roas: { numerator: 'revenue_cents', denominator: 'spend_cents', description: 'receita atribuída ÷ investimento' },
}

export function isDerived(key: MetricKey): key is DerivedMetricKey {
  return key in DERIVED_FORMULAS
}

export function metricDefinition(key: MetricKey): GrowthMetric {
  if (key.startsWith('custom:')) return { key, label: key.slice(7), unit: 'count', better: 'increase' }
  return METRIC_CATALOGUE[key as BaseMetricKey | DerivedMetricKey]
}

type Totals = Partial<Record<BaseMetricKey, bigint>> & { custom?: Record<string, bigint> }

/**
 * Sums observations of one arm. A base metric is present only if EVERY observation declared it;
 * a partially reported metric becomes absent (UNKNOWN) instead of an understated total.
 */
export function sumObservations(observations: readonly GrowthObservation[]): Totals {
  if (!observations.length) return {}
  const totals: Totals = {}
  const baseKeys = Object.keys(METRIC_CATALOGUE).filter((key) => !isDerived(key as MetricKey)) as BaseMetricKey[]
  for (const key of baseKeys) {
    if (observations.every((observation) => observation.values[key] !== undefined)) {
      totals[key] = observations.reduce((sum, observation) => sum + (observation.values[key] as bigint), ZERO)
    }
  }
  const customKeys = new Set(observations.flatMap((observation) => Object.keys(observation.values.custom ?? {})))
  for (const key of customKeys) {
    if (observations.every((observation) => observation.values.custom?.[key] !== undefined)) {
      totals.custom ??= {}
      totals.custom[key] = observations.reduce((sum, observation) => sum + (observation.values.custom?.[key] as bigint), ZERO)
    }
  }
  return totals
}

export function metricValue(key: MetricKey, totals: Totals, provenance: 'DECLARED' | 'MEASURED' = 'DECLARED'): MetricValue {
  if (key.startsWith('custom:')) {
    const value = totals.custom?.[key.slice(7)]
    return value === undefined ? { provenance: 'UNKNOWN', reason: 'métrica não informada' } : { provenance, value }
  }
  if (!isDerived(key)) {
    const value = totals[key as BaseMetricKey]
    return value === undefined ? { provenance: 'UNKNOWN', reason: 'métrica não informada' } : { provenance, value }
  }
  const formula = DERIVED_FORMULAS[key]
  const numerator = totals[formula.numerator]
  const denominator = totals[formula.denominator]
  if (numerator === undefined || denominator === undefined) {
    return { provenance: 'UNKNOWN', reason: `requer ${METRIC_CATALOGUE[formula.numerator].label.toLowerCase()} e ${METRIC_CATALOGUE[formula.denominator].label.toLowerCase()}` }
  }
  if (denominator === ZERO) return { provenance: 'UNKNOWN', reason: `${METRIC_CATALOGUE[formula.denominator].label.toLowerCase()} igual a zero — divisão indefinida` }
  return { provenance: 'CALCULATED', ratio: { numerator, denominator }, unit: METRIC_CATALOGUE[key].unit }
}

/** The sample that supports a metric: its denominator for derived metrics, the value itself for counts. */
export function sampleFor(key: MetricKey, totals: Totals): bigint | null {
  if (isDerived(key)) return totals[DERIVED_FORMULAS[key].denominator] ?? null
  if (key.startsWith('custom:')) return totals.custom?.[key.slice(7)] ?? null
  return totals[key as BaseMetricKey] ?? null
}

/** Human, exact formatting. UNKNOWN renders as "Não disponível", never "0". */
export function formatMetricValue(value: MetricValue): string {
  if (value.provenance === 'UNKNOWN') return 'Não disponível'
  if (value.provenance === 'CALCULATED') {
    const { numerator, denominator } = value.ratio
    if (value.unit === 'percent') return `${ratioToDecimal(numerator * BigInt(100), denominator, 2)}%`
    if (value.unit === 'cents') return formatCents(divideRounded(numerator, denominator) ?? ZERO)
    return `${ratioToDecimal(numerator, denominator, 2)}×`
  }
  return formatCount(value.value)
}

export function formatMetric(key: MetricKey, value: MetricValue): string {
  if (value.provenance !== 'UNKNOWN' && value.provenance !== 'CALCULATED' && metricDefinition(key).unit === 'cents') return formatCents(value.value)
  return formatMetricValue(value)
}

/** Comparable exact ratio for any known value (counts become value/1). */
export function asRatio(value: MetricValue): { numerator: bigint; denominator: bigint } | null {
  if (value.provenance === 'UNKNOWN') return null
  if (value.provenance === 'CALCULATED') return value.ratio
  return { numerator: value.value, denominator: BigInt(1) }
}
