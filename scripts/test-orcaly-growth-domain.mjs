import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import path from 'node:path'

const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('./') && !path.extname(specifier) && context.parentURL?.includes('/lib/orcaly-next/')) return next(new URL(`${specifier}.ts`, context.parentURL).href, context)
    return next(specifier, context)
  },
})
const exact = await import('../lib/orcaly-next/growth/exact.ts')
const metrics = await import('../lib/orcaly-next/growth/metrics.ts')
const exp = await import('../lib/orcaly-next/growth/experiment.ts')
const results = await import('../lib/orcaly-next/growth/results.ts')
const decision = await import('../lib/orcaly-next/growth/decision.ts')
const sugg = await import('../lib/orcaly-next/growth/suggestions.ts')
const input = await import('../lib/orcaly-next/growth/manual-input.ts')
const providers = await import('../lib/orcaly-next/growth/providers.ts')
const ws = await import('../lib/orcaly-next/growth/workspace.ts')
const types = await import('../lib/orcaly-next/growth/types.ts')
const demo = await import('../lib/orcaly-next/growth/demo-data.ts')
const setup = await import('../lib/orcaly-next/growth/setup.ts')
hook.deregister()

const n = (v) => BigInt(v)
const clone = (v) => structuredClone(v)
const base = () => clone(demo.demoExperiments.find((e) => e.id === 'demo-landing-cta'))
const obs = (id, variantId, start, end, values, experimentId = 'x') => ({ id, experimentId, variantId, window: { start, end }, sourceId: 'manual', provenance: 'DECLARED', values, evidenceUrl: null, recordedAt: `${end}T00:00:00Z` })

/** A minimal, fully valid two-arm experiment on conversion_rate. */
function fixture(overrides = {}) {
  return {
    id: 'x', companyId: 'c', title: 'Teste válido', status: 'READY', singleArm: false, version: 1, updatedAt: '2026-09-01T00:00:00Z', statusReason: null, startedAt: null, endedAt: null,
    metrics: [metrics.METRIC_CATALOGUE.conversion_rate],
    variants: [{ id: 'a', label: 'A', role: 'control', description: '' }, { id: 'b', label: 'B', role: 'variant', description: '' }],
    hypothesis: { id: 'h', statement: 'A variante aumenta a conversão.', expectedDirection: 'increase', primaryMetric: 'conversion_rate', baseline: null, minimumDurationDays: 7, observationWindow: { start: '2026-09-01', end: '2026-09-14' }, assumptions: [], risks: [], source: 'teste', provenance: 'DECLARED',
      successCriteria: { metric: 'conversion_rate', comparator: 'relative_change_at_least', thresholdBps: 1000, minSamplePerArm: 100, minimumDurationDays: 7 } },
    ...overrides,
  }
}

// 1 — invalid hypothesis
test('hypothesis: invalid statements, metrics, directions, windows and lists are rejected', () => {
  const h = fixture().hypothesis
  const codes = (patch) => exp.validateHypothesis({ ...h, ...patch }).map((i) => i.code)
  assert.deepEqual(exp.validateHypothesis(h), [])
  assert.ok(codes({ statement: 'curta' }).includes('STATEMENT_LENGTH'))
  assert.ok(codes({ statement: 'x'.repeat(501) }).includes('STATEMENT_LENGTH'))
  assert.ok(codes({ primaryMetric: 'receita_magica' }).includes('PRIMARY_METRIC'))
  assert.ok(codes({ primaryMetric: 'custom:Bad Key' }).includes('PRIMARY_METRIC'))
  assert.ok(codes({ expectedDirection: 'sideways' }).includes('DIRECTION'))
  assert.ok(codes({ observationWindow: { start: '2026-09-14', end: '2026-09-01' } }).includes('WINDOW_INVALID'))
  assert.ok(codes({ observationWindow: { start: '2026-02-30', end: '2026-03-10' } }).includes('WINDOW_INVALID'))
  assert.ok(codes({ observationWindow: { start: '2026-09-01', end: '2026-09-03' } }).includes('WINDOW_TOO_SHORT'))
  assert.ok(codes({ minimumDurationDays: 0 }).includes('DURATION'))
  assert.ok(codes({ successCriteria: { ...h.successCriteria, thresholdBps: -500 } }).includes('CRITERIA_DIRECTION'))
  assert.ok(codes({ expectedDirection: 'decrease' }).includes('CRITERIA_DIRECTION'))
  assert.ok(codes({ successCriteria: { ...h.successCriteria, metric: 'ctr' } }).includes('CRITERIA_METRIC'))
  assert.ok(codes({ assumptions: Array(11).fill('ok') }).includes('TOO_MANY_ITEMS'))
  assert.ok(codes({ risks: [' '] }).includes('INVALID_ITEM'))
  assert.ok(codes({ source: '' }).includes('SOURCE'))
  assert.ok(codes({ baseline: { metric: 'ctr', value: { provenance: 'DECLARED', value: n(1) }, window: h.observationWindow, source: 's' } }).includes('BASELINE_METRIC'))
})

