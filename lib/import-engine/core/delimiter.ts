// Delimiter resolution (§8). User choice must be allowlisted. Detection tests the 4 fixed candidates
// on a bounded sample; a candidate is viable only with ≥2 columns, stable column count and valid
// quoting (strict parser). Exactly one viable → DETECTED. Tie → AMBIGUOUS (USER_DECISION_REQUIRED).
// Never picks the candidate with the most columns.

import { parseCsvMatrix, type CsvParserFn } from './parser'
import { ALLOWED_DELIMITERS, IMPORT_LIMITS, type Delimiter, type DelimiterResolution } from './types'

export function isAllowedDelimiter(value: unknown): value is Delimiter {
  return typeof value === 'string' && (ALLOWED_DELIMITERS as readonly string[]).includes(value)
}

/**
 * Bounded sample: at most `delimiterSampleBytes` UTF-16 units, cut back to the last LF so only whole
 * physical lines are sampled. A quoted multi-line cell cut by the sample fails every candidate
 * (conservative: the user is asked to choose).
 */
export function delimiterSample(text: string): string {
  if (text.length <= IMPORT_LIMITS.delimiterSampleBytes) return text
  const cut = text.lastIndexOf('\n', IMPORT_LIMITS.delimiterSampleBytes)
  return cut > 0 ? text.slice(0, cut) : text.slice(0, IMPORT_LIMITS.delimiterSampleBytes)
}

export function resolveDelimiter(text: string, requested: unknown, parser: CsvParserFn | undefined): DelimiterResolution {
  if (requested !== undefined && requested !== null) {
    return isAllowedDelimiter(requested) ? { status: 'USER_SELECTED', delimiter: requested } : { status: 'NOT_ALLOWED', delimiter: null, viable: [] }
  }
  const sample = delimiterSample(text)
  const candidates = ALLOWED_DELIMITERS.slice(0, IMPORT_LIMITS.maxDelimiterCandidates)
  const viable: Delimiter[] = []
  for (const candidate of candidates) {
    const parsed = parseCsvMatrix(sample, candidate, parser)
    if (parsed.ok && parsed.header.length >= 2) viable.push(candidate)
  }
  if (viable.length === 1) return { status: 'DETECTED', delimiter: viable[0], candidatesTested: candidates }
  if (viable.length > 1) return { status: 'AMBIGUOUS', delimiter: null, viable }
  return { status: 'UNDETECTED', delimiter: null, viable }
}
