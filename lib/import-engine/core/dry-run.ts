// Import dry run (§24, preflight §23/§32/§33). Pure function: input → proposal DATA.
// It cannot persist, create/update records, send messages, trigger webhooks/automations, create jobs
// or call providers — no such dependency can even be passed in. Tenant never comes from CSV.

import { resolveDelimiter } from './delimiter'
import { decodeCsvInput } from './encoding'
import { isImportHashes, mappingFingerprint, type ImportHashes } from './fingerprint'
import { validateHeaders } from './headers'
import { BoundedIssues } from './issues'
import { buildMapping } from './mapping'
import { parseCsvMatrix, STRICT_PARSER_POLICY, type CsvParserFn } from './parser'
import { normalizeRows } from './rows'
import { detectDuplicates } from './duplicates'
import {
  AUTOMATION_POLICY,
  IMPORT_ENTITIES,
  IMPORT_LIMITS,
  IMPORT_RULESET_VERSION,
  IMPORT_SCHEMA_VERSION,
  type ConflictCandidate,
  type Delimiter,
  type DelimiterResolution,
  type DuplicateCandidate,
  type ExistingSnapshot,
  type ImportEntity,
  type ImportIssue,
  type ImportRow,
  type MappingEntry,
  type NumberLocale,
  type PhoneRegion,
} from './types'

export type DryRunOptions = {
  entity: ImportEntity
  /** Optional explicit delimiter (must be allowlisted). Otherwise detected on a bounded sample. */
  delimiter?: Delimiter
  mappingDecisions?: unknown
  numberLocale?: NumberLocale
  /** Trusted configuration only (never inferred from CSV). */
  phoneRegion?: PhoneRegion
  /** Trusted, already tenant-scoped snapshot (future runtime). Never derived from CSV. */
  existing?: ExistingSnapshot
}

export type DryRunDependencies = {
  /** Proven CSV parser adapter (csv-parse). PENDING in T3: absent → CSV_PARSER_UNAVAILABLE. */
  parser?: CsvParserFn
  hashes: ImportHashes
}

export type DryRunStatus = 'READY_FOR_REVIEW' | 'USER_DECISION_REQUIRED' | 'BLOCKED'

export type ImportDryRunResult = {
  schemaVersion: typeof IMPORT_SCHEMA_VERSION
  rulesetVersion: typeof IMPORT_RULESET_VERSION
  entity: ImportEntity | null
  status: DryRunStatus
  inputFingerprint: string | null
  mappingFingerprint: string | null
  parserPolicy: { options: typeof STRICT_PARSER_POLICY; delimiter: DelimiterResolution | null; hadBom: boolean; numberLocale: NumberLocale; phoneRegion: PhoneRegion }
  mapping: MappingEntry[]
  rows: ImportRow[]
  issues: ImportIssue[]
  issueTotals: Record<string, number>
  duplicateCandidates: DuplicateCandidate[]
  conflicts: ConflictCandidate[]
  summary: {
    inputBytes: number
    dataRows: number
    columns: number
    validRows: number
    validWithWarningsRows: number
    invalidRows: number
    blockingIssues: number
    errors: number
    warnings: number
    duplicateGroups: number
    conflictGroups: number
    /** Estimates only — nothing is created or updated by the dry run. */
    estimatedActions: { createCandidates: number; reviewRequired: number; skipInvalid: number }
  }
  diagnosticsTruncated: boolean
  dryRun: true
  notApplied: true
  requiresUserConfirmation: true
  automationPolicy: typeof AUTOMATION_POLICY
}

function emptyResult(entity: ImportEntity | null, status: DryRunStatus, issues: BoundedIssues, extra: Partial<ImportDryRunResult> = {}): ImportDryRunResult {
  return {
    schemaVersion: IMPORT_SCHEMA_VERSION,
    rulesetVersion: IMPORT_RULESET_VERSION,
    entity,
    status,
    inputFingerprint: null,
    mappingFingerprint: null,
    parserPolicy: { options: STRICT_PARSER_POLICY, delimiter: null, hadBom: false, numberLocale: 'UNSPECIFIED', phoneRegion: 'UNSPECIFIED' },
    mapping: [],
    rows: [],
    issues: issues.list(),
    issueTotals: issues.totals(),
    duplicateCandidates: [],
    conflicts: [],
    summary: {
      inputBytes: 0,
      dataRows: 0,
      columns: 0,
      validRows: 0,
      validWithWarningsRows: 0,
      invalidRows: 0,
      blockingIssues: issues.errors,
      errors: issues.errors,
      warnings: issues.warnings,
      duplicateGroups: 0,
      conflictGroups: 0,
      estimatedActions: { createCandidates: 0, reviewRequired: 0, skipInvalid: 0 },
    },
    diagnosticsTruncated: issues.truncated,
    dryRun: true,
    notApplied: true,
    requiresUserConfirmation: true,
    automationPolicy: AUTOMATION_POLICY,
    ...extra,
  }
}

const NUMBER_LOCALES: readonly NumberLocale[] = ['DOT', 'COMMA', 'UNSPECIFIED']
const PHONE_REGIONS: readonly PhoneRegion[] = ['BR', 'UNSPECIFIED']

