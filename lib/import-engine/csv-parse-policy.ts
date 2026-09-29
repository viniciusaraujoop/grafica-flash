// csv-parse@7.0.2 strict policy, streaming limit guard and safe error mapping (T3 adapter layer).
// This module deliberately does NOT import csv-parse: everything the adapter decides (options, limits,
// error vocabulary) lives here as plain data/functions so it can be verified without the library.
// Only `csv-parse-adapter.ts` touches the library; `core/**` never does.

import { isAllowedDelimiter } from './core/delimiter'
import { STRICT_PARSER_POLICY, type CsvParserFailure, type CsvParserRequest } from './core/parser'
import { IMPORT_LIMITS, type Delimiter } from './core/types'

/** Exact pinned dependency this policy was written and reviewed against. */
export const CSV_PARSE_PINNED_VERSION = '7.0.2'

/**
 * The complete option set passed to csv-parse (delimiter and on_record are added per call).
 * Every permissive/recovery/transform/object-building feature is explicitly OFF:
 *   columns / group_columns_by_name  → never build objects from untrusted headers (matrix-first)
 *   cast / cast_date                 → every cell stays a string
 *   relax_quotes / relax_column_*    → malformed quoting and ragged rows fail closed
 *   skip_records_with_error / skip_* → nothing is ever silently dropped
 *   comment / raw / info             → no comment lines, no raw-record retention, no info objects
 *   delimiter_auto                   → delimiter comes only from the validated core policy
 * `ignore_last_delimiters` is left at its library default (false) — not passed.
 */
export const CSV_PARSE_OPTIONS = Object.freeze({
  bom: STRICT_PARSER_POLICY.bom,
  cast: STRICT_PARSER_POLICY.cast,
  cast_date: STRICT_PARSER_POLICY.cast_date,
  columns: STRICT_PARSER_POLICY.columns,
  comment: STRICT_PARSER_POLICY.comment,
  delimiter_auto: false,
  escape: STRICT_PARSER_POLICY.escape,
  group_columns_by_name: false,
  info: false,
  ltrim: STRICT_PARSER_POLICY.ltrim,
  max_record_size: STRICT_PARSER_POLICY.max_record_size,
  quote: STRICT_PARSER_POLICY.quote,
  raw: STRICT_PARSER_POLICY.raw,
  relax_column_count: STRICT_PARSER_POLICY.relax_column_count,
  relax_column_count_less: false,
  relax_column_count_more: false,
  relax_quotes: STRICT_PARSER_POLICY.relax_quotes,
  rtrim: STRICT_PARSER_POLICY.rtrim,
  skip_empty_lines: STRICT_PARSER_POLICY.skip_empty_lines,
  skip_records_with_empty_values: false,
  skip_records_with_error: STRICT_PARSER_POLICY.skip_records_with_error,
  trim: STRICT_PARSER_POLICY.trim,
})

/** Thrown from on_record to abort parsing as soon as a structural limit is crossed. Carries no content. */
export class CsvLimitAbort extends Error {
  readonly failure: CsvParserFailure
  readonly recordNumber: number

  constructor(failure: CsvParserFailure, recordNumber: number) {
    super('CSV_LIMIT_ABORT')
    this.name = 'CsvLimitAbort'
    this.failure = failure
    this.recordNumber = recordNumber
  }
}

export type RecordGuardLimits = { maxRecords: number; maxColumns: number; maxCells: number }

const bounded = (requested: unknown, ceiling: number): number =>
  typeof requested === 'number' && Number.isInteger(requested) && requested > 0 ? Math.min(requested, ceiling) : ceiling

/**
 * on_record guard: runs once per record while csv-parse streams through the input, so row / column /
 * cell limits abort early instead of materialising an unbounded matrix. Record byte size is bounded by
 * csv-parse itself (max_record_size). Limits can only be tightened by the request, never widened.
 */
export function createRecordGuard(limits: Partial<RecordGuardLimits> | undefined): (record: string[]) => string[] {
  const maxRecords = bounded(limits?.maxRecords, IMPORT_LIMITS.maxDataRows + 1)
  const maxColumns = bounded(limits?.maxColumns, IMPORT_LIMITS.maxColumns)
  const maxCells = bounded(limits?.maxCells, IMPORT_LIMITS.maxTotalCells)
  let records = 0
  let cells = 0
  return (record: string[]): string[] => {
    records += 1
    if (records > maxRecords) throw new CsvLimitAbort('TOO_MANY_RECORDS', records)
    if (record.length > maxColumns) throw new CsvLimitAbort('TOO_MANY_COLUMNS', records)
    cells += record.length
    if (cells > maxCells) throw new CsvLimitAbort('TOO_MANY_CELLS', records)
    return record
  }
}

/** csv-parse error codes that are not plain syntax errors. Everything else (quotes, unknown) → SYNTAX. */
const CODE_TO_FAILURE: ReadonlyMap<string, CsvParserFailure> = new Map([
  ['CSV_MAX_RECORD_SIZE', 'RECORD_TOO_LARGE'],
  ['CSV_RECORD_INCONSISTENT_FIELDS_LENGTH', 'INCONSISTENT_COLUMNS'],
  ['CSV_RECORD_INCONSISTENT_COLUMNS', 'INCONSISTENT_COLUMNS'],
])

/**
 * Maps anything csv-parse (or the guard) throws into the closed parser-failure vocabulary.
 * Reads ONLY the string `code` and the integer `records` counter. Never reads or forwards
 * `message`, `stack`, `raw`, `record` or any other property (they can contain CSV content / PII).
 */
export function mapCsvParseError(error: unknown): { failure: CsvParserFailure; recordNumber: number | null } {
  if (error instanceof CsvLimitAbort) return { failure: error.failure, recordNumber: error.recordNumber }
  if (!error || typeof error !== 'object') return { failure: 'SYNTAX', recordNumber: null }
  const code = (error as { code?: unknown }).code
  const records = (error as { records?: unknown }).records
  const failure = typeof code === 'string' ? CODE_TO_FAILURE.get(code) ?? 'SYNTAX' : 'SYNTAX'
  const recordNumber = typeof records === 'number' && Number.isInteger(records) && records >= 0 ? records + 1 : null
  return { failure, recordNumber }
}

/** Rejects any request that did not come from the core's strict contract (defense in depth). */
export function checkParserRequest(request: unknown): request is CsvParserRequest & { delimiter: Delimiter } {
  if (!request || typeof request !== 'object') return false
  const candidate = request as Partial<CsvParserRequest>
  return typeof candidate.text === 'string' && isAllowedDelimiter(candidate.delimiter) && candidate.policy === STRICT_PARSER_POLICY
}

/** True when every key of the core strict policy is passed to csv-parse with the identical value. */
export function optionsMatchCorePolicy(): boolean {
  const options = CSV_PARSE_OPTIONS as Readonly<Record<string, unknown>>
  return Object.entries(STRICT_PARSER_POLICY).every(([key, value]) => Object.prototype.hasOwnProperty.call(options, key) && options[key] === value)
}