// 2 — experiment without criteria cannot run
test('experiment: RUNNING requires hypothesis, criterion, window and control + variant', () => {
  const noCriteria = fixture(); noCriteria.hypothesis.successCriteria = null
  let r = exp.transition(noCriteria, 'start', { expectedVersion: 1, at: '2026-09-01T00:00:00Z' })
  assert.equal(r.ok, false); assert.equal(r.code, 'NOT_READY'); assert.ok(r.issues.some((i) => i.code === 'NO_CRITERIA'))
  const noWindow = fixture(); noWindow.hypothesis.observationWindow = null
  assert.ok(exp.readinessIssues(noWindow).some((i) => i.code === 'NO_WINDOW'))
  assert.ok(exp.readinessIssues(fixture({ hypothesis: null })).some((i) => i.code === 'NO_HYPOTHESIS'))
  assert.ok(exp.readinessIssues(fixture({ variants: [{ id: 'a', label: 'A', role: 'control', description: '' }] })).some((i) => i.code === 'NEEDS_VARIANT'))
  assert.ok(exp.readinessIssues(fixture({ variants: [{ id: 'b', label: 'B', role: 'variant', description: '' }] })).some((i) => i.code === 'NEEDS_CONTROL'))
  assert.ok(exp.readinessIssues(fixture({ singleArm: true, variants: [{ id: 'b', label: 'B', role: 'variant', description: '' }] })).some((i) => i.code === 'SINGLE_ARM_NEEDS_BASELINE'))
  assert.ok(exp.readinessIssues(fixture({ variants: [{ id: 'a', label: 'A', role: 'control', description: '' }, { id: 'a', label: 'B', role: 'variant', description: '' }] })).some((i) => i.code === 'DUPLICATE_VARIANT'))
  r = exp.transition(fixture(), 'start', { expectedVersion: 1, at: '2026-09-01T00:00:00Z' })
  assert.equal(r.ok, true); assert.equal(r.experiment.status, 'RUNNING'); assert.equal(r.experiment.version, 2); assert.equal(r.experiment.startedAt, '2026-09-01T00:00:00Z')
})

// 3 — invalid transitions, reasons, CAS
test('transitions: invalid paths, terminal states, required reasons and version conflicts', () => {
  const at = '2026-09-02T00:00:00Z'
  const draft = fixture({ status: 'DRAFT' })
  assert.equal(exp.transition(draft, 'start', { expectedVersion: 1, at }).code, 'INVALID_TRANSITION')
  assert.equal(exp.transition(draft, 'complete', { expectedVersion: 1, at }).code, 'INVALID_TRANSITION')
  for (const terminal of ['CANCELLED', 'INVALIDATED']) for (const action of ['mark_ready', 'start', 'pause', 'resume', 'complete', 'cancel', 'invalidate']) {
    assert.equal(exp.transition(fixture({ status: terminal }), action, { expectedVersion: 1, at, reason: 'x' }).ok, false, `${terminal} ${action}`)
  }
  assert.equal(exp.transition(fixture({ status: 'RUNNING' }), 'pause', { expectedVersion: 1, at }).code, 'REASON_REQUIRED')
  assert.equal(exp.transition(fixture({ status: 'RUNNING' }), 'invalidate', { expectedVersion: 1, at, reason: ' ' }).code, 'REASON_REQUIRED')
  assert.equal(exp.transition(fixture({ status: 'RUNNING' }), 'invalidate', { expectedVersion: 1, at, reason: 'x'.repeat(501) }).code, 'REASON_REQUIRED')
  assert.equal(exp.transition(fixture({ status: 'RUNNING', version: 3 }), 'pause', { expectedVersion: 2, at, reason: 'x' }).code, 'VERSION_CONFLICT')
  const paused = exp.transition(fixture({ status: 'RUNNING' }), 'pause', { expectedVersion: 1, at, reason: 'manutenção' })
  assert.equal(paused.experiment.status, 'PAUSED'); assert.equal(paused.experiment.statusReason, 'manutenção')
  const resumed = exp.transition(paused.experiment, 'resume', { expectedVersion: 2, at })
  assert.equal(resumed.experiment.status, 'RUNNING'); assert.equal(resumed.experiment.statusReason, null)
  const done = exp.transition(resumed.experiment, 'complete', { expectedVersion: 3, at })
  assert.equal(done.experiment.status, 'COMPLETED'); assert.equal(done.experiment.endedAt, at)
  assert.equal(exp.transition(done.experiment, 'invalidate', { expectedVersion: 4, at, reason: 'dados errados' }).experiment.status, 'INVALIDATED')
  assert.deepEqual(exp.allowedActions(fixture({ status: 'COMPLETED' })), ['invalidate'])
  assert.equal(exp.transition(fixture(), 'start', { expectedVersion: 1, at: 'ontem' }).ok, false)
})

