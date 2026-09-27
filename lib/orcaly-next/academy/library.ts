/**
 * Library filtering/sorting and future routes. Pure; UI passes the result straight to render.
 */

import type { AcademyContentItem, AcademyProgress, Availability, ContentType, ProgressStatus } from './types'
import { deriveAvailability, isSafeId } from './core'
import { normalizeText } from './search'

export const ACADEMY_ROUTES = {
  home: '/apps/academy',
  library: '/apps/academy/biblioteca',
  notes: '/apps/academy/notas',
  bookmarks: '/apps/academy/favoritos',
} as const

export function trackHref(id: string): string | null { return isSafeId(id) ? `/apps/academy/trilhas/${id}` : null }
export function readHref(id: string, anchor?: string): string | null {
  if (!isSafeId(id)) return null
  return anchor && /^[a-z][a-z0-9-]{0,63}$/.test(anchor) ? `/apps/academy/ler/${id}#${anchor}` : `/apps/academy/ler/${id}`
}

export type LibraryFilter = {
  type: ContentType | 'ALL'
  category: string | 'ALL'
  status: ProgressStatus | 'ALL'
  availability: Availability | 'ALL'
  language: string | 'ALL'
  sort: 'title' | 'recent' | 'duration'
}

export const DEFAULT_FILTER: LibraryFilter = { type: 'ALL', category: 'ALL', status: 'ALL', availability: 'ALL', language: 'ALL', sort: 'title' }

export type LibraryRow = { item: AcademyContentItem; availability: Availability; status: ProgressStatus }

/** Filters with AND semantics; unknown durations sort last (never as zero). Stable ties by id. */
export function filterLibrary(items: readonly AcademyContentItem[], progress: readonly AcademyProgress[], filter: LibraryFilter, now: string): LibraryRow[] {
  const statusOf = (id: string): ProgressStatus => progress.find((entry) => entry.contentId === id)?.status ?? 'NOT_STARTED'
  const rows = items
    .filter((item) => item.publication !== 'DRAFT') // drafts are editorial, never in the learner library
    .map((item) => ({ item, availability: deriveAvailability(item, now), status: statusOf(item.id) }))
    .filter((row) => filter.type === 'ALL' || row.item.type === filter.type)
    .filter((row) => filter.category === 'ALL' || row.item.categories.includes(filter.category))
    .filter((row) => filter.status === 'ALL' || row.status === filter.status)
    .filter((row) => filter.availability === 'ALL' || row.availability === filter.availability)
    .filter((row) => filter.language === 'ALL' || row.item.language === filter.language)
  const byId = (a: LibraryRow, b: LibraryRow) => (a.item.id < b.item.id ? -1 : 1)
  if (filter.sort === 'recent') return rows.sort((a, b) => ((a.item.publishedAt ?? '') < (b.item.publishedAt ?? '') ? 1 : (a.item.publishedAt ?? '') > (b.item.publishedAt ?? '') ? -1 : byId(a, b)))
  if (filter.sort === 'duration') return rows.sort((a, b) => {
    const da = a.item.duration.kind === 'KNOWN' ? (a.item.type === 'VIDEO' || a.item.type === 'AUDIO' ? a.item.duration.value : a.item.duration.value * 60) : Number.POSITIVE_INFINITY
    const db = b.item.duration.kind === 'KNOWN' ? (b.item.type === 'VIDEO' || b.item.type === 'AUDIO' ? b.item.duration.value : b.item.duration.value * 60) : Number.POSITIVE_INFINITY
    return da !== db ? da - db : byId(a, b)
  })
  return rows.sort((a, b) => { const ta = normalizeText(a.item.title); const tb = normalizeText(b.item.title); return ta !== tb ? (ta < tb ? -1 : 1) : byId(a, b) })
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = { ARTICLE: 'Artigo', LESSON: 'Lição', VIDEO: 'Vídeo', AUDIO: 'Áudio', DOCUMENT: 'Documento', COURSE: 'Curso', TRACK: 'Trilha' }
export const PROGRESS_LABEL: Record<ProgressStatus, string> = { NOT_STARTED: 'Não iniciado', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído' }

/** Duration unit by type: media in seconds, reading in minutes. */
export function durationUnit(item: AcademyContentItem): 'seconds' | 'minutes' {
  return item.type === 'VIDEO' || item.type === 'AUDIO' ? 'seconds' : 'minutes'
}
