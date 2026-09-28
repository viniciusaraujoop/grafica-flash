// Duplicate & conflict detection (§21–§23, preflight §18/§19). Map/hash indexes only: O(rows × fields).
// Never merges, never picks a winner, never overwrites. Name alone is never identity (WEAK only).
// Diagnostics carry row numbers and the matched basis — never the matched value.

import { emailKey, parsePhoneValue } from './values'
import { IMPORT_LIMITS, type ConflictCandidate, type DuplicateCandidate, type ExistingSnapshot, type ImportEntity, type ImportRow, type PhoneRegion } from './types'

export type DuplicateResult = {
  duplicateCandidates: DuplicateCandidate[]
  conflicts: ConflictCandidate[]
  totalDuplicateGroups: number
  totalConflictGroups: number
  truncated: boolean
  /** rowNumber set involved in any candidate/conflict (for summary estimates). */
  flaggedRows: Set<number>
}

type Group = { rows: number[]; fingerprints: Set<string>; aux: Set<string> }

function index(map: Map<string, Group>, key: string, row: ImportRow, aux: string | null): void {
  let group = map.get(key)
  if (!group) {
    group = { rows: [], fingerprints: new Set(), aux: new Set() }
    map.set(key, group)
  }
  group.rows.push(row.rowNumber)
  group.fingerprints.add(row.rowFingerprint)
  if (aux !== null) group.aux.add(aux)
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)

