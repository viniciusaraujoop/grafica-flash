// Normalization: applies deterministic branching and classifies every question as
// ANSWERED / NOT_SURE / UNANSWERED / HIDDEN. Answers to hidden questions are dropped and reported.

import { isApplicable, QUESTIONNAIRE_V1 } from './questionnaire'
import { NOT_SURE, type InputIssue, type NormalizedAnswers, type QuestionState } from './types'

export type NormalizedInput = { answers: NormalizedAnswers; questions: QuestionState[]; issues: InputIssue[] }

export function normalizeAnswers(validated: NormalizedAnswers): NormalizedInput {
  const answers: NormalizedAnswers = {}
  const issues: InputIssue[] = []
  const questions: QuestionState[] = []

  for (const definition of QUESTIONNAIRE_V1) {
    const value = validated[definition.id]
    const presented = isApplicable(definition.id, validated)
    if (!presented) {
      if (value !== undefined) issues.push({ code: 'HIDDEN_QUESTION_ANSWER_IGNORED', questionId: definition.id })
      questions.push({ id: definition.id, role: definition.role, scored: definition.scored, presented: false, status: 'HIDDEN', selected: [] })
      continue
    }
    if (value === undefined) {
      questions.push({ id: definition.id, role: definition.role, scored: definition.scored, presented: true, status: 'UNANSWERED', selected: [] })
      continue
    }
    answers[definition.id] = value
    const selected = typeof value === 'string' ? [value] : [...value]
    const notSure = selected.length === 1 && selected[0] === NOT_SURE
    questions.push({
      id: definition.id,
      role: definition.role,
      scored: definition.scored,
      presented: true,
      status: notSure ? 'NOT_SURE' : 'ANSWERED',
      selected: notSure ? [] : selected,
    })
  }
  return { answers, questions, issues }
}