// 4 — division by zero, 6 — missing metrics, 7 — unknown vs zero
test('derived metrics: zero denominators and missing inputs are UNKNOWN, never zero', () => {
  const totals = { impressions: n(0), clicks: n(0), spend_cents: n(1000) }
  for (const key of ['ctr', 'cpc', 'conversion_rate', 'cac', 'cpl', 'roas']) assert.equal(metrics.metricValue(key, totals).provenance, 'UNKNOWN', key)
  assert.match(metrics.metricValue('ctr', totals).reason, /zero/)
  assert.match(metrics.metricValue('cac', totals).reason, /requer/)
  assert.equal(metrics.formatMetricValue(metrics.metricValue('roas', totals)), 'Não disponível')
  // a real zero is still zero
  const zero = metrics.metricValue('clicks', { clicks: n(0) })
  assert.equal(zero.provenance, 'DECLARED'); assert.equal(metrics.formatMetricValue(zero), '0')
  assert.equal(metrics.metricValue('leads', {}).provenance, 'UNKNOWN')
  // partial reporting across observations must not produce an understated total
  const sum = metrics.sumObservations([obs('1', 'a', '2026-09-01', '2026-09-01', { clicks: n(10), leads: n(2) }), obs('2', 'a', '2026-09-02', '2026-09-02', { clicks: n(5) })])
  assert.equal(sum.clicks, n(15)); assert.equal(sum.leads, undefined)
  assert.deepEqual(metrics.sumObservations([]), {})
  // formulas
  const full = { impressions: n(1000), clicks: n(50), leads: n(10), conversions: n(5), spend_cents: n(10000), revenue_cents: n(30000) }
  assert.equal(metrics.formatMetricValue(metrics.metricValue('ctr', full)), '5,00%')
  assert.equal(metrics.formatMetricValue(metrics.metricValue('cpc', full)), 'R$ 2,00')
  assert.equal(metrics.formatMetricValue(metrics.metricValue('cpl', full)), 'R$ 10,00')
  assert.equal(metrics.formatMetricValue(metrics.metricValue('conversion_rate', full)), '10,00%')
  assert.equal(metrics.formatMetricValue(metrics.metricValue('cac', full)), 'R$ 20,00')
  assert.equal(metrics.formatMetricValue(metrics.metricValue('roas', full)), '3,00×')
  assert.equal(exact.divideRounded(n(1), n(0)), null); assert.equal(exact.ratioToDecimal(n(1), n(0), 2), null)
})

// 5 — exact cents, including values above Number.MAX_SAFE_INTEGER
test('exact money: pt-BR parsing, BigInt arithmetic beyond MAX_SAFE_INTEGER, no float', () => {
  assert.equal(exact.parseMoneyToCents('spend', '1.234,56'), n(123456))
  assert.equal(exact.parseMoneyToCents('spend', 'R$ 0,1'), n(10))
  assert.equal(exact.parseMoneyToCents('spend', '1234'), n(123400))
  assert.equal(exact.parseMoneyToCents('spend', '0,29'), n(29))
  for (const bad of ['1,234', '12.34', '-5', '1.23.4', '1,2345', '', ' ', 'abc', '1e5', '١٢']) assert.throws(() => exact.parseMoneyToCents('spend', bad), exact.GrowthInputError, bad)
  assert.throws(() => exact.parseMoneyToCents('spend', 12.5))
  const big = n('9007199254740993') // MAX_SAFE_INTEGER + 2, not representable as a double
  assert.equal(exact.formatCents(big), 'R$ 90.071.992.547.409,93')
  assert.equal(exact.formatCents(big + n(1)), 'R$ 90.071.992.547.409,94')
  assert.equal(exact.formatCents(n(-5)), '-R$ 0,05')
  const totals = metrics.sumObservations([obs('1', 'a', '2026-09-01', '2026-09-01', { spend_cents: big, conversions: n(3) }), obs('2', 'a', '2026-09-02', '2026-09-02', { spend_cents: big, conversions: n(4) })])
  assert.equal(totals.spend_cents, big * n(2))
  assert.equal(metrics.formatMetricValue(metrics.metricValue('cac', totals)), exact.formatCents(exact.divideRounded(big * n(2), n(7))))
  assert.equal(exact.divideRounded(n(5), n(2)), n(3)); assert.equal(exact.divideRounded(n(-5), n(2)), n(-3)); assert.equal(exact.divideRounded(n(4), n(3)), n(1))
  assert.equal(exact.relativeChangeBps({ numerator: n(4), denominator: n(100) }, { numerator: n(5), denominator: n(100) }), 2500)
  assert.equal(exact.relativeChangeBps({ numerator: n(0), denominator: n(1) }, { numerator: n(5), denominator: n(1) }), null)
})