/** Name comparison key (review-only): NFC, trim, whitespace collapse, lower-case. */
export function nameKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function detectDuplicates(entity: ImportEntity, rows: readonly ImportRow[], phoneRegion: PhoneRegion, existing: ExistingSnapshot | undefined): DuplicateResult {
  const duplicates: DuplicateCandidate[] = []
  const conflicts: ConflictCandidate[] = []
  const flagged = new Set<number>()
  // Only rows that passed validation participate (invalid rows are already reported).
  const usable = rows.filter((row) => row.status !== 'INVALID')

  const exact = new Map<string, Group>()
  for (const row of usable) index(exact, row.rowFingerprint, row, null)
  for (const group of exact.values()) {
    if (group.rows.length > 1) duplicates.push(dup('EXACT_DUPLICATE_ROW', 'IN_FILE', 'ROW_FINGERPRINT', group.rows, []))
  }

  if (entity === 'CUSTOMERS') {
    const byEmail = new Map<string, Group>()
    const byPhone = new Map<string, Group>()
    const byName = new Map<string, Group>()
    const phoneOf = new Map<number, string | null>()
    const emailOf = new Map<number, string | null>()
    for (const row of usable) {
      const email = text(row.values['customer.email'])
      const phone = text(row.values['customer.phone'])
      const name = text(row.values['customer.name'])
      const eKey = email ? emailKey(email) : null
      const pKey = phone ? parsePhoneValue(phone, phoneRegion)?.key ?? phone : null
      emailOf.set(row.rowNumber, eKey)
      phoneOf.set(row.rowNumber, pKey)
      if (eKey) index(byEmail, eKey, row, pKey)
      if (pKey) index(byPhone, pKey, row, eKey)
      if (name) index(byName, nameKey(name), row, null)
    }
    for (const group of byEmail.values()) {
      if (group.rows.length < 2 || group.fingerprints.size < 2) continue
      duplicates.push(dup('STRONG_DUPLICATE_CANDIDATE', 'IN_FILE', 'EMAIL', group.rows, []))
      if (group.aux.size > 1) conflicts.push(conflict('IDENTITY_CONFLICT', 'EMAIL', 'EMAIL_WITH_DIFFERENT_PHONES', group.rows))
    }
    for (const group of byPhone.values()) {
      if (group.rows.length < 2 || group.fingerprints.size < 2) continue
      duplicates.push(dup('STRONG_DUPLICATE_CANDIDATE', 'IN_FILE', 'PHONE', group.rows, []))
      if (group.aux.size > 1) conflicts.push(conflict('IDENTITY_CONFLICT', 'PHONE', 'PHONE_WITH_DIFFERENT_EMAILS', group.rows))
    }
    for (const group of byName.values()) {
      // Name alone is never identity: review-only WEAK candidate, never a merge.
      if (group.rows.length > 1 && group.fingerprints.size > 1) duplicates.push(dup('WEAK_DUPLICATE_CANDIDATE', 'IN_FILE', 'NAME', group.rows, []))
    }
    if (existing?.customers) {
      const refsByEmail = new Map<string, string[]>()
      const refsByPhone = new Map<string, string[]>()
      for (const entry of existing.customers.slice(0, IMPORT_LIMITS.maxExistingSnapshotEntries)) {
        if (!entry || typeof entry.ref !== 'string' || !entry.ref) continue
        const e = text(entry.email)
        const p = text(entry.phone)
        if (e) pushRef(refsByEmail, emailKey(e), entry.ref)
        if (p) pushRef(refsByPhone, parsePhoneValue(p, phoneRegion)?.key ?? p, entry.ref)
      }
      for (const row of usable) {
        const eKey = emailOf.get(row.rowNumber)
        const pKey = phoneOf.get(row.rowNumber)
        const byE = eKey ? refsByEmail.get(eKey) : undefined
        const byP = pKey ? refsByPhone.get(pKey) : undefined
        if (byE) duplicates.push(dup('STRONG_DUPLICATE_CANDIDATE', 'EXISTING', 'EMAIL', [row.rowNumber], byE))
        if (byP) duplicates.push(dup('STRONG_DUPLICATE_CANDIDATE', 'EXISTING', 'PHONE', [row.rowNumber], byP))
      }
    }
  } else {
    const bySku = new Map<string, Group>()
    for (const row of usable) {
      const sku = text(row.values['product.sku'])
      if (!sku) continue
      // §22 business fields: name, price, category. SKU compared exactly (opaque).
      const business = JSON.stringify([row.values['product.name'] ?? null, row.values['product.price'] ?? null, row.values['product.category'] ?? null])
      index(bySku, sku, row, business)
    }
    for (const group of bySku.values()) {
      if (group.rows.length < 2 || group.fingerprints.size < 2) continue
      if (group.aux.size > 1) conflicts.push(conflict('SKU_CONFLICT', 'SKU', 'SKU_WITH_DIFFERENT_BUSINESS_FIELDS', group.rows))
      else duplicates.push(dup('DUPLICATE_SKU_CANDIDATE', 'IN_FILE', 'SKU', group.rows, []))
    }
    if (existing?.products) {
      const refsBySku = new Map<string, string[]>()
      for (const entry of existing.products.slice(0, IMPORT_LIMITS.maxExistingSnapshotEntries)) {
        if (!entry || typeof entry.ref !== 'string' || !entry.ref) continue
        const sku = text(entry.sku)
        if (sku) pushRef(refsBySku, sku, entry.ref)
      }
      for (const row of usable) {
        const sku = text(row.values['product.sku'])
        const refs = sku ? refsBySku.get(sku) : undefined
        if (refs) duplicates.push(dup('DUPLICATE_SKU_CANDIDATE', 'EXISTING', 'SKU', [row.rowNumber], refs))
      }
    }
  }

  // Canonical order: first row, then second row, then code/basis.
  const orderKey = (rowsList: readonly number[], code: string, basis: string) => [rowsList[0] ?? 0, rowsList[1] ?? 0, code, basis] as const
  const compare = (a: readonly [number, number, string, string], b: readonly [number, number, string, string]) =>
    a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0)
  duplicates.sort((a, b) => compare(orderKey(a.rowNumbers, a.code, `${a.scope}:${a.basis}`), orderKey(b.rowNumbers, b.code, `${b.scope}:${b.basis}`)))
  conflicts.sort((a, b) => compare(orderKey(a.rowNumbers, a.code, a.basis), orderKey(b.rowNumbers, b.code, b.basis)))

  for (const entry of [...duplicates, ...conflicts]) for (const row of entry.rowNumbers) flagged.add(row)

  const cap = IMPORT_LIMITS.maxDuplicateDiagnosticsRetained
  const truncated = duplicates.length + conflicts.length > cap
  const keptConflicts = conflicts.slice(0, cap)
  const keptDuplicates = duplicates.slice(0, Math.max(0, cap - keptConflicts.length))
  return { duplicateCandidates: keptDuplicates, conflicts: keptConflicts, totalDuplicateGroups: duplicates.length, totalConflictGroups: conflicts.length, truncated, flaggedRows: flagged }
}

function pushRef(map: Map<string, string[]>, key: string, ref: string): void {
  const list = map.get(key)
  if (!list) map.set(key, [ref])
  else if (list.length < IMPORT_LIMITS.maxRowsListedPerGroup && !list.includes(ref)) list.push(ref)
}

function dup(code: DuplicateCandidate['code'], scope: DuplicateCandidate['scope'], basis: DuplicateCandidate['basis'], rows: readonly number[], refs: readonly string[]): DuplicateCandidate {
  return { code, scope, basis, rowNumbers: rows.slice(0, IMPORT_LIMITS.maxRowsListedPerGroup), rowCount: rows.length, existingRefs: [...refs].sort(), autoMerge: false }
}

function conflict(code: ConflictCandidate['code'], basis: ConflictCandidate['basis'], reason: ConflictCandidate['reason'], rows: readonly number[]): ConflictCandidate {
  return { code, scope: 'IN_FILE', basis, reason, rowNumbers: rows.slice(0, IMPORT_LIMITS.maxRowsListedPerGroup), rowCount: rows.length, winner: null }
}
