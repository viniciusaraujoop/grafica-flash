/**
 * Orçaly Growth — domain types (isolated MVP, pure TypeScript).
 *
 * Growth is an Experiment OS scoped to a COMPANY. It never fabricates
 * causality, never declares a winner without declared criteria and never
 * invents market benchmarks. Every number carries its provenance.
 */

export const EXPERIMENT_STATUSES = ['DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'INVALIDATED'] as const
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]

/** Board columns (terminal CANCELLED/INVALIDATED are listed separately, never on the board). */
export const BOARD_STATUSES = ['DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED'] as const satisfies readonly ExperimentStatus[]

/** Allowed conclusions. There is deliberately no WINNER/LOSER. */
export const RESULT_OUTCOMES = ['INCONCLUSIVE', 'DIRECTIONAL_SIGNAL', 'MEETS_DECLARED_CRITERIA', 'DOES_NOT_MEET_DECLARED_CRITERIA', 'INSUFFICIENT_DATA'] as const
export type ResultOutcome = (typeof RESULT_OUTCOMES)[number]

/** Where a value came from. UNKNOWN is never rendered as zero. */
export const PROVENANCES = ['DECLARED', 'MEASURED', 'CALCULATED', 'UNKNOWN'] as const
export type Provenance = (typeof PROVENANCES)[number]

export const SOURCE_STATUSES = ['MANUAL', 'CONNECTED', 'STALE', 'ERROR', 'NOT_CONFIGURED', 'BLOCKED_EXTERNAL'] as const
export type SourceStatus = (typeof SOURCE_STATUSES)[number]

export const BASE_METRICS = ['impressions', 'clicks', 'leads', 'conversions', 'spend_cents', 'revenue_cents'] as const
export type BaseMetricKey = (typeof BASE_METRICS)[number]

export const DERIVED_METRICS = ['ctr', 'cpc', 'cpl', 'conversion_rate', 'cac', 'roas'] as const
export type DerivedMetricKey = (typeof DERIVED_METRICS)[number]

export type MetricKey = BaseMetricKey | DerivedMetricKey | `custom:${string}`
export type MetricUnit = 'count' | 'cents' | 'ratio' | 'percent'
export type Direction = 'increase' | 'decrease'

/** A single value with provenance. `value` is an exact integer (count or cents) — never a float. */
export type MetricValue =
  | { provenance: 'DECLARED' | 'MEASURED'; value: bigint }
  | { provenance: 'CALCULATED'; ratio: { numerator: bigint; denominator: bigint }; unit: MetricUnit }
  | { provenance: 'UNKNOWN'; reason: string }

export type GrowthTimeWindow = {
  /** ISO date YYYY-MM-DD, inclusive. */
  start: string
  /** ISO date YYYY-MM-DD, inclusive. */
  end: string
}

export type GrowthSource = {
  id: string
  label: string
  kind: 'manual' | 'meta_ads' | 'google_ads' | 'google_analytics' | 'tiktok_ads'
  status: SourceStatus
  /** ISO timestamp of the last value received, or null. */
  lastObservedAt: string | null
}

export type GrowthMetric = {
  key: MetricKey
  label: string
  unit: MetricUnit
  /** Direction that counts as improvement. Cost metrics improve when they decrease. */
  better: Direction
}

/** Declared success criterion. Thresholds are integers in basis points (1 bp = 0.01%). */
export type SuccessCriteria = {
  metric: MetricKey
  comparator: 'relative_change_at_least' | 'relative_change_at_most'
  thresholdBps: number
  /** Minimum observations per arm on the metric's denominator (e.g. clicks for conversion rate). */
  minSamplePerArm: number
  minimumDurationDays: number
}

export type Baseline = { metric: MetricKey; value: MetricValue; window: GrowthTimeWindow; source: string } | null

export type GrowthHypothesis = {
  id: string
  statement: string
  expectedDirection: Direction
  primaryMetric: MetricKey
  baseline: Baseline
  successCriteria: SuccessCriteria | null
  minimumDurationDays: number
  observationWindow: GrowthTimeWindow | null
  assumptions: readonly string[]
  risks: readonly string[]
  /** Who/what originated the hypothesis (person, prior learning id, customer interview…). */
  source: string
  provenance: 'DECLARED'
}

export type GrowthVariant = { id: string; label: string; role: 'control' | 'variant'; description: string }

export type GrowthObservation = {
  id: string
  experimentId: string
  variantId: string
  window: GrowthTimeWindow
  sourceId: string
  provenance: 'DECLARED' | 'MEASURED'
  /** Exact integers only. Missing keys mean UNKNOWN, not zero. */
  values: Partial<Record<BaseMetricKey, bigint>> & { custom?: Readonly<Record<string, bigint>> }
  evidenceUrl: string | null
  recordedAt: string
}

export type ArmSummary = {
  variantId: string
  role: 'control' | 'variant'
  sample: bigint | null
  primary: MetricValue
  metrics: Readonly<Record<string, MetricValue>>
}

export type GrowthResult = {
  experimentId: string
  outcome: ResultOutcome
  window: GrowthTimeWindow | null
  arms: readonly ArmSummary[]
  /** Relative change of each variant vs control on the primary metric, in basis points (rounded half away from zero). */
  relativeChangeBps: Readonly<Record<string, number | null>>
  /** Statistical method used, if any. MVP: NONE — significance is never claimed. */
  confidence: { method: 'NONE'; note: string }
  reasons: readonly string[]
}

export type LearningKind = 'FACT' | 'INTERPRETATION' | 'DECISION'

export type GrowthLearning = {
  id: string
  experimentId: string
  kind: LearningKind
  /** FACT: what was observed. INTERPRETATION: what we think it means. DECISION: what we will do. */
  text: string
  observationIds: readonly string[]
  limitation: string | null
  decisionReceiptId: string | null
  createdAt: string
}

export type GrowthDecision = {
  id: string
  experimentId: string
  action: 'adopt_variant' | 'keep_control' | 'iterate' | 'extend_test' | 'stop' | 'invalidate'
  rationale: string
  decidedBy: string
  decidedAt: string
}

export type GrowthEvidence = {
  observationIds: readonly string[]
  sourceIds: readonly string[]
  window: GrowthTimeWindow | null
}

export type GrowthExperiment = {
  id: string
  companyId: string
  title: string
  status: ExperimentStatus
  hypothesis: GrowthHypothesis | null
  variants: readonly GrowthVariant[]
  /** Single-arm experiments (e.g. before/after with declared baseline) must set this explicitly. */
  singleArm: boolean
  metrics: readonly GrowthMetric[]
  startedAt: string | null
  endedAt: string | null
  version: number
  updatedAt: string
  statusReason: string | null
}
