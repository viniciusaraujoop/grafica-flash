// CSV parser contract (§5, preflight §5/§9). The core NEVER parses CSV syntax by hand.
// A proven parser (`csv-parse`, pinned) is plugged in through `CsvParserFn`; the core only
// supplies the strict policy + limits and re-verifies every returned matrix (defense in depth).
//
// STATUS (T3): the csv-parse adapter is PENDING — the dependency could not be installed in the
// implementation environment (npm registry blocked). See the T3 report for the exact adapter.

import { codePointLength, utf8ByteLength } from './encoding'
import { IMPORT_LIMITS, type Delimiter } from './types'

/**
 * The only parser configuration the core accepts. Mirrors csv-parse option names.
 * Frozen: permissive recovery (relax_*, skip_records_with_error), casting, comments, raw
 * retention and header-to-object mode are all disabled. Header row is returned as data.
 */
export const STRICT_PARSER_POLICY = Object.freeze({
  bom: true,
  cast: false,
  cast_date: false,
  columns: false,
  comment: null,
  raw: false,
  relax_quotes: false,
  relax_column_count: false,
  skip_records_with_error: false,
  skip_empty_lines: false,
  trim: false,
  ltrim: false,
  rtrim: false,
  quote: '"',
  escape: '"',
  max_record_size: IMPORT_LIMITS.maxRecordBytes,
})

export type StrictParserPolicy = typeof STRICT_PARSER_POLICY

export type CsvParserRequest = {
  text: string
  delimiter: Delimiter
  policy: StrictParserPolicy
  /** Limits the adapter must enforce WHILE parsing (abort early, never allocate unbounded output). */
  limits: { maxRecords: number; maxColumns: number; maxCells: number; maxRecordBytes: number }
}

export type CsvParserFailure =
  | 'SYNTAX'
  | 'INCONSISTENT_COLUMNS'
  | 'RECORD_TOO_LARGE'
  | 'TOO_MANY_RECORDS'
  | 'TOO_MANY_COLUMNS'
  | 'TOO_MANY_CELLS'

export type CsvParserOutcome = { ok: true; records: string[][] } | { ok: false; failure: CsvParserFailure; recordNumber: number | null }

export type CsvParserFn = (request: CsvParserRequest) => CsvParserOutcome

export type MatrixResult =
  | { ok: true; header: string[]; rows: string[][]; cells: number }
  | {
      ok: false
      code:
        | 'CSV_SYNTAX_INVALID'
        | 'CSV_INCONSISTENT_COLUMNS'
        | 'CSV_RECORD_TOO_LARGE'
        | 'CSV_TOO_MANY_ROWS'
        | 'CSV_TOO_MANY_COLUMNS'
        | 'CSV_TOO_MANY_CELLS'
        | 'CSV_CELL_TOO_LONG'
        | 'CSV_EMPTY'
        | 'CSV_PARSER_UNAVAILABLE'
        | 'CSV_PARSER_CONTRACT_VIOLATION'
      rowNumber: number | null
      columnIndex?: number
    }

const FAILURE_CODE: Record<CsvParserFailure, Extract<MatrixResult, { ok: false }>['code']> = {
  SYNTAX: 'CSV_SYNTAX_INVALID',
  INCONSISTENT_COLUMNS: 'CSV_INCONSISTENT_COLUMNS',
  RECORD_TOO_LARGE: 'CSV_RECORD_TOO_LARGE',
  TOO_MANY_RECORDS: 'CSV_TOO_MANY_ROWS',
  TOO_MANY_COLUMNS: 'CSV_TOO_MANY_COLUMNS',
  TOO_MANY_CELLS: 'CSV_TOO_MANY_CELLS',
}

export function parserRequest(text: string, delimiter: Delimiter): CsvParserRequest {
  return {
    text,
    delimiter,
    policy: STRICT_PARSER_POLICY,
    limits: {
      maxRecords: IMPORT_LIMITS.maxDataRows + 1,
      maxColumns: IMPORT_LIMITS.maxColumns,
      maxCells: IMPORT_LIMITS.maxTotalCells,
      maxRecordBytes: IMPORT_LIMITS.maxRecordBytes,
    },
  }
}

/**
 * Runs the injected parser and re-verifies the matrix: shape, strings only, stable column count,
 * row/column/cell/record/cell-size limits. Fails closed; never repairs or skips a record.
 */
export function parseCsvMatrix(text: string, delimiter: Delimiter, parser: CsvParserFn | undefined): MatrixResult {
  if (typeof parser !== 'function') return { ok: false, code: 'CSV_PARSER_UNAVAILABLE', rowNumber: null }
  let outcome: CsvParserOutcome
  try {
    outcome = parser(parserRequest(text, delimiter))
  } catch {
    // Parser exceptions are never propagated (no stack traces, no raw content in diagnostics).
    return { ok: false, code: 'CSV_SYNTAX_INVALID', rowNumber: null }
  }
  if (!outcome || typeof outcome !== 'object') return { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber: null }
  if (!outcome.ok) {
    const code = FAILURE_CODE[outcome.failure]
    return code ? { ok: false, code, rowNumber: outcome.recordNumber ?? null } : { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber: null }
  }
  const records = outcome.records
  if (!Array.isArray(records)) return { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber: null }
  if (records.length === 0) return { ok: false, code: 'CSV_EMPTY', rowNumber: null }
  if (records.length > IMPORT_LIMITS.maxDataRows + 1) return { ok: false, code: 'CSV_TOO_MANY_ROWS', rowNumber: IMPORT_LIMITS.maxDataRows + 2 }

  const width = Array.isArray(records[0]) ? records[0].length : -1
  if (width < 1) return { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber: 1 }
  if (width > IMPORT_LIMITS.maxColumns) return { ok: false, code: 'CSV_TOO_MANY_COLUMNS', rowNumber: 1 }

  let cells = 0
  for (let r = 0; r < records.length; r += 1) {
    const record = records[r]
    const rowNumber = r + 1
    if (!Array.isArray(record)) return { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber }
    if (record.length !== width) return { ok: false, code: 'CSV_INCONSISTENT_COLUMNS', rowNumber }
    cells += record.length
    if (cells > IMPORT_LIMITS.maxTotalCells) return { ok: false, code: 'CSV_TOO_MANY_CELLS', rowNumber }
    let recordBytes = 0
    for (let c = 0; c < record.length; c += 1) {
      const cell = record[c]
      if (typeof cell !== 'string') return { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber, columnIndex: c }
      const bytes = utf8ByteLength(cell)
      if (bytes === null) return { ok: false, code: 'CSV_PARSER_CONTRACT_VIOLATION', rowNumber, columnIndex: c }
      if (bytes > IMPORT_LIMITS.maxCellUtf8Bytes || codePointLength(cell) > IMPORT_LIMITS.maxCellChars) return { ok: false, code: 'CSV_CELL_TOO_LONG', rowNumber, columnIndex: c }
      recordBytes += bytes
    }
    if (recordBytes > IMPORT_LIMITS.maxRecordBytes) return { ok: false, code: 'CSV_RECORD_TOO_LARGE', rowNumber }
  }
  return { ok: true, header: records[0], rows: records.slice(1), cells }
}
