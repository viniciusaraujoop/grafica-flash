// Field-specific value parsers (§14–§20, preflight §10/§12/§16/§17). No generic coercion:
// no naked Number(), no Boolean(), no NFKC, no silent truncation, no typo repair, no locale guessing.
// All grammars are linear scans or anchored regexes without nested quantifiers (no catastrophic backtracking).

import { codePointLength } from './encoding'
import type { DestinationField, IssueCode, NormalizedValue, NumberLocale, PhoneRegion } from './types'

export type ValueIssue = { code: IssueCode; severity: 'error' | 'warning'; params?: Record<string, string | number> }
export type ParsedValue = { value: NormalizedValue; issues: ValueIssue[] }

export type ValuePolicy = { numberLocale: NumberLocale; phoneRegion: PhoneRegion }

/** First effective char after leading whitespace (§18). */
export function formulaTrigger(raw: string): '=' | '+' | '-' | '@' | null {
  const trimmed = raw.replace(/^\s+/, '')
  const first = trimmed.charAt(0)
  return first === '=' || first === '+' || first === '-' || first === '@' ? first : null
}

const MARKUP = /<\s*[a-zA-Z!/]/

function describe(raw: string, field: DestinationField): Record<string, string | number> {
  // For PII only length/type may be exposed; never the value.
  return field.pii ? { valueLength: codePointLength(raw), valueType: 'string' } : { valueLength: codePointLength(raw) }
}

/** Canonical empty: an empty cell (after field-specific trim) → null. "null"/"N/A" stay literal. */
function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value
}

function parseText(raw: string, field: DestinationField): ParsedValue {
  const issues: ValueIssue[] = []
  const nfc = raw.normalize('NFC')
  const value = emptyToNull(field.trim ? nfc.trim() : nfc)
  if (value === null) return { value: null, issues }
  if (codePointLength(value) > field.maxChars) return { value: null, issues: [{ code: 'VALUE_TOO_LONG', severity: 'error', params: { maxChars: field.maxChars, ...describe(value, field) } }] }
  // Inert text is preserved exactly (no leading apostrophe); risk is flagged for any future export.
  if (formulaTrigger(value)) issues.push({ code: 'FORMULA_LIKE_TEXT', severity: 'warning', params: { trigger: formulaTrigger(value) as string } })
  if (MARKUP.test(value)) issues.push({ code: 'POTENTIAL_MARKUP_TEXT', severity: 'warning' })
  return { value, issues }
}

const EMAIL_LOCAL_ALLOWED = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/
const TLD = /^[A-Za-z]{2,63}$/

/** Conservative, deterministic email grammar. No domain/typo correction. */
export function isValidEmail(value: string): boolean {
  if (value.length > 254) return false
  const at = value.indexOf('@')
  if (at <= 0 || at !== value.lastIndexOf('@')) return false
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (local.length > 64 || !EMAIL_LOCAL_ALLOWED.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return false
  return TLD.test(labels[labels.length - 1])
}

function parseEmail(raw: string, field: DestinationField): ParsedValue {
  const value = emptyToNull(raw.normalize('NFC').trim())
  if (value === null) return { value: null, issues: [] }
  if (codePointLength(value) > field.maxChars) return { value: null, issues: [{ code: 'VALUE_TOO_LONG', severity: 'error', params: { maxChars: field.maxChars, ...describe(value, field) } }] }
  if (!isValidEmail(value)) return { value: null, issues: [{ code: 'INVALID_EMAIL', severity: 'error', params: describe(value, field) }] }
  const issues: ValueIssue[] = []
  if (formulaTrigger(value)) issues.push({ code: 'FORMULA_LIKE_TEXT', severity: 'warning', params: { trigger: formulaTrigger(value) as string } })
  return { value, issues }
}

/** Comparison key for emails: trim + lowercase only (§20). */
export function emailKey(value: string): string {
  return value.trim().toLowerCase()
}

const PHONE_CHARS = /^\+?[0-9 ().-]+$/

/**
 * Phone grammar (§18/§20). A leading "+" is part of the phone grammar, not a formula.
 * BR normalization (E.164 +55DDNNNNNNNN[N]) only when the trusted policy says phoneRegion = BR.
 */
export function parsePhoneValue(raw: string, region: PhoneRegion): { value: string; key: string } | null {
  const trimmed = raw.trim()
  if (!PHONE_CHARS.test(trimmed) || trimmed.indexOf('+') > 0) return null
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (region === 'BR') {
    let national = digits
    if (trimmed.startsWith('+')) {
      if (!digits.startsWith('55')) return null
      national = digits.slice(2)
    } else if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) national = digits.slice(2)
    if (national.length !== 10 && national.length !== 11) return null
    const ddd = Number.parseInt(national.slice(0, 2), 10)
    if (ddd < 11 || national.charAt(2) === '0') return null
    if (national.length === 11 && national.charAt(2) !== '9') return null
    const e164 = `+55${national}`
    return { value: e164, key: e164 }
  }
  // Region unspecified: validate shape only; never infer a country from CSV content.
  if (digits.length < 7 || digits.length > 15) return null
  return { value: trimmed, key: (trimmed.startsWith('+') ? '+' : '') + digits }
}