// 8 — insufficient data and outcome classification
test('results: INSUFFICIENT_DATA, INCONCLUSIVE, DIRECTIONAL, MEETS, DOES_NOT_MEET — never WINNER/LOSER', () => {
  assert.ok(!types.RESULT_OUTCOMES.includes('WINNER') && !types.RESULT_OUTCOMES.includes('LOSER'))
  const running = fixture({ status: 'RUNNING' })
  const period = ['2026-09-01', '2026-09-10']
  const make = (aConv, bConv, clicks = 200) => [obs('a1', 'a', ...period, { clicks: n(clicks), conversions: n(aConv) }), obs('b1', 'b', ...period, { clicks: n(clicks), conversions: n(bConv) })]
  assert.equal(results.evaluateResult(fixture({ status: 'DRAFT' }), make(10, 20)).outcome, 'INSUFFICIENT_DATA')
  assert.equal(results.evaluateResult(running, []).outcome, 'INSUFFICIENT_DATA')
  assert.equal(results.evaluateResult(running, make(10, 20, 50)).outcome, 'INSUFFICIENT_DATA') // sample < 100
  assert.equal(results.evaluateResult(running, [obs('a1', 'a', '2026-09-01', '2026-09-03', { clicks: n(200), conversions: n(10) }), obs('b1', 'b', '2026-09-01', '2026-09-03', { clicks: n(200), conversions: n(20) })]).outcome, 'INSUFFICIENT_DATA') // 3 days < 7
  assert.equal(results.evaluateResult(running, [obs('a1', 'a', ...period, { clicks: n(200) }), obs('b1', 'b', ...period, { clicks: n(200), conversions: n(20) })]).outcome, 'INSUFFICIENT_DATA') // metric missing
  assert.equal(results.evaluateResult(running, make(10, 20)).outcome, 'MEETS_DECLARED_CRITERIA')   // +100%
  assert.equal(results.evaluateResult(running, make(20, 21)).outcome, 'DIRECTIONAL_SIGNAL')        // +5% < 10%
  assert.equal(results.evaluateResult(running, make(20, 15)).outcome, 'DOES_NOT_MEET_DECLARED_CRITERIA')
  assert.equal(results.evaluateResult(running, make(20, 20)).outcome, 'INCONCLUSIVE')
  assert.equal(results.evaluateResult(running, make(0, 20)).outcome, 'INCONCLUSIVE')               // reference zero
  assert.equal(results.evaluateResult(fixture({ status: 'INVALIDATED', statusReason: 'x' }), make(10, 20)).outcome, 'INCONCLUSIVE')
  const outside = results.evaluateResult(running, [...make(10, 20), obs('late', 'b', '2026-10-01', '2026-10-02', { clicks: n(999), conversions: n(0) })])
  assert.equal(outside.outcome, 'MEETS_DECLARED_CRITERIA'); assert.ok(outside.reasons.some((r) => r.includes('fora da janela')))
  const foreign = results.evaluateResult(running, make(10, 20).map((o) => ({ ...o, experimentId: 'other' })))
  assert.equal(foreign.outcome, 'INSUFFICIENT_DATA')
  const r = results.evaluateResult(running, make(10, 20))
  assert.equal(r.confidence.method, 'NONE'); assert.match(r.confidence.note, /não prova causalidade/)
  assert.ok(r.reasons.some((x) => x.includes('provisório')))
  // cost metric: decrease is improvement
  const cost = fixture({ status: 'COMPLETED', metrics: [metrics.METRIC_CATALOGUE.cac] })
  cost.hypothesis = { ...cost.hypothesis, primaryMetric: 'cac', expectedDirection: 'decrease', successCriteria: { metric: 'cac', comparator: 'relative_change_at_most', thresholdBps: -1000, minSamplePerArm: 10, minimumDurationDays: 7 } }
  const costObs = (a, b) => [obs('a', 'a', ...period, { spend_cents: n(100000), conversions: n(a) }), obs('b', 'b', ...period, { spend_cents: n(100000), conversions: n(b) })]
  assert.equal(results.evaluateResult(cost, costObs(20, 25)).outcome, 'MEETS_DECLARED_CRITERIA')   // CAC −20%
  assert.equal(results.evaluateResult(cost, costObs(20, 15)).outcome, 'DOES_NOT_MEET_DECLARED_CRITERIA')
  // single arm vs declared baseline
  const single = fixture({ status: 'COMPLETED', singleArm: true, variants: [{ id: 'b', label: 'B', role: 'variant', description: '' }] })
  single.hypothesis = { ...single.hypothesis, baseline: { metric: 'conversion_rate', value: { provenance: 'CALCULATED', ratio: { numerator: n(5), denominator: n(100) }, unit: 'percent' }, window: { start: '2026-08-01', end: '2026-08-31' }, source: 'registro' } }
  const s = results.evaluateResult(single, [obs('b', 'b', ...period, { clicks: n(200), conversions: n(20) })])
  assert.equal(s.outcome, 'MEETS_DECLARED_CRITERIA'); assert.ok(s.reasons.some((x) => x.includes('sem grupo de controle')))
  assert.equal(results.formatBps(1234), '+12,34%'); assert.equal(results.formatBps(-5), '−0,05%'); assert.equal(results.formatBps(null), 'Não disponível')
})

