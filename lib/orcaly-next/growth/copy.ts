/** UI copy and tones for Growth states. Text always accompanies color. */

import type { Tone } from '../product-status'
import type { ExperimentStatus, Provenance, ResultOutcome } from './types'

export const EXPERIMENT_STATUS_COPY: Record<ExperimentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  READY: { label: 'Pronto', tone: 'info' },
  RUNNING: { label: 'Em andamento', tone: 'accent' },
  PAUSED: { label: 'Pausado', tone: 'warning' },
  COMPLETED: { label: 'Concluído', tone: 'success' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
  INVALIDATED: { label: 'Invalidado', tone: 'danger' },
}

export const OUTCOME_TONE: Record<ResultOutcome, Tone> = {
  MEETS_DECLARED_CRITERIA: 'success',
  DOES_NOT_MEET_DECLARED_CRITERIA: 'neutral',
  DIRECTIONAL_SIGNAL: 'info',
  INCONCLUSIVE: 'neutral',
  INSUFFICIENT_DATA: 'warning',
}

export const PROVENANCE_COPY: Record<Provenance, string> = {
  DECLARED: 'Declarado',
  MEASURED: 'Medido',
  CALCULATED: 'Calculado',
  UNKNOWN: 'Desconhecido',
}

export const DIRECTION_COPY = { increase: 'Aumentar', decrease: 'Reduzir' } as const

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [year, month, day] = iso.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}