function parsePhone(raw: string, field: DestinationField, policy: ValuePolicy): ParsedValue {
  const value = emptyToNull(raw.normalize('NFC').trim())
  if (value === null) return { value: null, issues: [] }
  if (codePointLength(value) > field.maxChars) return { value: null, issues: [{ code: 'VALUE_TOO_LONG', severity: 'error', params: { maxChars: field.maxChars, ...describe(value, field) } }] }
  const parsed = parsePhoneValue(value, policy.phoneRegion)
  if (!parsed) return { value: null, issues: [{ code: 'INVALID_PHONE', severity: 'error', params: describe(value, field) }] }
  return { value: parsed.value, issues: [] }
}

const BOOLEAN_TRUE = new Set(['true', '1', 'sim', 'yes'])
const BOOLEAN_FALSE = new Set(['false', '0', 'não', 'no'])

/** Closed vocabulary (§15). `"false"` is false. Anything else → INVALID_BOOLEAN. */
export function parseBooleanValue(raw: string): boolean | null | 'INVALID' {
  const value = raw.normalize('NFC').trim().toLowerCase()
  if (value === '') return null
  if (BOOLEAN_TRUE.has(value)) return true
  if (BOOLEAN_FALSE.has(value)) return false
  return 'INVALID'
}

function parseBoolean(raw: string): ParsedValue {
  if (formulaTrigger(raw) && raw.trim() !== '') {
    const trigger = formulaTrigger(raw)
    if (trigger === '=' || trigger === '@' || trigger === '+') return { value: null, issues: [{ code: 'FIELD_FORMULA_NOT_ALLOWED', severity: 'error' }] }
  }
  const parsed = parseBooleanValue(raw)
  if (parsed === 'INVALID') return { value: null, issues: [{ code: 'INVALID_BOOLEAN', severity: 'error' }] }
  return { value: parsed, issues: [] }
}

const INTEGER_DIGITS = /^[0-9]+$/
const MAX_INTEGER_DIGITS = 9
const MAX_DECIMAL_INTEGER_DIGITS = 12
const MAX_DECIMAL_FRACTION_DIGITS = 4

/**
 * Decimal grammar with an explicit convention (§16). Returns a canonical decimal STRING with "." —
 * never a float. Currency symbols, thousands separators and mixed separators are rejected.
 */
