/**
 * Hypothesis validation and the experiment state machine.
 * Pure functions; every transition returns a NEW experiment with version + 1
 * and requires the caller's expected version (compare-and-set, mirrors PT409).
 */

import type { ExperimentStatus, GrowthExperiment, GrowthHypothesis, GrowthTimeWindow, MetricKey } from './types'
import { BASE_METRICS, DERIVED_METRICS } from './types'

export type Issue = { code: string; field: string; message: string }

export const LIMITS = {
  statement: [10, 500],
  title: [3, 120],
  listItems: 10,
  listItemLength: 280,
  source: 200,
  thresholdBps: 100000,
  minSamplePerArm: 1_000_000_000,
  durationDays: 365,
  variants: 6,
  reason: 500,
} as const

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseIsoDate(value: string): number | null {
  if (!DATE.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const time = Date.UTC(year, month - 1, day)
  const check = new Date(time)
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? time : null
}

/** Inclusive day count of a window; null if invalid. */
export function windowDays(window: GrowthTimeWindow): number | null {
  const start = parseIsoDate(window.start)
  const end = parseIsoDate(window.end)
  if (start === null || end === null || end < start) return null
  return Math.round((end - start) / 86_400_000) + 1
}

export function isMetricKey(value: unknown): value is MetricKey {
  if (typeof value !== 'string') return false
  if (value.startsWith('custom:')) return /^custom:[a-z][a-z0-9_]{0,39}$/.test(value)
  return (BASE_METRICS as readonly string[]).includes(value) || (DERIVED_METRICS as readonly string[]).includes(value)
}

function checkList(issues: Issue[], field: string, list: readonly string[]) {
  if (list.length > LIMITS.listItems) issues.push({ code: 'TOO_MANY_ITEMS', field, message: `no máximo ${LIMITS.listItems} itens` })
  list.forEach((item, index) => {
    if (!item.trim() || item.length > LIMITS.listItemLength) issues.push({ code: 'INVALID_ITEM', field: `${field}[${index}]`, message: `texto de 1 a ${LIMITS.listItemLength} caracteres` })
  })
}

/** Structural validity of a hypothesis (it may still be incomplete for running). */
export function validateHypothesis(h: GrowthHypothesis): Issue[] {
  const issues: Issue[] = []
  const statement = h.statement.trim()
  if (statement.length < LIMITS.statement[0] || statement.length > LIMITS.statement[1]) issues.push({ code: 'STATEMENT_LENGTH', field: 'statement', message: `hipótese com ${LIMITS.statement[0]} a ${LIMITS.statement[1]} caracteres` })
  if (h.expectedDirection !== 'increase' && h.expectedDirection !== 'decrease') issues.push({ code: 'DIRECTION', field: 'expectedDirection', message: 'direção esperada inválida' })
  if (!isMetricKey(h.primaryMetric)) issues.push({ code: 'PRIMARY_METRIC', field: 'primaryMetric', message: 'métrica primária inválida' })
  if (!Number.isInteger(h.minimumDurationDays) || h.minimumDurationDays < 1 || h.minimumDurationDays > LIMITS.durationDays) issues.push({ code: 'DURATION', field: 'minimumDurationDays', message: `duração mínima entre 1 e ${LIMITS.durationDays} dias` })
  if (h.observationWindow) {
    const days = windowDays(h.observationWindow)
    if (days === null) issues.push({ code: 'WINDOW_INVALID', field: 'observationWindow', message: 'janela com datas inválidas ou fim antes do início' })
    else if (days < h.minimumDurationDays) issues.push({ code: 'WINDOW_TOO_SHORT', field: 'observationWindow', message: 'janela menor que a duração mínima declarada' })
  }
  if (h.baseline && h.baseline.metric !== h.primaryMetric) issues.push({ code: 'BASELINE_METRIC', field: 'baseline', message: 'baseline deve medir a métrica primária' })
  if (h.baseline && h.baseline.value.provenance === 'UNKNOWN') issues.push({ code: 'BASELINE_UNKNOWN', field: 'baseline', message: 'baseline desconhecida deve ser omitida, não registrada' })
  const c = h.successCriteria
  if (c) {
    if (c.metric !== h.primaryMetric) issues.push({ code: 'CRITERIA_METRIC', field: 'successCriteria.metric', message: 'o critério deve usar a métrica primária' })
    if (!Number.isInteger(c.thresholdBps) || Math.abs(c.thresholdBps) > LIMITS.thresholdBps) issues.push({ code: 'THRESHOLD', field: 'successCriteria.thresholdBps', message: 'limiar inválido' })
    if (h.expectedDirection === 'increase' && (c.comparator !== 'relative_change_at_least' || c.thresholdBps <= 0)) issues.push({ code: 'CRITERIA_DIRECTION', field: 'successCriteria', message: 'para aumento, use "variação de pelo menos" com limiar positivo' })
    if (h.expectedDirection === 'decrease' && (c.comparator !== 'relative_change_at_most' || c.thresholdBps >= 0)) issues.push({ code: 'CRITERIA_DIRECTION', field: 'successCriteria', message: 'para redução, use "variação de no máximo" com limiar negativo' })
    if (!Number.isInteger(c.minSamplePerArm) || c.minSamplePerArm < 1 || c.minSamplePerArm > LIMITS.minSamplePerArm) issues.push({ code: 'MIN_SAMPLE', field: 'successCriteria.minSamplePerArm', message: 'amostra mínima por braço inválida' })
    if (c.minimumDurationDays !== h.minimumDurationDays) issues.push({ code: 'CRITERIA_DURATION', field: 'successCriteria.minimumDurationDays', message: 'duração do critério difere da duração da hipótese' })
  }
  checkList(issues, 'assumptions', h.assumptions)
  checkList(issues, 'risks', h.risks)
  if (!h.source.trim() || h.source.length > LIMITS.source) issues.push({ code: 'SOURCE', field: 'source', message: 'informe a origem da hipótese' })
  return issues
}

/** Everything required before RUNNING. */
export function readinessIssues(experiment: GrowthExperiment): Issue[] {
  const issues: Issue[] = []
  const title = experiment.title.trim()
  if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) issues.push({ code: 'TITLE', field: 'title', message: 'título com 3 a 120 caracteres' })
  const h = experiment.hypothesis
  if (!h) return [...issues, { code: 'NO_HYPOTHESIS', field: 'hypothesis', message: 'experimento sem hipótese' }]
  issues.push(...validateHypothesis(h))
  if (!h.successCriteria) issues.push({ code: 'NO_CRITERIA', field: 'successCriteria', message: 'defina o critério de sucesso antes de iniciar' })
  if (!h.observationWindow) issues.push({ code: 'NO_WINDOW', field: 'observationWindow', message: 'defina a janela de observação' })
  const controls = experiment.variants.filter((variant) => variant.role === 'control')
  const variants = experiment.variants.filter((variant) => variant.role === 'variant')
  if (experiment.variants.length > LIMITS.variants) issues.push({ code: 'TOO_MANY_VARIANTS', field: 'variants', message: `no máximo ${LIMITS.variants} braços` })
  if (new Set(experiment.variants.map((variant) => variant.id)).size !== experiment.variants.length) issues.push({ code: 'DUPLICATE_VARIANT', field: 'variants', message: 'braços com id duplicado' })
  if (experiment.singleArm) {
    if (variants.length !== 1 || controls.length !== 0) issues.push({ code: 'SINGLE_ARM_SHAPE', field: 'variants', message: 'teste de braço único tem exatamente uma variante e nenhum controle' })
    if (!h.baseline) issues.push({ code: 'SINGLE_ARM_NEEDS_BASELINE', field: 'baseline', message: 'teste sem controle exige baseline declarada' })
  } else {
    if (controls.length !== 1) issues.push({ code: 'NEEDS_CONTROL', field: 'variants', message: 'exatamente um controle' })
    if (variants.length < 1) issues.push({ code: 'NEEDS_VARIANT', field: 'variants', message: 'pelo menos uma variante' })
  }
  return issues
}