export function importCsvDryRun(input: unknown, options: DryRunOptions, dependencies: DryRunDependencies): ImportDryRunResult {
  const issues = new BoundedIssues(IMPORT_LIMITS.maxIssuesRetained)
  const entity = options && (IMPORT_ENTITIES as readonly string[]).includes(options.entity) ? options.entity : null
  if (!entity) {
    issues.add('UNSUPPORTED_ENTITY', 'error', null, null)
    return emptyResult(null, 'BLOCKED', issues)
  }
  if (!dependencies || !isImportHashes(dependencies.hashes)) {
    issues.add('INVALID_OPTIONS', 'error', null, null, { reason: 'HASHES_REQUIRED' })
    return emptyResult(entity, 'BLOCKED', issues)
  }
  const numberLocale: NumberLocale = options.numberLocale === undefined ? 'UNSPECIFIED' : options.numberLocale
  const phoneRegion: PhoneRegion = options.phoneRegion === undefined ? 'UNSPECIFIED' : options.phoneRegion
  if (!NUMBER_LOCALES.includes(numberLocale) || !PHONE_REGIONS.includes(phoneRegion)) {
    issues.add('INVALID_OPTIONS', 'error', null, null, { reason: 'UNKNOWN_LOCALE_OR_REGION' })
    return emptyResult(entity, 'BLOCKED', issues)
  }
  const { hashes, parser } = dependencies

  // 1. Bytes / encoding (limit checked before any decoding or parsing).
  const decoded = decodeCsvInput(input)
  if (!decoded.ok) {
    issues.add(decoded.code, 'error', null, null, { byteLength: decoded.byteLength })
    return emptyResult(entity, 'BLOCKED', issues, input instanceof Uint8Array && decoded.code !== 'CSV_INPUT_TOO_LARGE' ? { inputFingerprint: hashes.bytes(input) } : {})
  }
  const inputFingerprint = hashes.bytes(decoded.bytes)
  const policyBase = { options: STRICT_PARSER_POLICY, hadBom: decoded.hadBom, numberLocale, phoneRegion }

  // 2. Delimiter (allowlist; ambiguity → user decision; never "most columns").
  const delimiter = resolveDelimiter(decoded.text, options.delimiter, parser)
  if (delimiter.delimiter === null) {
    if (delimiter.status === 'NOT_ALLOWED') issues.add('DELIMITER_NOT_ALLOWED', 'error', null, null)
    else if (typeof parser !== 'function') issues.add('CSV_PARSER_UNAVAILABLE', 'error', null, null)
    else {
      issues.add(delimiter.status === 'AMBIGUOUS' ? 'DELIMITER_AMBIGUOUS' : 'DELIMITER_UNDETECTED', 'error', null, null, { viable: delimiter.viable.length })
      issues.add('USER_DECISION_REQUIRED', 'error', null, null, { stage: 'DELIMITER' })
    }
    const status = delimiter.status === 'NOT_ALLOWED' || typeof parser !== 'function' ? 'BLOCKED' : 'USER_DECISION_REQUIRED'
    return emptyResult(entity, status, issues, { inputFingerprint, parserPolicy: { ...policyBase, delimiter }, summary: { ...emptyResult(entity, status, issues).summary, inputBytes: decoded.byteLength } })
  }

  // 3. Strict parse into a bounded string[][] matrix (fail closed, no recovery).
  const matrix = parseCsvMatrix(decoded.text, delimiter.delimiter, parser)
  if (!matrix.ok) {
    issues.add(matrix.code, 'error', matrix.rowNumber, matrix.columnIndex === undefined ? null : `col:${matrix.columnIndex}`)
    return emptyResult(entity, 'BLOCKED', issues, { inputFingerprint, parserPolicy: { ...policyBase, delimiter } })
  }

  // 4. Headers (validated by index; blocking on empty/too long/duplicate).
  const { headers, blocking } = validateHeaders(matrix.header, issues)
  if (blocking) return emptyResult(entity, 'BLOCKED', issues, { inputFingerprint, parserPolicy: { ...policyBase, delimiter } })

  // 5. Mapping (explicit, allowlisted, no fuzzy; unresolved → user decision).
  const mapping = buildMapping(entity, headers, options.mappingDecisions, issues)
  const mappingFp = mappingFingerprint({ entity, mapping: mapping.entries, delimiter, numberLocale, phoneRegion }, hashes)
  if (!mapping.complete) {
    return emptyResult(entity, 'USER_DECISION_REQUIRED', issues, {
      inputFingerprint,
      mappingFingerprint: mappingFp,
      parserPolicy: { ...policyBase, delimiter },
      mapping: mapping.entries,
    })
  }

  // 6–8. Normalize + validate rows, then duplicates/conflicts (proposals only).
  const rows = normalizeRows(entity, matrix.rows, mapping.bySource, { numberLocale, phoneRegion }, issues, hashes)
  const duplicates = detectDuplicates(entity, rows, phoneRegion, options.existing)

  const valid = rows.filter((row) => row.status === 'VALID').length
  const warned = rows.filter((row) => row.status === 'VALID_WITH_WARNINGS').length
  const invalid = rows.length - valid - warned
  const review = rows.filter((row) => row.status !== 'INVALID' && duplicates.flaggedRows.has(row.rowNumber)).length

  return {
    ...emptyResult(entity, 'READY_FOR_REVIEW', issues),
    inputFingerprint,
    mappingFingerprint: mappingFp,
    parserPolicy: { ...policyBase, delimiter },
    mapping: mapping.entries,
    rows,
    issues: issues.list(),
    issueTotals: issues.totals(),
    duplicateCandidates: duplicates.duplicateCandidates,
    conflicts: duplicates.conflicts,
    summary: {
      inputBytes: decoded.byteLength,
      dataRows: rows.length,
      columns: matrix.header.length,
      validRows: valid,
      validWithWarningsRows: warned,
      invalidRows: invalid,
      blockingIssues: 0,
      errors: issues.errors,
      warnings: issues.warnings,
      duplicateGroups: duplicates.totalDuplicateGroups,
      conflictGroups: duplicates.totalConflictGroups,
      estimatedActions: { createCandidates: valid + warned - review, reviewRequired: review, skipInvalid: invalid },
    },
    diagnosticsTruncated: issues.truncated || duplicates.truncated,
  }
}
