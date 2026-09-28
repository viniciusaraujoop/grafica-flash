// Field mapping (§13, preflight §20/§21): explicit, deterministic, explainable. No fuzzy matching.
// Alias hits are proposals (EXACT_ALIAS); unknown / reserved / ambiguous columns require an explicit
// user decision; reserved columns can only be ignored; destinations are allowlisted ids only.

import { aliasCandidates, destinationFor, DESTINATIONS, RESERVED_HEADER_KEYS } from './fields'
import { columnId, type HeaderInfo } from './headers'
import { BoundedIssues } from './issues'
import { IMPORT_LIMITS, type ImportEntity, type MappingDecision, type MappingEntry } from './types'

export type MappingResult = {
  entries: MappingEntry[]
  /** sourceIndex → destination id, for MAPPED columns only. */
  bySource: Map<number, string>
  complete: boolean
}

function normalizeDecisions(decisions: unknown, issues: BoundedIssues, width: number): Map<number, MappingDecision> {
  const out = new Map<number, MappingDecision>()
  if (decisions === undefined || decisions === null) return out
  if (!Array.isArray(decisions)) {
    issues.add('INVALID_MAPPING_DECISION', 'error', null, null, { reason: 'NOT_A_LIST' })
    return out
  }
  for (const raw of decisions.slice(0, IMPORT_LIMITS.maxColumns)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      issues.add('INVALID_MAPPING_DECISION', 'error', null, null, { reason: 'NOT_AN_OBJECT' })
      continue
    }
    const entry = raw as { sourceIndex?: unknown; action?: unknown; destinationField?: unknown }
    const index = entry.sourceIndex
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= width) {
      issues.add('INVALID_MAPPING_DECISION', 'error', null, null, { reason: 'SOURCE_INDEX_OUT_OF_RANGE' })
      continue
    }
    if (out.has(index)) {
      issues.add('INVALID_MAPPING_DECISION', 'error', null, columnId(index), { reason: 'DUPLICATE_DECISION' })
      continue
    }
    if (entry.action === 'IGNORE') out.set(index, { sourceIndex: index, action: 'IGNORE' })
    else if (entry.action === 'MAP' && typeof entry.destinationField === 'string') out.set(index, { sourceIndex: index, action: 'MAP', destinationField: entry.destinationField })
    else issues.add('INVALID_MAPPING_DECISION', 'error', null, columnId(index), { reason: 'UNKNOWN_ACTION' })
  }
  return out
}

export function buildMapping(entity: ImportEntity, headers: readonly HeaderInfo[], rawDecisions: unknown, issues: BoundedIssues): MappingResult {
  const decisions = normalizeDecisions(rawDecisions, issues, headers.length)
  const entries: MappingEntry[] = []

  for (const header of headers) {
    const reserved = RESERVED_HEADER_KEYS.has(header.reservedKey) || RESERVED_HEADER_KEYS.has(header.canonical)
    const candidates = reserved ? [] : aliasCandidates(entity, header.canonical).slice(0, IMPORT_LIMITS.maxMappingCandidatesPerColumn)
    const decision = decisions.get(header.index)
    const base = { sourceIndex: header.index, sourceHeader: header.raw, canonicalHeader: header.canonical, candidates }

    if (decision?.action === 'IGNORE') {
      entries.push({ ...base, destinationField: null, status: 'IGNORED', decisionSource: 'IGNORED', matchReason: reserved ? 'RESERVED_IGNORED_BY_USER' : 'IGNORED_BY_USER' })
      continue
    }
    if (reserved) {
      // No destination can receive an internal/reserved column, even if the user asks.
      if (decision?.action === 'MAP') issues.add('RESERVED_COLUMN', 'error', null, columnId(header.index), { reason: 'RESERVED_CANNOT_BE_MAPPED' })
      else issues.add('RESERVED_COLUMN', 'error', null, columnId(header.index), { reason: 'UNMAPPED_RESERVED_COLUMN' })
      entries.push({ ...base, destinationField: null, status: 'RESERVED', decisionSource: 'NONE', matchReason: 'UNMAPPED_RESERVED_COLUMN' })
      continue
    }
    if (decision?.action === 'MAP') {
      const destination = destinationFor(entity, decision.destinationField)
      if (!destination) {
        issues.add('UNSUPPORTED_FIELD', 'error', null, columnId(header.index), { reason: 'DESTINATION_NOT_ALLOWLISTED' })
        entries.push({ ...base, destinationField: null, status: 'INVALID', decisionSource: 'USER_SELECTED', matchReason: 'DESTINATION_NOT_ALLOWLISTED' })
        continue
      }
      entries.push({ ...base, destinationField: destination.id, status: 'MAPPED', decisionSource: 'USER_SELECTED', matchReason: 'USER_SELECTED' })
      continue
    }
    if (candidates.length === 1) {
      entries.push({ ...base, destinationField: candidates[0], status: 'MAPPED', decisionSource: 'EXACT_ALIAS', matchReason: 'EXACT_ALIAS_MATCH' })
      continue
    }
    if (candidates.length > 1) {
      issues.add('AMBIGUOUS_COLUMN_MAPPING', 'error', null, columnId(header.index), { candidates: candidates.length })
      entries.push({ ...base, destinationField: null, status: 'AMBIGUOUS', decisionSource: 'NONE', matchReason: 'MULTIPLE_ALIAS_DESTINATIONS' })
      continue
    }
    issues.add('UNKNOWN_COLUMN', 'error', null, columnId(header.index), { reason: 'UNMAPPED_COLUMN' })
    entries.push({ ...base, destinationField: null, status: 'UNKNOWN', decisionSource: 'NONE', matchReason: 'NO_EXACT_ALIAS' })
  }

  // Two source columns may never feed the same destination (no "last column wins").
  const bySource = new Map<number, string>()
  const firstByDestination = new Map<string, number>()
  for (const entry of entries) {
    if (entry.status !== 'MAPPED' || !entry.destinationField) continue
    const first = firstByDestination.get(entry.destinationField)
    if (first === undefined) {
      firstByDestination.set(entry.destinationField, entry.sourceIndex)
      bySource.set(entry.sourceIndex, entry.destinationField)
    } else {
      issues.add('DUPLICATE_DESTINATION_MAPPING', 'error', null, columnId(entry.sourceIndex), { duplicateOf: columnId(first) })
      entry.status = 'AMBIGUOUS'
      entry.matchReason = 'DESTINATION_ALREADY_MAPPED'
      bySource.delete(first)
      const firstEntry = entries.find((candidate) => candidate.sourceIndex === first)
      if (firstEntry && firstEntry.status === 'MAPPED') {
        firstEntry.status = 'AMBIGUOUS'
        firstEntry.matchReason = 'DESTINATION_ALREADY_MAPPED'
      }
    }
  }
  for (const entry of entries) if (entry.status !== 'MAPPED') bySource.delete(entry.sourceIndex)

  let complete = entries.every((entry) => entry.status === 'MAPPED' || entry.status === 'IGNORED')
  const mapped = new Set(bySource.values())
  for (const destination of DESTINATIONS[entity]) {
    if (destination.required && !mapped.has(destination.id)) {
      issues.add('MISSING_REQUIRED_FIELD', 'error', null, destination.id, { reason: 'REQUIRED_DESTINATION_NOT_MAPPED' })
      complete = false
    }
  }
  if (!complete) issues.add('USER_DECISION_REQUIRED', 'error', null, null, { stage: 'MAPPING' })
  return { entries, bySource, complete }
}