// 9 — learning classification
test('learning log: FACT cites own observations, INTERPRETATION declares limitation, DECISION needs receipt', () => {
  const o = [obs('o1', 'a', '2026-09-01', '2026-09-02', { clicks: n(1) }), obs('o9', 'a', '2026-09-01', '2026-09-02', { clicks: n(1) }, 'other')]
  const l = (patch) => ({ id: 'l', experimentId: 'x', kind: 'FACT', text: 'Observamos algo.', observationIds: ['o1'], limitation: null, decisionReceiptId: null, createdAt: '2026-09-03T00:00:00Z', ...patch })
  const codes = (patch, receipts = []) => decision.validateLearning(l(patch), o, receipts).map((i) => i.code)
  assert.deepEqual(codes({}), [])
  assert.ok(codes({ observationIds: [] }).includes('FACT_NEEDS_OBSERVATION'))
  assert.ok(codes({ observationIds: ['o9'] }).includes('FOREIGN_OBSERVATION'))
  assert.ok(codes({ decisionReceiptId: 'r' }).includes('FACT_WITH_DECISION'))
  assert.ok(codes({ kind: 'INTERPRETATION' }).includes('INTERPRETATION_NEEDS_LIMITATION'))
  assert.deepEqual(codes({ kind: 'INTERPRETATION', limitation: 'amostra pequena' }), [])
  assert.ok(codes({ kind: 'DECISION' }).includes('DECISION_NEEDS_RECEIPT'))
  assert.ok(codes({ kind: 'DECISION', decisionReceiptId: 'r?' }, ['r1']).includes('UNKNOWN_RECEIPT'))
  assert.deepEqual(codes({ kind: 'DECISION', decisionReceiptId: 'r1' }, ['r1']), [])
  assert.ok(codes({ kind: 'OPINION' }).includes('KIND'))
  assert.ok(codes({ text: 'oi' }).includes('TEXT'))
  for (const learning of demo.demoLearnings) assert.deepEqual(decision.validateLearning(learning, demo.demoObservations, demo.demoReceipts.map((r) => r.id)), [], learning.id)
})

// 10 — decision receipt
test('decision receipt: carries data, period, criterion, allowed conclusion; blocks adoption without met criterion', () => {
  const running = fixture({ status: 'COMPLETED' })
  const period = ['2026-09-01', '2026-09-10']
  const data = [obs('a1', 'a', ...period, { clicks: n(200), conversions: n(20) }), obs('b1', 'b', ...period, { clicks: n(200), conversions: n(21) })]
  const result = results.evaluateResult(running, data)
  assert.equal(result.outcome, 'DIRECTIONAL_SIGNAL')
  const d = (action) => ({ id: 'd', experimentId: 'x', action, rationale: 'porque sim', decidedBy: 'Pessoa', decidedAt: '2026-09-11T00:00:00Z' })
  assert.throws(() => decision.buildDecisionReceipt({ id: 'r', experiment: running, result, observations: data, decision: d('adopt_variant'), nextStep: 'x', createdAt: 'x' }), decision.DecisionNotPermittedError)
  assert.throws(() => decision.buildDecisionReceipt({ id: 'r', experiment: running, result, observations: data, decision: { ...d('extend_test'), rationale: ' ' }, nextStep: 'x', createdAt: 'x' }), decision.DecisionNotPermittedError)
  assert.throws(() => decision.buildDecisionReceipt({ id: 'r', experiment: running, result, observations: data, decision: { ...d('extend_test'), experimentId: 'y' }, nextStep: 'x', createdAt: 'x' }), decision.DecisionNotPermittedError)
  const receipt = decision.buildDecisionReceipt({ id: 'r', experiment: running, result, observations: data, decision: d('extend_test'), nextStep: 'Repetir', createdAt: '2026-09-11T00:00:00Z' })
  assert.deepEqual(receipt.dataUsed.observationIds, ['a1', 'b1']); assert.deepEqual(receipt.dataUsed.sourceIds, ['manual']); assert.deepEqual(receipt.dataUsed.provenance, ['DECLARED'])
  assert.deepEqual(receipt.period, { start: '2026-09-01', end: '2026-09-14' })
  assert.match(receipt.criterion, /Taxa de conversão: variação de pelo menos \+10,00% vs controle, mínimo 100 por braço e 7 dia/)
  assert.equal(receipt.allowedConclusion, results.ALLOWED_CONCLUSION.DIRECTIONAL_SIGNAL)
  assert.ok(receipt.limitations.some((x) => x.includes('Nenhum teste estatístico'))); assert.ok(receipt.limitations.some((x) => x.includes('DECLARED')))
  assert.equal(receipt.observed.length, 2); assert.match(receipt.observed[1], /\+5,00%/)
  for (const outcome of types.RESULT_OUTCOMES) { if (outcome !== 'MEETS_DECLARED_CRITERIA') assert.ok(!decision.PERMITTED_ACTIONS[outcome].includes('adopt_variant'), outcome) }
  assert.ok(!Object.values(results.ALLOWED_CONCLUSION).join(' ').match(/vencedor|venceu|perdedor|comprovad|garantid[oa] que/i))
})

