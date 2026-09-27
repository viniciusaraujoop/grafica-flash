/**
 * Learning Log and Growth Decision Receipt.
 * FACT, INTERPRETATION and DECISION are never mixed in one entry.
 */

import type { GrowthDecision, GrowthExperiment, GrowthLearning, GrowthObservation, GrowthResult, MetricKey, ResultOutcome } from './types'
import type { Issue } from './experiment'
import { ALLOWED_CONCLUSION, NO_STATISTICS_NOTE, formatBps } from './results'
import { formatMetric, metricDefinition } from './metrics'

export function validateLearning(learning: GrowthLearning, observations: readonly GrowthObservation[], receiptIds: readonly string[] = []): Issue[] {
  const issues: Issue[] = []
  const text = learning.text.trim()
  if (text.length < 5 || text.length > 1000) issues.push({ code: 'TEXT', field: 'text', message: 'texto com 5 a 1000 caracteres' })
  const own = new Set(observations.filter((observation) => observation.experimentId === learning.experimentId).map((observation) => observation.id))
  if (learning.kind === 'FACT') {
    if (!learning.observationIds.length) issues.push({ code: 'FACT_NEEDS_OBSERVATION', field: 'observationIds', message: 'um fato cita pelo menos uma observação' })
    for (const id of learning.observationIds) if (!own.has(id)) issues.push({ code: 'FOREIGN_OBSERVATION', field: 'observationIds', message: `observação ${id} não pertence a este experimento` })
    if (learning.decisionReceiptId) issues.push({ code: 'FACT_WITH_DECISION', field: 'decisionReceiptId', message: 'fato não carrega decisão; registre a decisão separadamente' })
  } else if (learning.kind === 'INTERPRETATION') {
    if (!learning.limitation?.trim()) issues.push({ code: 'INTERPRETATION_NEEDS_LIMITATION', field: 'limitation', message: 'toda interpretação declara sua limitação' })
    if (learning.decisionReceiptId) issues.push({ code: 'INTERPRETATION_WITH_DECISION', field: 'decisionReceiptId', message: 'interpretação não é decisão' })
  } else if (learning.kind === 'DECISION') {
    if (!learning.decisionReceiptId) issues.push({ code: 'DECISION_NEEDS_RECEIPT', field: 'decisionReceiptId', message: 'decisão exige Decision Receipt' })
    else if (!receiptIds.includes(learning.decisionReceiptId)) issues.push({ code: 'UNKNOWN_RECEIPT', field: 'decisionReceiptId', message: 'Decision Receipt inexistente' })
  } else {
    issues.push({ code: 'KIND', field: 'kind', message: 'tipo deve ser FACT, INTERPRETATION ou DECISION' })
  }
  return issues
}

export const LEARNING_KIND_LABEL = { FACT: 'Fato', INTERPRETATION: 'Interpretação', DECISION: 'Decisão' } as const

export type GrowthDecisionReceipt = {
  id: string
  experimentId: string
  createdAt: string
  observed: readonly string[]
  dataUsed: { observationIds: readonly string[]; sourceIds: readonly string[]; provenance: readonly string[] }
  period: { start: string; end: string } | null
  criterion: string
  outcome: ResultOutcome
  allowedConclusion: string
  limitations: readonly string[]
  decision: { action: GrowthDecision['action']; rationale: string; decidedBy: string }
  nextStep: string
}

/** Which decisions each outcome permits. Adopting a variant requires the declared criterion to be met. */
export const PERMITTED_ACTIONS: Record<ResultOutcome, readonly GrowthDecision['action'][]> = {
  MEETS_DECLARED_CRITERIA: ['adopt_variant', 'iterate', 'extend_test', 'keep_control', 'stop'],
  DOES_NOT_MEET_DECLARED_CRITERIA: ['keep_control', 'iterate', 'stop'],
  DIRECTIONAL_SIGNAL: ['extend_test', 'iterate', 'keep_control', 'stop'],
  INCONCLUSIVE: ['extend_test', 'iterate', 'keep_control', 'stop', 'invalidate'],
  INSUFFICIENT_DATA: ['extend_test', 'stop', 'invalidate'],
}

