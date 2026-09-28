// Import Engine — CSV Pure Core (Wave 1 T3). Public surface. Dry run only: no apply, no I/O.
// XLSX: HOLD (no XLSX/ZIP/XML code exists). Automations: SUPPRESSED_BY_DEFAULT.

export * from './types'
export { decodeCsvInput, utf8ByteLength, codePointLength, type DecodedInput } from './encoding'
export { STRICT_PARSER_POLICY, parseCsvMatrix, parserRequest, type CsvParserFn, type CsvParserRequest, type CsvParserOutcome, type CsvParserFailure, type MatrixResult, type StrictParserPolicy } from './parser'
export { resolveDelimiter, isAllowedDelimiter, delimiterSample } from './delimiter'
export { validateHeaders, canonicalHeader, reservedKey, columnId, type HeaderInfo } from './headers'
export { DESTINATIONS, RESERVED_HEADER_KEYS, destinationFor, aliasCandidates, aliasRegistrySize } from './fields'
export { buildMapping, type MappingResult } from './mapping'
export { parseFieldValue, parseBooleanValue, parseDecimalValue, parsePhoneValue, isValidEmail, emailKey, formulaTrigger, type ParsedValue, type ValuePolicy } from './values'
export { normalizeRows } from './rows'
export { detectDuplicates, nameKey, type DuplicateResult } from './duplicates'
export { rowFingerprint, mappingFingerprint, futureIdempotencyMaterial, isImportHashes, type ImportHashes } from './fingerprint'
export { BoundedIssues } from './issues'
export { importCsvDryRun, type DryRunOptions, type DryRunDependencies, type DryRunStatus, type ImportDryRunResult } from './dry-run'
