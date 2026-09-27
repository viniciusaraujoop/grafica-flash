/**
 * Local, deterministic library search. Metadata only (title, subtitle, author,
 * categories, tags) — never the full text of protected content. No AI, no provider.
 */

import type { AcademyCategory, AcademyContentItem, AcademySearchDocument, AcademyTrack } from './types'

export const MAX_QUERY_LENGTH = 100
export const MAX_QUERY_TOKENS = 8

/** Lowercase, strip diacritics, drop punctuation/control chars, collapse spaces, bounded. */
export function normalizeText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function normalizeQuery(query: string): string[] {
  return normalizeText(query.slice(0, MAX_QUERY_LENGTH)).split(' ').filter(Boolean).slice(0, MAX_QUERY_TOKENS)
}

export function toSearchDocuments(items: readonly AcademyContentItem[], tracks: readonly AcademyTrack[], categories: readonly AcademyCategory[]): AcademySearchDocument[] {
  const label = (id: string) => categories.find((category) => category.id === id)?.label ?? id
  return [
    ...items.map((item) => ({ id: item.id, kind: 'CONTENT' as const, title: item.title, subtitle: item.subtitle ?? '', author: item.author?.name ?? '', categories: item.categories.map(label), tags: item.tags })),
    ...tracks.map((track) => ({ id: track.id, kind: 'TRACK' as const, title: track.title, subtitle: track.description, author: '', categories: track.categories.map(label), tags: [] })),
  ]
}

export class DuplicateSearchDocumentError extends Error {}

/** Builds the index; duplicate ids with different content are a data error, identical duplicates collapse. */
export function buildSearchIndex(documents: readonly AcademySearchDocument[]): AcademySearchDocument[] {
  const byKey = new Map<string, AcademySearchDocument>()
  for (const document of documents) {
    const key = `${document.kind}:${document.id}`
    const existing = byKey.get(key)
    if (existing && JSON.stringify(existing) !== JSON.stringify(document)) throw new DuplicateSearchDocumentError(`documento duplicado com conteúdo divergente: ${key}`)
    byKey.set(key, document)
  }
  return [...byKey.values()]
}

const FIELD_WEIGHTS = { title: 100, subtitle: 40, author: 50, categories: 30, tags: 30 } as const

/** Per token: best field match (exact word ×2, word prefix ×1.5, substring ×1) × field weight; AND across tokens. */
export function scoreDocument(document: AcademySearchDocument, tokens: readonly string[]): number {
  if (!tokens.length) return 0
  const fields: Record<keyof typeof FIELD_WEIGHTS, string> = {
    title: normalizeText(document.title), subtitle: normalizeText(document.subtitle), author: normalizeText(document.author),
    categories: normalizeText(document.categories.join(' ')), tags: normalizeText(document.tags.join(' ')),
  }
  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const [field, text] of Object.entries(fields) as Array<[keyof typeof FIELD_WEIGHTS, string]>) {
      if (!text) continue
      const words = text.split(' ')
      const factor = words.includes(token) ? 2 : words.some((word) => word.startsWith(token)) ? 1.5 : text.includes(token) ? 1 : 0
      best = Math.max(best, factor * FIELD_WEIGHTS[field])
    }
    if (!best) return 0
    total += best
  }
  return total
}

export type SearchHit = { document: AcademySearchDocument; score: number }

/** Stable: score desc → TRACK before CONTENT on ties → normalized title → id. */
export function searchLibrary(index: readonly AcademySearchDocument[], query: string, limit = 50): SearchHit[] {
  const tokens = normalizeQuery(query)
  if (!tokens.length) return []
  return index
    .map((document) => ({ document, score: scoreDocument(document, tokens) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.document.kind !== b.document.kind) return a.document.kind === 'TRACK' ? -1 : 1
      const ta = normalizeText(a.document.title); const tb = normalizeText(b.document.title)
      if (ta !== tb) return ta < tb ? -1 : 1
      return a.document.id < b.document.id ? -1 : a.document.id > b.document.id ? 1 : 0
    })
    .slice(0, Math.max(1, Math.min(limit, 100)))
}
