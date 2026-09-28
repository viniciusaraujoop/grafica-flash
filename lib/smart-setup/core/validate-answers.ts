// Answer validation. Pure. Accepts untrusted input; returns only contract values.
// Rules: unknown/removed questions and invalid options are dropped and reported; free text is never
// copied into the result (issues carry no raw values); NOT_SURE is a valid answer, never an error.

import { optionsFor, questionDefinition } from './questionnaire'
import { NOT_SURE, QUESTION_IDS, REMOVED_QUESTION_IDS, type InputIssue, type NormalizedAnswers, type QuestionId } from './types'

export const MAX_INPUT_FIELDS = 64

export type ValidatedAnswers = { answers: NormalizedAnswers; issues: InputIssue[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

const QUESTION_KEY = /^q\.[a-z_]{1,40}$/
const KNOWN = new Set<string>(QUESTION_IDS)
const REMOVED = new Set<string>(REMOVED_QUESTION_IDS)

function validateOne(id: QuestionId, raw: unknown, businessType: string | undefined, issues: InputIssue[]): string | string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  const definition = questionDefinition(id)
  const allowed = optionsFor(id, businessType)

  if (definition.selection === 'single') {
    if (typeof raw !== 'string') {
      issues.push({ code: 'INVALID_VALUE_TYPE', questionId: id })
      return undefined
    }
    if (!allowed.includes(raw)) {
      issues.push({ code: 'INVALID_OPTION', questionId: id })
      return undefined
    }
    return raw
  }

  if (!Array.isArray(raw)) {
    issues.push({ code: 'INVALID_VALUE_TYPE', questionId: id })
    return undefined
  }
  const picked = new Set<string>()
  let invalid = false
  let duplicate = false
  for (const item of raw.slice(0, MAX_INPUT_FIELDS)) {
    if (typeof item !== 'string' || !allowed.includes(item)) {
      invalid = true
      continue
    }
    if (picked.has(item)) duplicate = true
    picked.add(item)
  }
  if (invalid) issues.push({ code: 'INVALID_OPTION', questionId: id })
  if (duplicate) issues.push({ code: 'DUPLICATE_OPTION', questionId: id })
  if (picked.has(NOT_SURE) && picked.size > 1) {
    picked.delete(NOT_SURE)
    issues.push({ code: 'NOT_SURE_MIXED_WITH_OPTIONS', questionId: id })
  }
  if (!picked.size) {
    if (!invalid) issues.push({ code: 'EMPTY_SELECTION', questionId: id })
    return undefined
  }
  // Canonical order = questionnaire option order (never input order).
  return allowed.filter((option) => picked.has(option))
}

export function validateAnswers(input: unknown): ValidatedAnswers {
  const issues: InputIssue[] = []
  if (!isRecord(input)) return { answers: {}, issues: [{ code: 'ANSWERS_NOT_OBJECT', questionId: null }] }

  const keys = Object.keys(input).sort()
  if (keys.length > MAX_INPUT_FIELDS) issues.push({ code: 'TOO_MANY_FIELDS', questionId: null })
  for (const key of keys) {
    if (KNOWN.has(key)) continue
    // Only well-formed question-like keys are echoed; anything else (e.g. "email", free text) is reported anonymously.
    issues.push({ code: REMOVED.has(key) ? 'REMOVED_QUESTION' : 'UNKNOWN_QUESTION', questionId: QUESTION_KEY.test(key) ? key : null })
  }

  const answers: NormalizedAnswers = {}
  const businessType = validateOne('q.business_type', input['q.business_type'], undefined, issues)
  if (businessType !== undefined) answers['q.business_type'] = businessType
  for (const id of QUESTION_IDS) {
    if (id === 'q.business_type') continue
    const value = validateOne(id, input[id], typeof businessType === 'string' ? businessType : undefined, issues)
    if (value !== undefined) answers[id] = value
  }
  return { answers, issues }
}