export type TransitionAction = 'mark_ready' | 'back_to_draft' | 'start' | 'pause' | 'resume' | 'complete' | 'cancel' | 'invalidate'

const TRANSITIONS: Record<TransitionAction, { from: readonly ExperimentStatus[]; to: ExperimentStatus; needsReason: boolean; needsReadiness: boolean }> = {
  mark_ready: { from: ['DRAFT'], to: 'READY', needsReason: false, needsReadiness: true },
  back_to_draft: { from: ['READY'], to: 'DRAFT', needsReason: false, needsReadiness: false },
  start: { from: ['READY'], to: 'RUNNING', needsReason: false, needsReadiness: true },
  pause: { from: ['RUNNING'], to: 'PAUSED', needsReason: true, needsReadiness: false },
  resume: { from: ['PAUSED'], to: 'RUNNING', needsReason: false, needsReadiness: true },
  complete: { from: ['RUNNING', 'PAUSED'], to: 'COMPLETED', needsReason: false, needsReadiness: false },
  cancel: { from: ['DRAFT', 'READY', 'PAUSED'], to: 'CANCELLED', needsReason: true, needsReadiness: false },
  invalidate: { from: ['RUNNING', 'PAUSED', 'COMPLETED'], to: 'INVALIDATED', needsReason: true, needsReadiness: false },
}