export function parseDecimalValue(raw: string, locale: NumberLocale): { ok: true; value: string; negative: boolean } | { ok: false; code: 'INVALID_DECIMAL' | 'NUMBER_FORMAT_AMBIGUOUS' | 'FIELD_FORMULA_NOT_ALLOWED' } {
  const value = raw.trim()
  const trigger = formulaTrigger(value)
  if (trigger === '=' || trigger === '@' || trigger === '+') return { ok: false, code: 'FIELD_FORMULA_NOT_ALLOWED' }
  const negative = value.startsWith('-')
  const body = negative ? value.slice(1) : value
  if (body.length === 0) return { ok: false, code: negative ? 'FIELD_FORMULA_NOT_ALLOWED' : 'INVALID_DECIMAL' }
  const dots = body.split('.').length - 1
  const commas = body.split(',').length - 1
  if (dots + commas === 0) {
    if (!INTEGER_DIGITS.test(body)) return { ok: false, code: negative ? 'FIELD_FORMULA_NOT_ALLOWED' : 'INVALID_DECIMAL' }
    if (body.length > MAX_DECIMAL_INTEGER_DIGITS) return { ok: false, code: 'INVALID_DECIMAL' }
    return { ok: true, value: canonicalDecimal(body, ''), negative }
  }
  if ((dots > 0 && commas > 0) || dots + commas > 1) return { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' }
  const separator = dots ? '.' : ','
  if (locale === 'UNSPECIFIED') return { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' }
  if ((locale === 'DOT' && separator !== '.') || (locale === 'COMMA' && separator !== ',')) return { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' }
  const [whole, fraction] = body.split(separator)
  if (!INTEGER_DIGITS.test(whole) || !INTEGER_DIGITS.test(fraction)) return { ok: false, code: negative ? 'FIELD_FORMULA_NOT_ALLOWED' : 'INVALID_DECIMAL' }
  if (whole.length > MAX_DECIMAL_INTEGER_DIGITS || fraction.length > MAX_DECIMAL_FRACTION_DIGITS) return { ok: false, code: 'INVALID_DECIMAL' }
  return { ok: true, value: canonicalDecimal(whole, fraction), negative }
}

function canonicalDecimal(whole: string, fraction: string): string {
  const w = whole.replace(/^0+(?=[0-9])/, '')
  const f = fraction.replace(/0+$/, '')
  return f ? `${w}.${f}` : w
}

function parseDecimal(raw: string, field: DestinationField, policy: ValuePolicy): ParsedValue {
  if (raw.trim() === '') return { value: null, issues: [] }
  const parsed = parseDecimalValue(raw, policy.numberLocale)
  if (!parsed.ok) return { value: null, issues: [{ code: parsed.code, severity: 'error' }] }
  // A negative lexical value is grammatical; the destination rule rejects it (price >= 0).
  if (parsed.negative && !field.allowNegative && parsed.value !== '0') return { value: null, issues: [{ code: 'NEGATIVE_NOT_ALLOWED', severity: 'error' }] }
  return { value: parsed.value, issues: [] }
}

function parseInteger(raw: string, field: DestinationField): ParsedValue {
  const value = raw.trim()
  if (value === '') return { value: null, issues: [] }
  const trigger = formulaTrigger(value)
  if (trigger === '=' || trigger === '@' || trigger === '+') return { value: null, issues: [{ code: 'FIELD_FORMULA_NOT_ALLOWED', severity: 'error' }] }
  const negative = value.startsWith('-')
  const body = negative ? value.slice(1) : value
  if (!INTEGER_DIGITS.test(body)) {
    // "1.5", "1,0", "10un": no float stock, no unit stripping.
    return { value: null, issues: [{ code: negative && body.length === 0 ? 'FIELD_FORMULA_NOT_ALLOWED' : 'INVALID_INTEGER', severity: 'error' }] }
  }
  if (body.length > MAX_INTEGER_DIGITS) return { value: null, issues: [{ code: 'INVALID_INTEGER', severity: 'error', params: { maxDigits: MAX_INTEGER_DIGITS } }] }
  const parsed = Number.parseInt(body, 10)
  if (negative && parsed !== 0 && !field.allowNegative) return { value: null, issues: [{ code: 'NEGATIVE_NOT_ALLOWED', severity: 'error' }] }
  return { value: parsed, issues: [] }
}

export function parseFieldValue(raw: string, field: DestinationField, policy: ValuePolicy): ParsedValue {
  switch (field.kind) {
    case 'text':
    case 'opaque_text':
      return parseText(raw, field)
    case 'email':
      return parseEmail(raw, field)
    case 'phone':
      return parsePhone(raw, field, policy)
    case 'boolean':
      return parseBoolean(raw)
    case 'decimal':
      return parseDecimal(raw, field, policy)
    case 'integer':
      return parseInteger(raw, field)
  }
}
