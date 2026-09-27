/**
 * "Continue learning" read model and deterministic learning suggestions.
 * Not "smart recommendations": every item states the rule that produced it.
 */

import type { AcademyLibraryState, AcademyContentItem, AcademyTrack } from './types'
import { deriveAvailability } from './core'
import { nextTrackItem, trackItemViews } from './tracks'

export type ContinueRule = 'CONTINUE_IN_PROGRESS' | 'NEXT_TRACK_ITEM' | 'RESUME_BOOKMARK'

export type ContinueLearningItem = {
  ruleId: ContinueRule
  reason: string
  source: string
  content: AcademyContentItem
  trackId: string | null
  at: string | null
}

const RULE_TEXT: Record<ContinueRule, string> = {
  CONTINUE_IN_PROGRESS: 'Conteúdo em andamento, visto por último mais recentemente.',
  NEXT_TRACK_ITEM: 'Próxima unidade desbloqueada de uma trilha em que você está inscrito.',
  RESUME_BOOKMARK: 'Favorito recente ainda não concluído.',
}

/**
 * Priority: 1) IN_PROGRESS by last seen (desc) 2) next unlocked item of active enrollments
 * (by enrollment date desc) 3) recent bookmarks of non-completed content. Only AVAILABLE or
 * EXTERNAL_ONLY content is ever listed. A content appears once (first rule wins).
 */
export function buildContinueLearning(state: AcademyLibraryState, now: string, limit = 5): ContinueLearningItem[] {
  const byId = new Map(state.items.map((item) => [item.id, item]))
  const usable = (item: AcademyContentItem | undefined): item is AcademyContentItem => Boolean(item) && ['AVAILABLE', 'EXTERNAL_ONLY'].includes(deriveAvailability(item as AcademyContentItem, now))
  const progressOf = (id: string) => state.progress.find((entry) => entry.contentId === id && entry.userId === state.userId)
  const seen = new Set<string>()
  const out: ContinueLearningItem[] = []
  const push = (entry: ContinueLearningItem) => { if (!seen.has(entry.content.id)) { seen.add(entry.content.id); out.push(entry) } }

  const inProgress = state.progress
    .filter((entry) => entry.userId === state.userId && entry.status === 'IN_PROGRESS')
    .sort((a, b) => ((a.lastSeenAt ?? '') < (b.lastSeenAt ?? '') ? 1 : (a.lastSeenAt ?? '') > (b.lastSeenAt ?? '') ? -1 : a.contentId < b.contentId ? -1 : 1))
  for (const entry of inProgress) {
    const item = byId.get(entry.contentId)
    if (usable(item)) push({ ruleId: 'CONTINUE_IN_PROGRESS', reason: RULE_TEXT.CONTINUE_IN_PROGRESS, source: 'Seu progresso', content: item, trackId: null, at: entry.lastSeenAt })
  }

  const enrollments = state.enrollments.filter((entry) => entry.userId === state.userId && entry.status === 'ACTIVE').sort((a, b) => (a.enrolledAt < b.enrolledAt ? 1 : -1))
  for (const enrollment of enrollments) {
    const track = state.tracks.find((entry) => entry.id === enrollment.trackId)
    if (!track || track.publication !== 'PUBLISHED') continue
    const next = nextTrackItem(trackItemViews(track, state.items, state.progress.filter((entry) => entry.userId === state.userId), now))
    if (next?.content && usable(next.content)) push({ ruleId: 'NEXT_TRACK_ITEM', reason: RULE_TEXT.NEXT_TRACK_ITEM, source: `Trilha: ${track.title}`, content: next.content, trackId: track.id, at: enrollment.enrolledAt })
  }

  const bookmarks = state.bookmarks.filter((entry) => entry.userId === state.userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : 1))
  for (const bookmark of bookmarks) {
    const item = byId.get(bookmark.contentId)
    if (usable(item) && progressOf(bookmark.contentId)?.status !== 'COMPLETED') push({ ruleId: 'RESUME_BOOKMARK', reason: RULE_TEXT.RESUME_BOOKMARK, source: 'Seus favoritos', content: item, trackId: null, at: bookmark.createdAt })
  }
  return out.slice(0, limit)
}

export type LearningSuggestion = { ruleId: string; reason: string; source: string; title: string; contentId: string | null; trackId: string | null }

/** Deterministic suggestions. Each carries rule_id, reason and source. */
export function learningSuggestions(state: AcademyLibraryState, now: string): LearningSuggestion[] {
  const out: LearningSuggestion[] = []
  const continueItems = buildContinueLearning(state, now, 20)
  for (const item of continueItems) {
    if (item.ruleId === 'CONTINUE_IN_PROGRESS') {
      const progress = state.progress.find((entry) => entry.contentId === item.content.id && entry.userId === state.userId)
      const policy = item.content.completion
      const threshold = policy.kind === 'READING_THRESHOLD' || policy.kind === 'PLAYBACK_THRESHOLD' ? policy.thresholdBps : null
      if (threshold !== null && progress?.progress.kind === 'KNOWN' && progress.progress.value >= threshold - 1500 && progress.progress.value < threshold) {
        out.push({ ruleId: 'COMPLETE_ALMOST_FINISHED', reason: `Progresso medido a menos de 15 pontos percentuais do limiar declarado (${threshold / 100}%).`, source: 'Seu progresso', title: `Falta pouco: ${item.content.title}`, contentId: item.content.id, trackId: null })
      } else {
        out.push({ ruleId: 'CONTINUE_IN_PROGRESS', reason: item.reason, source: item.source, title: `Continuar: ${item.content.title}`, contentId: item.content.id, trackId: null })
      }
    } else if (item.ruleId === 'NEXT_TRACK_ITEM') out.push({ ruleId: 'NEXT_TRACK_ITEM', reason: item.reason, source: item.source, title: `Próxima unidade: ${item.content.title}`, contentId: item.content.id, trackId: item.trackId })
    else out.push({ ruleId: 'RESUME_BOOKMARK', reason: item.reason, source: item.source, title: `Retomar favorito: ${item.content.title}`, contentId: item.content.id, trackId: null })
  }
  const completedWithNotes = state.notes
    .filter((note) => note.userId === state.userId && state.progress.some((entry) => entry.contentId === note.contentId && entry.userId === state.userId && entry.status === 'COMPLETED'))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : a.id < b.id ? -1 : 1))
  const oldest = completedWithNotes[0]
  if (oldest) {
    const item = state.items.find((entry) => entry.id === oldest.contentId)
    if (item) out.push({ ruleId: 'REVIEW_NOTE', reason: 'Nota mais antiga de um conteúdo já concluído.', source: 'Suas notas', title: `Revisar sua nota em: ${item.title}`, contentId: item.id, trackId: null })
  }
  return out
}

export function activeTracks(state: AcademyLibraryState): AcademyTrack[] {
  const ids = new Set(state.enrollments.filter((entry) => entry.userId === state.userId && entry.status === 'ACTIVE').map((entry) => entry.trackId))
  return state.tracks.filter((track) => ids.has(track.id) && track.publication === 'PUBLISHED')
}
