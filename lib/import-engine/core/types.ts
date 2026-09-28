// Import Engine — CSV Pure Core (Wave 1 T3). Types, limits and closed vocabularies.
// Normative source: IMPORT_CSV_SECURITY_PREFLIGHT_REPORT (Agent 4, PASS). Invariants I1–I20 apply.
// No I/O, no clock, no randomness, no tenant, no persistence. XLSX is HOLD (absent).

export const IMPORT_SCHEMA_VERSION = 1 as const
export const IMPORT_RULESET_VERSION = 'import-csv.ruleset.v1.0.0' as const

/** §6 hard bounds. */
export const IMPORT_LIMITS = {
  maxInputBytes: 10 * 1024 * 1024,
  maxDataRows: 25_000,
  maxColumns: 100,
  maxTotalCells: 500_000,
  maxCellChars: 32_768,
  maxCellUtf8Bytes: 64 * 1024,
  maxHeaderChars: 128,
  maxRecordBytes: 256 * 1024,
  maxIssuesRetained: 2_000,
  maxDuplicateDiagnosticsRetained: 1_000,
  maxMappingCandidatesPerColumn: 16,
  maxDelimiterCandidates: 4,
  /** Delimiter detection reads at most this prefix (whole records only). */
  delimiterSampleBytes: 64 * 1024,
  /** Rows listed per duplicate group; the full size is always in `rowCount`. */
  maxRowsListedPerGroup: 50,
  /** Trusted existing-snapshot entries accepted per entity. */
  maxExistingSnapshotEntries: 100_000,
} as const

export const IMPORT_ENTITIES = ['CUSTOMERS', 'PRODUCTS'] as const
export type ImportEntity = (typeof IMPORT_ENTITIES)[number]

/** §8: the only V1 delimiters. */
export const ALLOWED_DELIMITERS = [',', ';', '\t', '|'] as const
export type Delimiter = (typeof ALLOWED_DELIMITERS)[number]

export type NumberLocale = 'DOT' | 'COMMA' | 'UNSPECIFIED'
export type PhoneRegion = 'BR' | 'UNSPECIFIED'

export const AUTOMATION_POLICY = 'SUPPRESSED_BY_DEFAULT' as const

/** §31 closed issue vocabulary (plus refinements documented in the report). */
export const ISSUE_CODES = [
  'CSV_INPUT_TOO_LARGE',
  'CSV_INVALID_UTF8',
  'CSV_ENCODING_UNSUPPORTED',
  'CSV_BINARY_CONTENT',
  'CSV_NUL_BYTE',
  'CSV_EMPTY',
  'CSV_SYNTAX_INVALID',
  'CSV_INCONSISTENT_COLUMNS',
  'CSV_TOO_MANY_ROWS',
  'CSV_TOO_MANY_COLUMNS',
  'CSV_TOO_MANY_CELLS',
  'CSV_RECORD_TOO_LARGE',
  'CSV_CELL_TOO_LONG',
  'CSV_PARSER_UNAVAILABLE',
  'CSV_PARSER_CONTRACT_VIOLATION',
  'HEADER_EMPTY',
  'HEADER_TOO_LONG',
  'DUPLICATE_HEADER',
  'DELIMITER_AMBIGUOUS',
  'DELIMITER_UNDETECTED',
  'DELIMITER_NOT_ALLOWED',
  'UNKNOWN_COLUMN',
  'RESERVED_COLUMN',
  'AMBIGUOUS_COLUMN_MAPPING',
  'DUPLICATE_DESTINATION_MAPPING',
  'INVALID_MAPPING_DECISION',
  'USER_DECISION_REQUIRED',
  'MISSING_REQUIRED_FIELD',
  'INVALID_BOOLEAN',
  'INVALID_DECIMAL',
  'INVALID_INTEGER',
  'NEGATIVE_NOT_ALLOWED',
  'NUMBER_FORMAT_AMBIGUOUS',
  'FORMULA_LIKE_TEXT',
  'FIELD_FORMULA_NOT_ALLOWED',
  'POTENTIAL_MARKUP_TEXT',
  'INVALID_EMAIL',
  'INVALID_PHONE',
  'EXACT_DUPLICATE_ROW',
  'STRONG_DUPLICATE_CANDIDATE',
  'WEAK_DUPLICATE_CANDIDATE',
  'IDENTITY_CONFLICT',
  'DUPLICATE_SKU_CANDIDATE',
  'SKU_CONFLICT',
  'VALUE_TOO_LONG',
  'INVALID_VALUE_TYPE',
  'UNSUPPORTED_FIELD',
  'UNSUPPORTED_ENTITY',
  'INVALID_OPTIONS',
] as const
export type IssueCode = (typeof ISSUE_CODES)[number]

