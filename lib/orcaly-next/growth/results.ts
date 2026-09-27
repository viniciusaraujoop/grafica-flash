/**
 * Result evaluation. Compares arms on the PRIMARY metric against the DECLARED criterion only.
 * No statistical test is performed, so no significance is ever claimed.
 */

import type { ArmSummary, GrowthExperiment, GrowthObservation, GrowthResult, ResultOutcome } from './types'
import { asRatio, metricValue, sampleFor, sumObservations } from './metrics'
import { parseIsoDate, windowDays } from './experiment'
import { relativeChangeBps } from './exact'

export const NO_STATISTICS_NOTE = 'Nenhum teste estatístico foi aplicado. O resultado compara valores observados com o critério declarado e não prova causalidade.'

function inside(observation: GrowthObservation, window: { start: string; end: string }): boolean {
  const start = parseIsoDate(observation.window.start)
  const end = parseIsoDate(observation.window.end)
  const windowStart = parseIsoDate(window.start)
  const windowEnd = parseIsoDate(window.end)
  return start !== null && end !== null && windowStart !== null && windowEnd !== null && start >= windowStart && end <= windowEnd && end >= start
}

export function evaluateResult(experiment: GrowthExperiment, observations: readonly GrowthObservation[]): GrowthResult {
  const h = experiment.hypothesis
  const base = { experimentId: experiment.id, window: h?.observationWindow ?? null, confidence: { method: 'NONE' as const, note: NO_STATISTICS_NOTE } }
  const fail = (outcome: ResultOutcome, reasons: string[], arms: ArmSummary[] = [], relative: Record<string, number | null> = {}): GrowthResult => ({ ...base, outcome, arms, relativeChangeBps: relative, reasons })

  if (experiment.status === 'INVALIDATED') return fail('INCONCLUSIVE', [`Experimento invalidado: ${(experiment.statusReason ?? 'motivo não informado').replace(/\.+$/, '')}. Os dados não devem sustentar decisões.`])
  if (!['RUNNING', 'PAUSED', 'COMPLETED'].includes(experiment.status)) return fail('INSUFFICIENT_DATA', ['O experimento ainda não foi executado.'])
  if (!h || !h.successCriteria || !h.observationWindow) return fail('INSUFFICIENT_DATA', ['Hipótese sem critério ou janela declarados.'])

  const criteria = h.successCriteria
  const window = h.observationWindow
  const own = observations.filter((observation) => observation.experimentId === experiment.id)
  const valid = own.filter((observation) => inside(observation, window))
  const reasons: string[] = []
  if (valid.length < own.length) reasons.push(`${own.length - valid.length} observação(ões) fora da janela declarada foram ignoradas.`)

  const arms: ArmSummary[] = experiment.variants.map((variant) => {
    const totals = sumObservations(valid.filter((observation) => observation.variantId === variant.id))
    const provenance = valid.some((observation) => observation.variantId === variant.id && observation.provenance === 'MEASURED') ? 'MEASURED' : 'DECLARED'
    const metrics: Record<string, ReturnType<typeof metricValue>> = {}
    for (const metric of experiment.metrics) metrics[metric.key] = metricValue(metric.key, totals, provenance)
    return { variantId: variant.id, role: variant.role, sample: sampleFor(criteria.metric, totals), primary: metricValue(criteria.metric, totals, provenance), metrics }
  })

  const unknown = arms.filter((arm) => arm.primary.provenance === 'UNKNOWN')
  if (unknown.length) return fail('INSUFFICIENT_DATA', [...reasons, `Métrica primária indisponível em: ${unknown.map((arm) => arm.variantId).join(', ')}.`], arms)
  const small = arms.filter((arm) => arm.sample === null || arm.sample < BigInt(criteria.minSamplePerArm))
  if (small.length) return fail('INSUFFICIENT_DATA', [...reasons, `Amostra abaixo do mínimo declarado (${criteria.minSamplePerArm} por braço) em: ${small.map((arm) => arm.variantId).join(', ')}.`], arms)

  const starts = valid.map((observation) => parseIsoDate(observation.window.start) as number)
  const ends = valid.map((observation) => parseIsoDate(observation.window.end) as number)
  const covered = windowDays({ start: new Date(Math.min(...starts)).toISOString().slice(0, 10), end: new Date(Math.max(...ends)).toISOString().slice(0, 10) }) ?? 0
  if (covered < criteria.minimumDurationDays) return fail('INSUFFICIENT_DATA', [...reasons, `Dados cobrem ${covered} dia(s); a duração mínima declarada é ${criteria.minimumDurationDays}.`], arms)

  const reference = experiment.singleArm ? (h.baseline ? asRatio(h.baseline.value) : null) : asRatio(arms.find((arm) => arm.role === 'control')?.primary ?? { provenance: 'UNKNOWN', reason: '' })
  if (!reference) return fail('INSUFFICIENT_DATA', [...reasons, experiment.singleArm ? 'Baseline declarada ausente.' : 'Controle sem valor.'], arms)

  const relative: Record<string, number | null> = {}
  const verdicts: Array<'meets' | 'directional' | 'flat' | 'misses' | 'undefined'> = []
  for (const arm of arms.filter((entry) => entry.role === 'variant')) {
    const ratio = asRatio(arm.primary)
    const change = ratio ? relativeChangeBps(reference, ratio) : null
    relative[arm.variantId] = change
    if (change === null) { verdicts.push('undefined'); continue }
    const meets = criteria.comparator === 'relative_change_at_least' ? change >= criteria.thresholdBps : change <= criteria.thresholdBps
    const rightWay = h.expectedDirection === 'increase' ? change > 0 : change < 0
    verdicts.push(meets ? 'meets' : change === 0 ? 'flat' : rightWay ? 'directional' : 'misses')
  }

  if (experiment.singleArm) reasons.push('Comparação com baseline declarada, sem grupo de controle simultâneo: diferenças podem ter outras causas.')
  if (experiment.status !== 'COMPLETED') reasons.push('Resultado provisório: o experimento ainda não foi concluído.')

  let outcome: ResultOutcome
  if (verdicts.includes('undefined')) { outcome = 'INCONCLUSIVE'; reasons.push('Referência igual a zero: variação relativa indefinida.') }
  else if (verdicts.includes('meets') && verdicts.includes('misses')) { outcome = 'INCONCLUSIVE'; reasons.push('Variantes em direções opostas.') }
  else if (verdicts.includes('meets')) outcome = 'MEETS_DECLARED_CRITERIA'
  else if (verdicts.includes('directional')) outcome = 'DIRECTIONAL_SIGNAL'
  else if (verdicts.every((verdict) => verdict === 'flat')) outcome = 'INCONCLUSIVE'
  else outcome = 'DOES_NOT_MEET_DECLARED_CRITERIA'
  return { ...base, outcome, arms, relativeChangeBps: relative, reasons }
}