// 11 — deterministic suggestions
test('suggestion engine: explicit rules, stable order, anti-peeking, no randomness', () => {
  const run = (experiment, result = null, extra = {}) => sugg.suggestNextSteps({ experiment, result, learnings: [], receiptCount: 0, today: '2026-09-20', ...extra }).map((s) => s.ruleId)
  assert.deepEqual(run(fixture({ status: 'DRAFT', hypothesis: null, variants: [] })), ['R01_NO_HYPOTHESIS', 'R05_NO_ARMS'])
  const noCrit = fixture({ status: 'DRAFT' }); noCrit.hypothesis.successCriteria = null; noCrit.hypothesis.observationWindow = null
  assert.deepEqual(run(noCrit), ['R02_NO_CRITERIA', 'R03_NO_WINDOW', 'R04_NO_BASELINE'])
  assert.ok(run(fixture({ status: 'RUNNING' }), { outcome: 'INSUFFICIENT_DATA' }).includes('R06_WINDOW_EXPIRED'))
  assert.ok(run(fixture({ status: 'RUNNING' }), { outcome: 'INSUFFICIENT_DATA' }).includes('R08_SMALL_SAMPLE'))
  assert.deepEqual(run(fixture({ status: 'RUNNING' }), { outcome: 'MEETS_DECLARED_CRITERIA' }, { today: '2026-09-05' }), ['R13_MET_BEFORE_END'])
  assert.ok(run(fixture({ status: 'COMPLETED' }), { outcome: 'MEETS_DECLARED_CRITERIA' }).includes('R09_MET_NO_LEARNING'))
  assert.ok(!run(fixture({ status: 'COMPLETED' }), { outcome: 'MEETS_DECLARED_CRITERIA' }, { learnings: [{}], receiptCount: 1 }).includes('R09_MET_NO_LEARNING'))
  assert.deepEqual(run(fixture({ status: 'COMPLETED' }), { outcome: 'DOES_NOT_MEET_DECLARED_CRITERIA' }), ['R10_NOT_MET_NEXT_TEST', 'R11_COMPLETED_NO_DECISION'])
  assert.ok(run(fixture({ status: 'PAUSED', updatedAt: '2026-09-01T00:00:00Z' })).includes('R07_PAUSED_LONG'))
  assert.ok(!run(fixture({ status: 'PAUSED', updatedAt: '2026-09-15T00:00:00Z' })).includes('R07_PAUSED_LONG'))
  assert.ok(run(fixture({ status: 'READY' })).includes('R12_READY_TO_START'))
  assert.deepEqual(run(fixture(), null, { today: 'amanhã' }), [])
  for (const rule of sugg.RULES) { assert.ok(rule.rule.trim().length > 5); assert.match(rule.id, /^R\d{2}_[A-Z_]+$/) }
  assert.equal(new Set(sugg.RULES.map((r) => r.id)).size, sugg.RULES.length)
  const ctx = { experiment: base(), result: null, learnings: [], receiptCount: 0, today: '2026-09-20' }
  assert.deepEqual(sugg.suggestNextSteps(ctx), sugg.suggestNextSteps(clone(ctx)))
})

// 12 — unsafe links
test('links: evidence URLs must be https without credentials; internal hrefs cannot escape', () => {
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'http://example.com', 'https://user:pw@example.com', 'https://localhost', 'https://exa mple.com', 'https://example.com/\u0000', '//example.com', 'ftp://x.com', ' ', 42, null, `https://example.com/${'a'.repeat(2100)}`]) assert.equal(input.safeEvidenceUrl(bad), null, String(bad))
  assert.equal(input.safeEvidenceUrl('https://ads.example.com/report?id=1'), 'https://ads.example.com/report?id=1')
  for (const bad of ['//evil.com', 'https://evil.com', '/apps/../admin', '/apps\\x', 'apps/growth', 'javascript:x', '/a b']) assert.equal(input.safeInternalHref(bad), null, bad)
  assert.equal(input.safeInternalHref('/apps/growth/experimentos/x'), '/apps/growth/experimentos/x')
  assert.equal(ws.experimentHref('demo-landing-cta'), '/apps/growth/experimentos/demo-landing-cta')
  for (const bad of ['../x', 'a/b', 'A', '', 'x'.repeat(65), 'javascript:x']) assert.equal(ws.experimentHref(bad), null, bad)
  assert.throws(() => input.parseManualObservation({ window_start: '2026-09-01', window_end: '2026-09-02', clicks: '1', evidence_url: 'javascript:alert(1)' }), /evidence_url/)
})