export function allowedActions(experiment: GrowthExperiment): TransitionAction[] {
  return (Object.keys(TRANSITIONS) as TransitionAction[]).filter((action) => TRANSITIONS[action].from.includes(experiment.status))
}

export type TransitionResult =
  | { ok: true; experiment: GrowthExperiment }
  | { ok: false; code: 'VERSION_CONFLICT' | 'INVALID_TRANSITION' | 'NOT_READY' | 'REASON_REQUIRED'; issues: Issue[] }

export function transition(experiment: GrowthExperiment, action: TransitionAction, input: { expectedVersion: number; at: string; reason?: string }): TransitionResult {
  if (input.expectedVersion !== experiment.version) return { ok: false, code: 'VERSION_CONFLICT', issues: [{ code: 'VERSION_CONFLICT', field: 'version', message: 'o experimento foi alterado por outra pessoa; recarregue' }] }
  const rule = TRANSITIONS[action]
  if (!rule || !rule.from.includes(experiment.status)) return { ok: false, code: 'INVALID_TRANSITION', issues: [{ code: 'INVALID_TRANSITION', field: 'status', message: `não é possível "${action}" a partir de ${experiment.status}` }] }
  const reason = input.reason?.trim() ?? ''
  if (rule.needsReason && (!reason || reason.length > LIMITS.reason)) return { ok: false, code: 'REASON_REQUIRED', issues: [{ code: 'REASON_REQUIRED', field: 'reason', message: 'informe o motivo (até 500 caracteres)' }] }
  if (rule.needsReadiness) {
    const issues = readinessIssues(experiment)
    if (issues.length) return { ok: false, code: 'NOT_READY', issues }
  }
  if (parseIsoDate(input.at.slice(0, 10)) === null) return { ok: false, code: 'INVALID_TRANSITION', issues: [{ code: 'AT', field: 'at', message: 'data inválida' }] }
  return {
    ok: true,
    experiment: {
      ...experiment,
      status: rule.to,
      startedAt: action === 'start' ? input.at : experiment.startedAt,
      endedAt: rule.to === 'COMPLETED' || rule.to === 'CANCELLED' || rule.to === 'INVALIDATED' ? input.at : experiment.endedAt,
      statusReason: rule.needsReason ? reason : action === 'resume' ? null : experiment.statusReason,
      version: experiment.version + 1,
      updatedAt: input.at,
    },
  }
}
