/**
 * Tracks: validation (positions, duplicates, prerequisite cycles, empty published),
 * unlock order and progress. BLOCKED/unavailable items never count as completed.
 */

import type { AcademyContentItem, AcademyProgress, AcademyTrack, AcademyTrackItem, Known } from './types'
import { deriveAvailability, isSafeId, known, unknown } from './core'

export type TrackIssue = { code: string; message: string; contentId?: string }

export function validateTrack(track: AcademyTrack, catalog: readonly AcademyContentItem[]): TrackIssue[] {
  const issues: TrackIssue[] = []
  if (!isSafeId(track.id)) issues.push({ code: 'ID', message: 'id inválido' })
  if (track.title.trim().length < 3 || track.title.length > 120) issues.push({ code: 'TITLE', message: 'título com 3 a 120 caracteres' })
  if (track.description.length > 600) issues.push({ code: 'DESCRIPTION', message: 'descrição até 600 caracteres' })
  if (track.publication === 'PUBLISHED' && !track.items.length) issues.push({ code: 'EMPTY_PUBLISHED', message: 'trilha publicada precisa de pelo menos um item' })
  if (track.items.length > 200) issues.push({ code: 'TOO_MANY_ITEMS', message: 'no máximo 200 itens' })
  const positions = new Set<number>()
  const ids = new Set<string>()
  for (const item of track.items) {
    if (!Number.isInteger(item.position) || item.position < 0) issues.push({ code: 'NEGATIVE_POSITION', message: 'posição deve ser inteiro ≥ 0', contentId: item.contentId })
    if (positions.has(item.position)) issues.push({ code: 'DUPLICATE_POSITION', message: `posição ${item.position} repetida`, contentId: item.contentId })
    if (ids.has(item.contentId)) issues.push({ code: 'DUPLICATE_ITEM', message: 'conteúdo repetido na trilha', contentId: item.contentId })
    positions.add(item.position); ids.add(item.contentId)
    if (!catalog.some((content) => content.id === item.contentId)) issues.push({ code: 'UNKNOWN_CONTENT', message: 'conteúdo inexistente', contentId: item.contentId })
    for (const prerequisite of item.prerequisites) {
      if (prerequisite === item.contentId) issues.push({ code: 'SELF_PREREQUISITE', message: 'item não pode ser pré-requisito de si mesmo', contentId: item.contentId })
      else if (!track.items.some((other) => other.contentId === prerequisite)) issues.push({ code: 'FOREIGN_PREREQUISITE', message: `pré-requisito ${prerequisite} fora da trilha`, contentId: item.contentId })
    }
  }
  const cycle = findPrerequisiteCycle(track.items)
  if (cycle) issues.push({ code: 'PREREQUISITE_CYCLE', message: `ciclo de pré-requisitos: ${cycle.join(' → ')}` })
  if (track.publication === 'PUBLISHED' && track.items.length && !track.items.some((item) => item.required)) issues.push({ code: 'NO_REQUIRED_ITEMS', message: 'trilha publicada precisa de ao menos um item obrigatório' })
  return issues
}

/** DFS cycle detection over prerequisite edges. Returns one cycle path or null. */
export function findPrerequisiteCycle(items: readonly AcademyTrackItem[]): string[] | null {
  const edges = new Map(items.map((item) => [item.contentId, item.prerequisites.filter((id) => id !== item.contentId)]))
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 'done') return null
    if (state.get(id) === 'visiting') return [...stack.slice(stack.indexOf(id)), id]
    state.set(id, 'visiting'); stack.push(id)
    for (const next of edges.get(id) ?? []) { if (edges.has(next)) { const found = visit(next); if (found) return found } }
    stack.pop(); state.set(id, 'done')
    return null
  }
  for (const id of [...edges.keys()].sort()) { const found = visit(id); if (found) return found }
  return null
}

export function orderedItems(track: AcademyTrack): AcademyTrackItem[] {
  return [...track.items].sort((a, b) => a.position - b.position || (a.contentId < b.contentId ? -1 : 1))
}

export type TrackItemView = {
  item: AcademyTrackItem
  content: AcademyContentItem | null
  availability: ReturnType<typeof deriveAvailability> | 'UNAVAILABLE'
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  locked: boolean
  /** Counts toward track completion only when available, required and not blocked. */
  countable: boolean
}

export function trackItemViews(track: AcademyTrack, catalog: readonly AcademyContentItem[], progress: readonly AcademyProgress[], now: string): TrackItemView[] {
  const byContent = new Map(progress.map((entry) => [entry.contentId, entry]))
  const completed = (id: string) => byContent.get(id)?.status === 'COMPLETED'
  return orderedItems(track).map((item) => {
    const content = catalog.find((entry) => entry.id === item.contentId) ?? null
    const availability = content ? deriveAvailability(content, now) : 'UNAVAILABLE'
    const usable = availability === 'AVAILABLE' || availability === 'EXTERNAL_ONLY'
    const status = byContent.get(item.contentId)?.status ?? 'NOT_STARTED'
    return {
      item, content, availability,
      // A blocked item can never be COMPLETED for track purposes, whatever stale progress says.
      status: usable ? status : 'NOT_STARTED',
      locked: item.prerequisites.some((id) => !completed(id)),
      countable: item.required && usable,
    }
  })
}

export type TrackProgressSummary = {
  completedRequired: number
  totalRequired: number
  excludedUnavailable: number
  progress: Known<number>
  complete: boolean
}

/** Required-item completion in basis points. Unavailable required items are excluded AND reported. */
export function trackProgress(views: readonly TrackItemView[]): TrackProgressSummary {
  const countable = views.filter((view) => view.countable)
  const excludedUnavailable = views.filter((view) => view.item.required && !view.countable).length
  const completedRequired = countable.filter((view) => view.status === 'COMPLETED').length
  if (!countable.length) return { completedRequired: 0, totalRequired: 0, excludedUnavailable, progress: unknown('nenhum item obrigatório disponível'), complete: false }
  return {
    completedRequired, totalRequired: countable.length, excludedUnavailable,
    progress: known(Math.floor((completedRequired * 10000) / countable.length)),
    // Complete only when every required item is available and completed: blocked items keep it open.
    complete: excludedUnavailable === 0 && completedRequired === countable.length,
  }
}

/** First unlocked, available, not-completed item in order (the "next unit"). */
export function nextTrackItem(views: readonly TrackItemView[]): TrackItemView | null {
  return views.find((view) => !view.locked && view.status !== 'COMPLETED' && (view.availability === 'AVAILABLE' || view.availability === 'EXTERNAL_ONLY')) ?? null
}