// 13 — bounded input, 14 — malformed data
test('manual observations: bounded, malformed and hostile inputs are rejected; absent stays absent', () => {
  const ok = input.parseManualObservation({ window_start: '2026-09-01', window_end: '2026-09-07', impressions: '1000', clicks: 40, spend: '1.200,50', custom: { visitas_loja: '12' }, evidence_url: 'https://ads.example.com/r' })
  assert.deepEqual(ok.values, { impressions: n(1000), clicks: n(40), spend_cents: n(120050), custom: Object.assign(Object.create(null), { visitas_loja: n(12) }) })
  assert.equal(ok.values.leads, undefined) // absent ⇒ UNKNOWN later, never 0
  const bad = (raw) => assert.throws(() => input.parseManualObservation(raw), exact.GrowthInputError, JSON.stringify(raw))
  const w = { window_start: '2026-09-01', window_end: '2026-09-07' }
  bad(null); bad([]); bad('x')
  bad({ ...w, clicks: '1', __proto__polluted: 1 }); bad({ ...w, clicks: '1', company_id: 'other' })
  bad({ ...w }) // no metric
  bad({ window_start: '2026-13-01', window_end: '2026-09-07', clicks: '1' }); bad({ window_start: '2026-09-07', window_end: '2026-09-01', clicks: '1' })
  bad({ window_start: '2025-01-01', window_end: '2026-09-01', clicks: '1' }) // > 366 days
  bad({ ...w, clicks: '-1' }); bad({ ...w, clicks: '1.5' }); bad({ ...w, clicks: 1.5 }); bad({ ...w, clicks: '1e3' }); bad({ ...w, clicks: Number.MAX_SAFE_INTEGER + 2 })
  bad({ ...w, clicks: '10000000000000001' }) // above MAX_MANUAL_VALUE
  bad({ ...w, clicks: '1'.repeat(20) })
  bad({ ...w, impressions: '10', clicks: '11' })
  bad({ ...w, spend: 10 }); bad({ ...w, spend: '10.0' })
  bad({ ...w, custom: { 'Nome Ruim': '1' } }); bad({ ...w, custom: { __proto__: '1', a: '1', ['x'.repeat(41)]: '1' } })
  bad({ ...w, custom: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`m${i}`, '1'])) })
  bad({ ...w, custom: [] })
  const proto = input.parseManualObservation(JSON.parse('{"window_start":"2026-09-01","window_end":"2026-09-02","custom":{"a":"1"}}'))
  assert.equal(Object.getPrototypeOf(proto.values.custom), null)
  assert.throws(() => input.parseManualObservation(JSON.parse('{"window_start":"2026-09-01","window_end":"2026-09-02","clicks":"1","__proto__":{"x":1}}')))
  const warn = input.parseManualObservation({ ...w, clicks: '10', conversions: '12' })
  assert.equal(warn.warnings.length, 1)
  assert.equal(input.parseManualObservation({ ...w, clicks: '', leads: '3' }).values.clicks, undefined)
})

test('sources and providers: only MANUAL / NOT_CONFIGURED exist; no fake integration', () => {
  const sources = providers.mvpSources()
  assert.deepEqual([...new Set(sources.map((s) => s.status))].sort(), ['MANUAL', 'NOT_CONFIGURED'])
  assert.deepEqual(providers.PROVIDERS.map((p) => p.id), ['meta_ads', 'google_ads', 'google_analytics', 'tiktok_ads'])
  for (const p of providers.PROVIDERS) { assert.equal(p.health.status, 'NOT_CONFIGURED'); assert.ok(p.freshnessMaxAgeHours > 0); assert.ok(p.attribution.includes('explicitamente') || p.attribution.includes('declarado')) }
  for (const status of types.SOURCE_STATUSES) assert.ok(providers.SOURCE_STATUS_COPY[status].label)
  assert.ok(demo.demoObservations.every((o) => o.sourceId === 'manual' && o.provenance === 'DECLARED'))
})

