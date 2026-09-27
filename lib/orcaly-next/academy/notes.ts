/**
 * Private notes and bookmarks.
 * Notes are plain text (rendered as text nodes, never as HTML), bounded, versioned (CAS).
 * Note content never goes into a URL. Bookmarks are idempotent and independent of progress/notes.
 */

import type { AcademyBookmark, AcademyContentItem, AcademyNote } from './types'
import { isSafeAnchor } from './core'

export const NOTE_MIN = 1
export const NOTE_MAX = 4000

export type NoteResult = { ok: true; note: AcademyNote } | { ok: false; code: 'EMPTY' | 'TOO_LONG' | 'CONTROL_CHARS' | 'VERSION_CONFLICT' | 'BAD_TARGET' | 'NOT_OWNER'; message: string }

/** Trim, normalize newlines, reject control characters (other than \n and \t). HTML is kept as literal text, never interpreted. */
export function normalizeNoteText(text: string): { ok: true; text: string } | { ok: false; code: 'EMPTY' | 'TOO_LONG' | 'CONTROL_CHARS'; message: string } {
  const normalized = text.replace(/\r\n?/g, '\n').normalize('NFC').trim()
  if (/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/.test(normalized)) return { ok: false, code: 'CONTROL_CHARS', message: 'caracteres de controle não são permitidos' }
  if ([...normalized].length < NOTE_MIN) return { ok: false, code: 'EMPTY', message: 'nota vazia' }
  if ([...normalized].length > NOTE_MAX) return { ok: false, code: 'TOO_LONG', message: `até ${NOTE_MAX} caracteres` }
  return { ok: true, text: normalized }
}

function validTarget(item: AcademyContentItem, anchor: string | null, seconds: number | null): boolean {
  if (anchor !== null && seconds !== null) return false
  if (anchor !== null) return isSafeAnchor(anchor) && (!item.sections || item.sections.some((section) => section.anchor === anchor))
  if (seconds !== null) return (item.type === 'VIDEO' || item.type === 'AUDIO') && Number.isInteger(seconds) && seconds >= 0 && (item.duration.kind !== 'KNOWN' || seconds <= item.duration.value)
  return true
}

export function createNote(item: AcademyContentItem, input: { id: string; userId: string; text: string; anchor?: string | null; seconds?: number | null; at: string }): NoteResult {
  const anchor = input.anchor ?? null
  const seconds = input.seconds ?? null
  if (!validTarget(item, anchor, seconds)) return { ok: false, code: 'BAD_TARGET', message: 'seção ou tempo inválido para este conteúdo' }
  const text = normalizeNoteText(input.text)
  if (!text.ok) return text
  return { ok: true, note: { id: input.id, userId: input.userId, contentId: item.id, anchor, seconds, text: text.text, createdAt: input.at, updatedAt: input.at, version: 1, sample: false } }
}

export function updateNote(note: AcademyNote, input: { userId: string; text: string; expectedVersion: number; at: string }): NoteResult {
  if (note.userId !== input.userId) return { ok: false, code: 'NOT_OWNER', message: 'nota de outra pessoa' }
  if (note.version !== input.expectedVersion) return { ok: false, code: 'VERSION_CONFLICT', message: 'a nota foi alterada em outro lugar; recarregue antes de salvar' }
  const text = normalizeNoteText(input.text)
  if (!text.ok) return text
  return { ok: true, note: { ...note, text: text.text, updatedAt: input.at, version: note.version + 1 } }
}

/** Routes carry only the note id — never its text. */
export function noteHref(note: Pick<AcademyNote, 'id' | 'contentId'>): string {
  return `/apps/academy/notas#nota-${note.id}`
}

export function bookmarkKey(bookmark: Pick<AcademyBookmark, 'userId' | 'contentId' | 'target'>): string {
  const target = bookmark.target.kind === 'CONTENT' ? 'content' : bookmark.target.kind === 'ANCHOR' ? `anchor:${bookmark.target.anchor}` : `seconds:${bookmark.target.seconds}`
  return `${bookmark.userId}|${bookmark.contentId}|${target}`
}

/** Idempotent: adding the same target twice returns the same list (and the existing bookmark). */
export function addBookmark(list: readonly AcademyBookmark[], item: AcademyContentItem, input: Omit<AcademyBookmark, 'contentId'>): { ok: true; list: AcademyBookmark[]; bookmark: AcademyBookmark; created: boolean } | { ok: false; message: string } {
  const target = input.target
  if (target.kind === 'ANCHOR' && !validTarget(item, target.anchor, null)) return { ok: false, message: 'seção inválida' }
  if (target.kind === 'SECONDS' && !validTarget(item, null, target.seconds)) return { ok: false, message: 'tempo inválido' }
  const candidate: AcademyBookmark = { ...input, contentId: item.id }
  const existing = list.find((bookmark) => bookmarkKey(bookmark) === bookmarkKey(candidate))
  if (existing) return { ok: true, list: [...list], bookmark: existing, created: false }
  return { ok: true, list: [...list, candidate], bookmark: candidate, created: true }
}

/** Removes only the bookmark. Progress, notes and history are untouched by construction. */
export function removeBookmark(list: readonly AcademyBookmark[], bookmarkId: string, userId: string): AcademyBookmark[] {
  return list.filter((bookmark) => !(bookmark.id === bookmarkId && bookmark.userId === userId))
}
