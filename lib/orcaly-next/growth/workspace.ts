/**
 * Future Growth routes (NOT published) and board/home read models.
 */

import type { GrowthExperiment, GrowthLearning, GrowthObservation, GrowthResult } from './types'
import { BOARD_STATUSES } from './types'
import type { Suggestion } from './suggestions'
import { suggestNextSteps } from './suggestions'
import { evaluateResult } from './results'

export const GROWTH_ROUTES = {
  home: '/apps/growth',
  experiments: '/apps/growth/experimentos',
  learnings: '/apps/growth/aprendizados',
  sources: '/apps/growth/fontes',
} as const

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/

export function experimentHref(id: string): string | null {
  return ID.test(id) ? `${GROWTH_ROUTES.experiments}/${id}` : null
}

export type BoardColumn = { status: (typeof BOARD_STATUSES)[number]; experiments: GrowthExperiment[] }

/** Board columns in fixed order; CANCELLED/INVALIDATED go to `archived`. Stable sort: updatedAt desc, id. */
export function buildBoard(experiments: readonly GrowthExperiment[]): { columns: BoardColumn[]; archived: GrowthExperiment[] } {
  const sorted = [...experiments].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1))
  return {
    columns: BOARD_STATUSES.map((status) => ({ status, experiments: sorted.filter((experiment) => experiment.status === status) })),
    archived: sorted.filter((experiment) => experiment.status === 'CANCELLED' || experiment.status === 'INVALIDATED'),
  }
}

export type GrowthWorkspace = {
  experiments: readonly GrowthExperiment[]
  observations: readonly GrowthObservation[]
  learnings: readonly GrowthLearning[]
  receiptsByExperiment: Readonly<Record<string, number>>
}

export type HomeModel = {
  running: GrowthExperiment[]
  attention: Suggestion[]
  recentResults: Array<{ experiment: GrowthExperiment; result: GrowthResult }>
  learnings: GrowthLearning[]
  nextTests: Suggestion[]
  results: Readonly<Record<string, GrowthResult>>
}

/** Observe (running, results) → Understand (attention, learnings) → Act (next tests). No vanity totals. */
export function buildHome(workspace: GrowthWorkspace, today: string): HomeModel {
  const results: Record<string, GrowthResult> = {}
  const suggestions: Suggestion[] = []
  for (const experiment of workspace.experiments) {
    const result = evaluateResult(experiment, workspace.observations)
    results[experiment.id] = result
    suggestions.push(...suggestNextSteps({
      experiment, result: ['RUNNING', 'PAUSED', 'COMPLETED'].includes(experiment.status) ? result : null,
      learnings: workspace.learnings.filter((learning) => learning.experimentId === experiment.id),
      receiptCount: workspace.receiptsByExperiment[experiment.id] ?? 0, today,
    }))
  }
  return {
    running: workspace.experiments.filter((experiment) => experiment.status === 'RUNNING'),
    attention: suggestions.filter((suggestion) => suggestion.severity === 'attention'),
    recentResults: workspace.experiments
      .filter((experiment) => experiment.status === 'COMPLETED')
      .sort((a, b) => ((a.endedAt ?? '') < (b.endedAt ?? '') ? 1 : -1))
      .slice(0, 4)
      .map((experiment) => ({ experiment, result: results[experiment.id] })),
    learnings: [...workspace.learnings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6),
    nextTests: suggestions.filter((suggestion) => suggestion.severity === 'next'),
    results,
  }
}