test('workspace: board columns, home sections and demo honesty', () => {
  const board = ws.buildBoard(demo.demoExperiments)
  assert.deepEqual(board.columns.map((c) => c.status), ['DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED'])
  assert.deepEqual(board.archived.map((e) => e.status), ['INVALIDATED'])
  assert.equal(board.columns.reduce((sum, c) => sum + c.experiments.length, 0) + board.archived.length, demo.demoExperiments.length)
  assert.deepEqual(ws.buildBoard([...demo.demoExperiments].reverse()), board)
  const home = ws.buildHome({ experiments: demo.demoExperiments, observations: demo.demoObservations, learnings: demo.demoLearnings, receiptsByExperiment: demo.demoReceiptsByExperiment }, demo.GROWTH_DEMO_TODAY)
  assert.deepEqual(home.running.map((e) => e.id), ['demo-landing-cta'])
  assert.deepEqual(home.recentResults.map((r) => r.result.outcome), ['DOES_NOT_MEET_DECLARED_CRITERIA', 'DIRECTIONAL_SIGNAL'])
  assert.ok(home.attention.every((s) => s.severity === 'attention')); assert.ok(home.nextTests.length > 0)
  const outcomes = new Set(demo.demoExperiments.map((e) => ws.buildHome({ experiments: [e], observations: demo.demoObservations, learnings: [], receiptsByExperiment: {} }, demo.GROWTH_DEMO_TODAY).results[e.id].outcome))
  assert.deepEqual([...outcomes].sort(), [...types.RESULT_OUTCOMES].sort()) // demo exercises every outcome via the real evaluator
  assert.match(demo.GROWTH_DEMO_LABEL, /DEMO \/ SAMPLE DATA/)
  assert.ok(demo.demoExperiments.every((e) => e.title.startsWith('DEMO ·') && e.companyId === 'demo-company'))
  assert.ok(demo.demoExperiments.every((e) => ws.experimentHref(e.id)))
  for (const e of demo.demoExperiments.filter((x) => x.hypothesis)) assert.deepEqual(exp.validateHypothesis(e.hypothesis).filter((i) => !['SOURCE'].includes(i.code)), [], e.id)
})

test('setup form: percent parsing, readiness checklist and sign of the criterion follow the direction', () => {
  assert.equal(setup.parsePercentToBps('10'), 1000); assert.equal(setup.parsePercentToBps('7,5'), 750); assert.equal(setup.parsePercentToBps('0,01'), 1)
  for (const bad of ['0', '-5', '10.5', '1,234', '', '99999', 'dez', '1e2']) assert.equal(setup.parsePercentToBps(bad), null, bad)
  const ctx = { id: 'rascunho', companyId: 'c', now: '2026-09-27T00:00:00Z' }
  const empty = setup.evaluateSetup(setup.EMPTY_SETUP, ctx)
  assert.ok(empty.issues.some((i) => i.code === 'NO_HYPOTHESIS')); assert.equal(empty.draft.status, 'DRAFT')
  for (const field of ['title', 'statement', 'source', 'thresholdPercent', 'minSamplePerArm', 'windowStart', 'windowEnd']) assert.ok(empty.fieldErrors[field], `empty ${field} flagged`)
  const full = { ...setup.EMPTY_SETUP, title: 'Teste', statement: 'Mostrar prazo aumenta a conversão.', thresholdPercent: '10', minSamplePerArm: '100', minimumDurationDays: '7', windowStart: '2026-10-01', windowEnd: '2026-10-14', source: 'entrevistas' }
  const ok = setup.evaluateSetup(full, ctx)
  assert.deepEqual(ok.issues, []); assert.deepEqual(ok.fieldErrors, {})
  assert.equal(ok.draft.hypothesis.successCriteria.thresholdBps, 1000); assert.equal(ok.draft.hypothesis.successCriteria.comparator, 'relative_change_at_least')
  assert.equal(exp.transition({ ...ok.draft, status: 'READY' }, 'start', { expectedVersion: 1, at: '2026-10-01T00:00:00Z' }).ok, true)
  const dec = setup.evaluateSetup({ ...full, direction: 'decrease', primaryMetric: 'cac' }, ctx)
  assert.equal(dec.draft.hypothesis.successCriteria.thresholdBps, -1000); assert.equal(dec.draft.hypothesis.successCriteria.comparator, 'relative_change_at_most'); assert.deepEqual(dec.issues, [])
  const badMetric = setup.evaluateSetup({ ...full, primaryMetric: 'javascript:alert(1)' }, ctx)
  assert.ok(badMetric.fieldErrors.primaryMetric)
  assert.ok(setup.evaluateSetup({ ...full, thresholdPercent: 'abc' }, ctx).fieldErrors.thresholdPercent)
  assert.ok(setup.evaluateSetup({ ...full, windowEnd: '2026-10-03' }, ctx).fieldErrors.windowEnd)
  assert.ok(setup.evaluateSetup({ ...full, variantLabel: '' }, ctx).fieldErrors.variantLabel)
  const covered = new Set(setup.READINESS_CHECKS.flatMap((c) => c.codes))
  for (const code of ['TITLE', 'NO_HYPOTHESIS', 'NO_CRITERIA', 'NO_WINDOW', 'NEEDS_VARIANT', 'SOURCE']) assert.ok(covered.has(code), code)
})