export const ACTION_LABEL: Record<GrowthDecision['action'], string> = {
  adopt_variant: 'Adotar a variante', keep_control: 'Manter o controle', iterate: 'Iterar com novo teste',
  extend_test: 'Estender o teste', stop: 'Encerrar sem mudança', invalidate: 'Invalidar o experimento',
}

export class DecisionNotPermittedError extends Error {}

export function criterionText(experiment: GrowthExperiment): string {
  const c = experiment.hypothesis?.successCriteria
  if (!c) return 'Nenhum critério declarado.'
  const label = metricDefinition(c.metric).label
  const op = c.comparator === 'relative_change_at_least' ? 'variação de pelo menos' : 'variação de no máximo'
  return `${label}: ${op} ${formatBps(c.thresholdBps)} vs ${experiment.singleArm ? 'baseline' : 'controle'}, mínimo ${c.minSamplePerArm} por braço e ${c.minimumDurationDays} dia(s).`
}

export function buildDecisionReceipt(input: {
  id: string
  experiment: GrowthExperiment
  result: GrowthResult
  observations: readonly GrowthObservation[]
  decision: GrowthDecision
  nextStep: string
  createdAt: string
}): GrowthDecisionReceipt {
  const { experiment, result, decision } = input
  if (decision.experimentId !== experiment.id || result.experimentId !== experiment.id) throw new DecisionNotPermittedError('decisão, resultado e experimento divergem')
  if (!PERMITTED_ACTIONS[result.outcome].includes(decision.action)) {
    throw new DecisionNotPermittedError(`"${ACTION_LABEL[decision.action]}" não é permitido quando o resultado é ${result.outcome}`)
  }
  if (!decision.rationale.trim() || decision.rationale.length > 1000) throw new DecisionNotPermittedError('justificativa obrigatória (até 1000 caracteres)')
  const window = result.window
  const used = input.observations.filter((observation) => observation.experimentId === experiment.id)
  const primary = experiment.hypothesis?.successCriteria?.metric
  const observed = result.arms.map((arm) => {
    const variant = experiment.variants.find((entry) => entry.id === arm.variantId)
    const change = result.relativeChangeBps[arm.variantId]
    return `${variant?.label ?? arm.variantId} (${arm.role === 'control' ? 'controle' : 'variante'}): ${primary ? formatMetric(primary, arm.primary) : '—'}${arm.sample !== null ? ` · amostra ${arm.sample.toString()}` : ''}${change !== undefined ? ` · ${formatBps(change)}` : ''}`
  })
  const limitations = [NO_STATISTICS_NOTE, ...result.reasons]
  if (used.every((observation) => observation.provenance === 'DECLARED')) limitations.push('Dados inseridos manualmente (DECLARED); não foram conferidos com uma fonte conectada.')
  const unknownMetrics = result.arms.flatMap((arm) => Object.entries(arm.metrics).filter(([, value]) => value.provenance === 'UNKNOWN').map(([key]) => key))
  if (unknownMetrics.length) limitations.push(`Métricas indisponíveis: ${[...new Set(unknownMetrics)].map((key) => metricDefinition(key as MetricKey).label).join(', ')}.`)
  return {
    id: input.id,
    experimentId: experiment.id,
    createdAt: input.createdAt,
    observed,
    dataUsed: { observationIds: used.map((observation) => observation.id), sourceIds: [...new Set(used.map((observation) => observation.sourceId))], provenance: [...new Set(used.map((observation) => observation.provenance))] },
    period: window,
    criterion: criterionText(experiment),
    outcome: result.outcome,
    allowedConclusion: ALLOWED_CONCLUSION[result.outcome],
    limitations: [...new Set(limitations)],
    decision: { action: decision.action, rationale: decision.rationale.trim(), decidedBy: decision.decidedBy },
    nextStep: input.nextStep,
  }
}
