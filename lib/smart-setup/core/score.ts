// Deterministic pack scoring (§7) and completeness (§8). Pure; integer arithmetic only.

import { businessTypeAuthority } from './questionnaire'
import {
  COUNTER_RULES,
  EVIDENCE_FAMILIES,
  EVIDENCE_RULES,
  HARD_CONTRADICTION_RULES,
  MAX_PACK_POINTS_PER_QUESTION,
  NON_SCORING_SUBSEGMENTS,
  THRESHOLDS_BPS,
  WEIGHTS,
} from './ruleset'
import type {
  Completeness,
  CounterSignal,
  EvidenceSignal,
  HardContradiction,
  NormalizedAnswers,
  PackScore,
  QuestionState,
  Ratio,
  SmartSetupPackKey,
} from './types'

export function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, bps: denominator > 0 ? Math.floor((numerator * 10000) / denominator) : 0 }
}

/** Exact threshold check: numerator/denominator >= bps/10000, without floats. */
export function atLeast(value: Ratio, thresholdBps: number): boolean {
  return value.denominator > 0 && value.numerator * 10000 >= thresholdBps * value.denominator
}

const pointsOf = (strength: 'STRONG' | 'WEAK') => (strength === 'STRONG' ? WEIGHTS.STRONG : WEIGHTS.WEAK)

export type ScoreResult = {
  packScores: PackScore[]
  signals: EvidenceSignal[]
  counterSignals: CounterSignal[]
  hardContradictions: HardContradiction[]
  completeness: Completeness
}

/**
 * @param packs eligible packs, in canonical order.
 * Only ANSWERED, presented, scored questions contribute. NOT_SURE, hidden, q.business_type and
 * q.team_mode contribute nothing to support, penalty or MAX_AVAILABLE_SUPPORT.
 */
export function scorePacks(questions: readonly QuestionState[], answers: NormalizedAnswers, packs: readonly SmartSetupPackKey[]): ScoreResult {
  const answered = questions.filter((question) => question.scored && question.status === 'ANSWERED')
  const declared = businessTypeAuthority(answers['q.business_type'])
  const signals: EvidenceSignal[] = []
  const counterSignals: CounterSignal[] = []
  let maxAvailableSupport = 0

  for (const question of answered) {
    if (question.id === 'q.subsegment') {
      maxAvailableSupport += WEIGHTS.SUBSEGMENT
      const option = question.selected[0]
      if (declared && !NON_SCORING_SUBSEGMENTS.includes(option) && packs.includes(declared.pack)) {
        signals.push({ pack: declared.pack, questionId: question.id, option, strength: 'SUBSEGMENT', code: 'SUBSEGMENT_MATCH', points: WEIGHTS.SUBSEGMENT, nominalPoints: WEIGHTS.SUBSEGMENT })
      }
      continue
    }
    maxAvailableSupport += MAX_PACK_POINTS_PER_QUESTION

    for (const pack of packs) {
      // Matching rules in (option order, ruleset order); the first strongest one counts, the rest are absorbed (§7.1 cap).
      const matches = question.selected.flatMap((option) =>
        EVIDENCE_RULES.filter((rule) => rule.questionId === question.id && rule.option === option && rule.pack === pack && (!rule.when || rule.when(answers))),
      )
      let best = -1
      matches.forEach((rule, index) => {
        if (best < 0 || pointsOf(rule.strength) > pointsOf(matches[best].strength)) best = index
      })
      matches.forEach((rule, index) => {
        const nominal = pointsOf(rule.strength)
        signals.push({
          pack,
          questionId: question.id,
          option: rule.option,
          strength: rule.strength,
          code: rule.code,
          points: index === best ? Math.min(nominal, MAX_PACK_POINTS_PER_QUESTION) : 0,
          nominalPoints: nominal,
        })
      })
    }

    for (const rule of COUNTER_RULES) {
      if (rule.questionId === question.id && question.selected.includes(rule.option) && packs.includes(rule.pack)) {
        counterSignals.push({ pack: rule.pack, questionId: question.id, option: rule.option, kind: 'CROSS_SEGMENT_COUNTER_SIGNAL', code: rule.code, points: WEIGHTS.EXPLICIT_CONTRADICTION })
      }
    }
  }

  // Evidence families: members share one cap per pack; later members (questionnaire order) are reduced first.
  for (const family of EVIDENCE_FAMILIES) {
    let remaining = family.cap
    for (const member of family.members) {
      for (const signal of signals) {
        if (signal.pack !== family.pack || signal.questionId !== member.questionId || signal.points === 0) continue
        if (member.options !== 'ANY' && !member.options.includes(signal.option)) continue
        const kept = Math.min(signal.points, remaining)
        remaining -= kept
        signal.points = kept
      }
    }
  }

  const packScores: PackScore[] = packs.map((pack) => {
    const rawSupport = signals.filter((signal) => signal.pack === pack).reduce((sum, signal) => sum + signal.points, 0)
    const rawPenalty = counterSignals.filter((signal) => signal.pack === pack).reduce((sum, signal) => sum + signal.points, 0)
    const rawScore = Math.max(0, rawSupport - rawPenalty)
    // Clamp 0..1: rawScore can never exceed the denominator by construction, min() keeps it provable.
    return { pack, rawSupport, rawPenalty, rawScore, maxAvailableSupport, confidence: ratio(Math.min(rawScore, maxAvailableSupport), maxAvailableSupport) }
  })

  const hardContradictions: HardContradiction[] = []
  for (const rule of HARD_CONTRADICTION_RULES) {
    const hit = rule.test(answers)
    if (hit) hardContradictions.push({ kind: 'HARD_ANSWER_CONTRADICTION', rule: rule.id, questionIds: hit.questionIds, options: hit.options })
  }

  const presentedScored = questions.filter((question) => question.scored && question.presented).length
  const completenessRatio = ratio(answered.length, presentedScored)
  const completeness: Completeness = {
    answeredScored: answered.length,
    presentedScored,
    ratio: completenessRatio,
    meetsMinimum: atLeast(completenessRatio, THRESHOLDS_BPS.MIN_COMPLETENESS),
  }

  return { packScores, signals, counterSignals, hardContradictions, completeness }
}