/** The only sentence a UI may use to state a conclusion for each outcome. */
export const ALLOWED_CONCLUSION: Record<ResultOutcome, string> = {
  MEETS_DECLARED_CRITERIA: 'A variante atingiu o critério declarado nesta janela. Isso não prova causalidade nem garante repetição.',
  DOES_NOT_MEET_DECLARED_CRITERIA: 'A variante não atingiu o critério declarado nesta janela.',
  DIRECTIONAL_SIGNAL: 'Há variação na direção esperada, mas abaixo do critério declarado. Não é base suficiente para adotar a variante.',
  INCONCLUSIVE: 'Os dados não permitem uma conclusão.',
  INSUFFICIENT_DATA: 'Ainda não há dados suficientes para avaliar o critério declarado.',
}

export const OUTCOME_LABEL: Record<ResultOutcome, string> = {
  MEETS_DECLARED_CRITERIA: 'Atingiu o critério',
  DOES_NOT_MEET_DECLARED_CRITERIA: 'Não atingiu o critério',
  DIRECTIONAL_SIGNAL: 'Sinal direcional',
  INCONCLUSIVE: 'Inconclusivo',
  INSUFFICIENT_DATA: 'Dados insuficientes',
}

export function formatBps(bps: number | null): string {
  if (bps === null) return 'Não disponível'
  const sign = bps > 0 ? '+' : bps < 0 ? '−' : ''
  const abs = Math.abs(bps)
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}%`
}
