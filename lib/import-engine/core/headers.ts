// Header validation (§9, preflight §13/§14). Headers are user data: they are validated by index and
// NEVER become object keys. Canonical form (trim + NFC + lower-case + whitespace collapse) is used for
// duplicate detection and alias lookup only.

import { codePointLength } from './encoding'
import { BoundedIssues } from './issues'
import { IMPORT_LIMITS } from './types'

export type HeaderInfo = { index: number; raw: string; canonical: string; reservedKey: string }

/** Identifier canonicalization. `toLowerCase` is locale-independent (unlike toLocaleLowerCase). */
export function canonicalHeader(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Key used for reserved-name matching: separators (space, _, -, .) are equivalent. */
export function reservedKey(canonical: string): string {
  return canonical.replace(/[\s_.-]+/g, '_')
}

export function columnId(index: number): string {
  return `col:${index}`
}

/** Returns validated header infos; blocking issues are added to `issues`. */
export function validateHeaders(header: readonly string[], issues: BoundedIssues): { headers: HeaderInfo[]; blocking: boolean } {
  let blocking = false
  const headers: HeaderInfo[] = []
  const firstIndexByCanonical = new Map<string, number>()
  const reportedDuplicate = new Set<number>()
  header.forEach((raw, index) => {
    const canonical = canonicalHeader(raw)
    headers.push({ index, raw, canonical, reservedKey: reservedKey(canonical) })
    if (!canonical) {
      issues.add('HEADER_EMPTY', 'error', 1, columnId(index))
      blocking = true
      return
    }
    if (codePointLength(raw) > IMPORT_LIMITS.maxHeaderChars) {
      issues.add('HEADER_TOO_LONG', 'error', 1, columnId(index), { maxChars: IMPORT_LIMITS.maxHeaderChars, valueLength: codePointLength(raw) })
      blocking = true
    }
    const first = firstIndexByCanonical.get(canonical)
    if (first === undefined) firstIndexByCanonical.set(canonical, index)
    else {
      // Never "last column wins": every colliding column is reported and the file is blocked.
      if (!reportedDuplicate.has(first)) {
        issues.add('DUPLICATE_HEADER', 'error', 1, columnId(first), { duplicateOf: columnId(first) })
        reportedDuplicate.add(first)
      }
      issues.add('DUPLICATE_HEADER', 'error', 1, columnId(index), { duplicateOf: columnId(first) })
      blocking = true
    }
  })
  return { headers, blocking }
}
