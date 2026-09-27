/**
 * Experiment setup: turns raw form fields into a DRAFT experiment and reports
 * which requirements are still missing before it can run. Pure and testable.
 */

import type { Direction, GrowthExperiment, GrowthVariant, MetricKey } from './types'
import { METRIC_CATALOGUE } from './metrics'
import { isMetricKey, readinessIssues, type Issue } from './experiment'

export type SetupForm = {
  title: string
  statement: string
  primaryMetric: string
  direction: string
  thresholdPercent: string
  minSamplePerArm: string
  minimumDurationDays: string
  windowStart: string
  windowEnd: string
  controlLabel: string
  variantLabel: string
  source: string
  assumptions: string
  risks: string
}

export const EMPTY_SETUP: SetupForm = {
  title: '', statement: '', primaryMetric: 'conversion_rate', direction: 'increase', thresholdPercent: '', minSamplePerArm: '',
  minimumDurationDays: '14', windowStart: '', windowEnd: '', controlLabel: 'A · Controle', variantLabel: 'B · Variante', source: '', assumptions: '', risks: '',
}

/** "10" / "10,5" / "0,25" → basis points (always positive here; sign comes from direction). Null when malformed. */
export function parsePercentToBps(input: string): number | null {
  const text = input.trim()
  const match = /^(\d{1,4})(?:,(\d{1,2}))?$/.exec(text)
  if (!match) return null
  const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return bps > 0 && bps <= 100000 ? bps : null
}

function positiveInt(input: string, max: number): number | null {
  if (!/^\d{1,10}$/.test(input.trim())) return null
  const value = Number(input.trim())
  return value >= 1 && value <= max ? value : null
}

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)

export type SetupEvaluation = { draft: GrowthExperiment; issues: Issue[]; fieldErrors: Partial<Record<keyof SetupForm, string>> }

export function evaluateSetup(form: SetupForm, context: { id: string; companyId: string; now: string }): SetupEvaluation {
  const fieldErrors: Partial<Record<keyof SetupForm, string>> = {}
  const metric: MetricKey = isMetricKey(form.primaryMetric) ? form.primaryMetric : 'conversion_rate'
  if (!isMetricKey(form.primaryMetric)) fieldErrors.primaryMetric = 'Escolha uma métrica da lista.'
  const direction: Direction = form.direction === 'decrease' ? 'decrease' : 'increase'
  const bps = parsePercentToBps(form.thresholdPercent)
  if (form.thresholdPercent.trim() && bps === null) fieldErrors.thresholdPercent = 'Use um percentual entre 0,01 e 1000 (ex.: 10 ou 7,5).'
  const sample = positiveInt(form.minSamplePerArm, 1_000_000_000)
  if (form.minSamplePerArm.trim() && sample === null) fieldErrors.minSamplePerArm = 'Número inteiro a partir de 1.'
  const duration = positiveInt(form.minimumDurationDays, 365)
  if (duration === null) fieldErrors.minimumDurationDays = 'Entre 1 e 365 dias.'
  const window = form.windowStart && form.windowEnd ? { start: form.windowStart, end: form.windowEnd } : null
  const criteria = bps !== null && sample !== null && duration !== null
    ? { metric, comparator: direction === 'increase' ? 'relative_change_at_least' as const : 'relative_change_at_most' as const, thresholdBps: direction === 'increase' ? bps : -bps, minSamplePerArm: sample, minimumDurationDays: duration }
    : null
  const draft: GrowthExperiment = {
    id: context.id, companyId: context.companyId, title: form.title.trim(), status: 'DRAFT', singleArm: false,
    metrics: [METRIC_CATALOGUE[metric as keyof typeof METRIC_CATALOGUE] ?? { key: metric, label: metric, unit: 'count', better: 'increase' }],
    variants: ([
      { id: `${context.id}-a`, label: form.controlLabel.trim(), role: 'control', description: '' },
      { id: `${context.id}-b`, label: form.variantLabel.trim(), role: 'variant', description: '' },
    ] satisfies GrowthVariant[]).filter((variant) => variant.label),
    hypothesis: form.statement.trim() ? {
      id: `${context.id}-h`, statement: form.statement.trim(), expectedDirection: direction, primaryMetric: metric, baseline: null,
      successCriteria: criteria, minimumDurationDays: duration ?? 1, observationWindow: window,
      assumptions: lines(form.assumptions), risks: lines(form.risks), source: form.source.trim(), provenance: 'DECLARED',
    } : null,
    startedAt: null, endedAt: null, version: 1, updatedAt: context.now, statusReason: null,
  }
  const issues = readinessIssues(draft)
  // Report every empty required field at once (readiness alone stops at the first structural gap).
  const REQUIRED: ReadonlyArray<keyof SetupForm> = ['title', 'statement', 'source', 'thresholdPercent', 'minSamplePerArm', 'minimumDurationDays', 'windowStart', 'windowEnd', 'controlLabel', 'variantLabel']
  for (const field of REQUIRED) if (!form[field].trim() && !fieldErrors[field]) fieldErrors[field] = 'Obrigatório.'
  const map: Record<string, keyof SetupForm> = {
    title: 'title', hypothesis: 'statement', statement: 'statement', source: 'source', observationWindow: 'windowEnd',
    successCriteria: 'thresholdPercent', minimumDurationDays: 'minimumDurationDays', variants: 'variantLabel', assumptions: 'assumptions', risks: 'risks',
  }
  for (const issue of issues) {
    const field = map[issue.field.split(/[.[]/)[0]]
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
  }
  return { draft, issues, fieldErrors }
}

/** Human checklist of what "ready to run" means, evaluated against the current issues. */
export const READINESS_CHECKS: ReadonlyArray<{ label: string; codes: readonly string[] }> = [
  { label: 'Título', codes: ['TITLE'] },
  { label: 'Hipótese escrita', codes: ['NO_HYPOTHESIS', 'STATEMENT_LENGTH'] },
  { label: 'Métrica primária e direção', codes: ['PRIMARY_METRIC', 'DIRECTION'] },
  { label: 'Critério de sucesso (variação, amostra e duração)', codes: ['NO_CRITERIA', 'THRESHOLD', 'CRITERIA_DIRECTION', 'MIN_SAMPLE', 'CRITERIA_METRIC', 'CRITERIA_DURATION', 'DURATION'] },
  { label: 'Janela de observação', codes: ['NO_WINDOW', 'WINDOW_INVALID', 'WINDOW_TOO_SHORT'] },
  { label: 'Controle e variante', codes: ['NEEDS_CONTROL', 'NEEDS_VARIANT', 'DUPLICATE_VARIANT', 'TOO_MANY_VARIANTS'] },
  { label: 'Origem da hipótese', codes: ['SOURCE'] },
]
