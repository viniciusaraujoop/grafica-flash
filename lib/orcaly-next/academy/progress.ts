/**
 * Progress, resume position, explicit completion and learning sessions.
 * Opening content never completes it. Time with a tab open is never "study time".
 */

import type { AcademyCompletionEvent, AcademyContentItem, AcademyLearningSession, AcademyProgress, Known, ResumePosition } from './types'
import { AcademyInputError, isSafeAnchor, known, parseBps, unknown } from './core'

export type ProgressResult = { ok: true; progress: AcademyProgress } | { ok: false; code: 'VERSION_CONFLICT' | 'INVALID_POSITION' | 'INVALID_PROGRESS' | 'NOT_ALLOWED'; message: string }

/** Validates a resume position against the content's known structure/duration. */
export function validatePosition(item: AcademyContentItem, position: ResumePosition): string | null {
  if (position.kind === 'ANCHOR') {
    if (item.type !== 'ARTICLE' && item.type !== 'LESSON') return 'âncora só vale para artigo/lição'
    if (!isSafeAnchor(position.anchor)) return 'âncora inválida'
    if (item.sections && !item.sections.some((section) => section.anchor === position.anchor)) return 'âncora inexistente neste conteúdo'
    return null
  }
  if (position.kind === 'SECONDS') {
    if (item.type !== 'VIDEO' && item.type !== 'AUDIO') return 'posição em segundos só vale para vídeo/áudio'
    if (!Number.isInteger(position.seconds) || position.seconds < 0) return 'posição negativa ou não inteira'
    if (item.duration.kind === 'KNOWN' && position.seconds > item.duration.value) return 'posição além da duração conhecida'
    return null
  }
  if (item.type !== 'DOCUMENT') return 'página só vale para documento'
  if (!Number.isInteger(position.page) || position.page < 1) return 'página deve ser inteiro ≥ 1'
  if (item.pages.kind === 'KNOWN' && position.page > item.pages.value) return 'página além do total conhecido'
  return null
}

export function emptyProgress(contentId: string, userId: string): AcademyProgress {
  return { contentId, userId, status: 'NOT_STARTED', startedAt: null, lastSeenAt: null, completedAt: null, position: null, progress: unknown('ainda não aberto'), version: 0 }
}

/** Opening: NOT_STARTED → IN_PROGRESS. Never completes. Progress stays UNKNOWN until measured. */
export function openContent(current: AcademyProgress, at: string): AcademyProgress {
  if (current.status === 'COMPLETED') return { ...current, lastSeenAt: at, version: current.version + 1 }
  return { ...current, status: 'IN_PROGRESS', startedAt: current.startedAt ?? at, lastSeenAt: at, version: current.version + 1 }
}

/** Records measured progress and/or position with CAS. Does NOT complete, even at 10000 bps. */
export function updateProgress(item: AcademyContentItem, current: AcademyProgress, input: { expectedVersion: number; at: string; progressBps?: unknown; position?: ResumePosition }): ProgressResult {
  if (input.expectedVersion !== current.version) return { ok: false, code: 'VERSION_CONFLICT', message: 'progresso alterado em outro dispositivo; recarregue' }
  let measured: Known<number> = current.progress
  if (input.progressBps !== undefined) {
    try { measured = known(parseBps('progressBps', input.progressBps)) } catch (error) { return { ok: false, code: 'INVALID_PROGRESS', message: (error as Error).message } }
  }
  if (input.position) {
    const problem = validatePosition(item, input.position)
    if (problem) return { ok: false, code: 'INVALID_POSITION', message: problem }
  }
  return {
    ok: true,
    progress: {
      ...current,
      status: current.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      startedAt: current.startedAt ?? input.at,
      lastSeenAt: input.at,
      position: input.position ?? current.position,
      progress: measured,
      version: current.version + 1,
    },
  }
}

export type CompletionCheck = { allowed: boolean; reason: string }