export type IssueSeverity = 'error' | 'warning'

/**
 * Safe diagnostic. Never contains a raw cell value, a raw row, the raw CSV or a stack trace.
 * For sensitive values only `valueLength` / `valueType` may appear in params.
 */
export type ImportIssue = {
  code: IssueCode
  severity: IssueSeverity
  /** 1-based CSV record number (header = 1), or null for file/mapping-level issues. */
  rowNumber: number | null
  /** `col:<index>` for source columns, or a destination field id. */
  columnId: string | null
  params?: Record<string, string | number>
}

export type FieldKind = 'text' | 'opaque_text' | 'email' | 'phone' | 'decimal' | 'integer' | 'boolean'

export type DestinationField = {
  id: string
  entity: ImportEntity
  kind: FieldKind
  required: boolean
  maxChars: number
  /** Personal data: never echoed in diagnostics (only valueLength/valueType). */
  pii: boolean
  /** Trim leading/trailing whitespace before validation (field-specific, never generic). */
  trim: boolean
  allowNegative: false
}

export type MappingDecisionSource = 'EXACT_ALIAS' | 'USER_SELECTED' | 'IGNORED' | 'NONE'
export type MappingStatus = 'MAPPED' | 'IGNORED' | 'UNKNOWN' | 'RESERVED' | 'AMBIGUOUS' | 'INVALID'

export type MappingEntry = {
  sourceIndex: number
  /** Header text as supplied (structure, not row data). */
  sourceHeader: string
  canonicalHeader: string
  destinationField: string | null
  status: MappingStatus
  decisionSource: MappingDecisionSource
  matchReason: string
  /** Allowlisted destinations suggested by the alias registry (bounded, ordered). */
  candidates: readonly string[]
}

/** Explicit user decisions (never inferred from CSV content). */
export type MappingDecision = { sourceIndex: number; action: 'MAP'; destinationField: string } | { sourceIndex: number; action: 'IGNORE' }

export type RowStatus = 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID'

export type NormalizedValue = string | number | boolean | null

export type ImportRow = {
  rowNumber: number
  status: RowStatus
  /** Only allowlisted destination ids, in canonical destination order. */
  values: Readonly<Record<string, NormalizedValue>>
  rowFingerprint: string
  errorCount: number
  warningCount: number
}

export type DuplicateScope = 'IN_FILE' | 'EXISTING'

export type DuplicateCandidate = {
  code: 'EXACT_DUPLICATE_ROW' | 'STRONG_DUPLICATE_CANDIDATE' | 'WEAK_DUPLICATE_CANDIDATE' | 'DUPLICATE_SKU_CANDIDATE'
  scope: DuplicateScope
  /** What matched: never the value itself. */
  basis: 'ROW_FINGERPRINT' | 'EMAIL' | 'PHONE' | 'NAME' | 'SKU'
  rowNumbers: readonly number[]
  rowCount: number
  /** Opaque trusted-snapshot references (EXISTING scope only). */
  existingRefs: readonly string[]
  autoMerge: false
}

export type ConflictCandidate = {
  code: 'IDENTITY_CONFLICT' | 'SKU_CONFLICT'
  scope: DuplicateScope
  basis: 'EMAIL' | 'PHONE' | 'SKU'
  reason: 'EMAIL_WITH_DIFFERENT_PHONES' | 'PHONE_WITH_DIFFERENT_EMAILS' | 'SKU_WITH_DIFFERENT_BUSINESS_FIELDS'
  rowNumbers: readonly number[]
  rowCount: number
  winner: null
}

/** Trusted, already tenant-scoped snapshot supplied by a future runtime. Never derived from CSV. */
export type ExistingSnapshot = {
  customers?: ReadonlyArray<{ ref: string; email?: string | null; phone?: string | null }>
  products?: ReadonlyArray<{ ref: string; sku?: string | null }>
}

export type DelimiterResolution =
  | { status: 'USER_SELECTED'; delimiter: Delimiter }
  | { status: 'DETECTED'; delimiter: Delimiter; candidatesTested: readonly Delimiter[] }
  | { status: 'AMBIGUOUS'; delimiter: null; viable: readonly Delimiter[] }
  | { status: 'UNDETECTED'; delimiter: null; viable: readonly Delimiter[] }
  | { status: 'NOT_ALLOWED'; delimiter: null; viable: readonly Delimiter[] }