/** Whether the item's DECLARED policy allows an explicit completion right now. */
export function canComplete(item: AcademyContentItem, progress: AcademyProgress, availability: string): CompletionCheck {
  if (availability !== 'AVAILABLE' && availability !== 'EXTERNAL_ONLY') return { allowed: false, reason: 'conteúdo indisponível ou bloqueado não pode ser concluído' }
  const policy = item.completion
  if (policy.kind === 'MANUAL') return { allowed: true, reason: 'conclusão manual declarada pelo usuário' }
  if (policy.kind === 'ALL_REQUIRED_ITEMS') return { allowed: false, reason: 'concluído automaticamente quando todos os itens obrigatórios forem concluídos' }
  if (progress.progress.kind !== 'KNOWN') return { allowed: false, reason: 'progresso não medido; limiar não pode ser verificado' }
  const ok = progress.progress.value >= policy.thresholdBps
  return { allowed: ok, reason: ok ? `progresso ${progress.progress.value} ≥ limiar ${policy.thresholdBps} bps` : `progresso ${progress.progress.value} abaixo do limiar ${policy.thresholdBps} bps` }
}

/** Explicit completion (a user action). Returns the event that justifies it. */
export function completeContent(item: AcademyContentItem, current: AcademyProgress, input: { expectedVersion: number; at: string; availability: string; eventId: string }): { ok: true; progress: AcademyProgress; event: AcademyCompletionEvent } | { ok: false; code: 'VERSION_CONFLICT' | 'NOT_ALLOWED'; message: string } {
  if (input.expectedVersion !== current.version) return { ok: false, code: 'VERSION_CONFLICT', message: 'progresso alterado em outro dispositivo; recarregue' }
  if (current.status === 'COMPLETED') return { ok: false, code: 'NOT_ALLOWED', message: 'já concluído' }
  const check = canComplete(item, current, input.availability)
  if (!check.allowed) return { ok: false, code: 'NOT_ALLOWED', message: check.reason }
  return {
    ok: true,
    progress: { ...current, status: 'COMPLETED', startedAt: current.startedAt ?? input.at, lastSeenAt: input.at, completedAt: input.at, version: current.version + 1 },
    event: { id: input.eventId, userId: current.userId, contentId: current.contentId, policy: item.completion.kind, evidence: check.reason, at: input.at },
  }
}

export function validateCompletionPolicy(policy: AcademyContentItem['completion']): string | null {
  if (policy.kind === 'READING_THRESHOLD' || policy.kind === 'PLAYBACK_THRESHOLD') {
    try { parseBps('thresholdBps', policy.thresholdBps) } catch { return 'limiar deve ser declarado em basis points 0..10000' }
    if (policy.thresholdBps === 0) return 'limiar 0 equivaleria a concluir ao abrir'
  }
  return null
}

/**
 * A session. activeSeconds is KNOWN only when the caller provides a reliable measurement;
 * endedAt − startedAt is NEVER used as study time.
 */
export function recordSession(input: { id: string; contentId: string; userId: string; startedAt: string; endedAt: string | null; measuredActiveSeconds?: unknown; resume: ResumePosition | null; completed: boolean }): AcademyLearningSession {
  let active: Known<number> = unknown('tempo ativo não medido de forma confiável')
  if (input.measuredActiveSeconds !== undefined) {
    const value = input.measuredActiveSeconds
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 86_400) throw new AcademyInputError('activeSeconds', 'inteiro entre 0 e 86400')
    active = known(value)
  }
  if (input.endedAt !== null && input.endedAt < input.startedAt) throw new AcademyInputError('endedAt', 'fim antes do início')
  return { id: input.id, contentId: input.contentId, userId: input.userId, startedAt: input.startedAt, endedAt: input.endedAt, activeSeconds: active, resume: input.resume, completion: input.completed ? 'COMPLETED' : 'NONE' }
}
