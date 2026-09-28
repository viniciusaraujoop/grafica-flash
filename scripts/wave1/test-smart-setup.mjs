// Wave 1 T2 — Smart Setup pure engine: 14 normative personas (Agent 7 Product Approval §16),
// determinism, validation, branching, caps, authority gate, outcomes, proposal (no apply), purity.
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ss = await import('../../lib/smart-setup/core/index.ts')
const { legacyPrefill } = await import('../../lib/smart-setup/legacy-prefill.ts')
const packs = await import('../../lib/industry-packs/index.ts')
const { buildWave1PackRegistry, buildSmartSetupManifest } = await import('../../lib/wave1/manifest.ts')
const { sha256Hex } = await import('../../lib/wave1/shared/sha256.server.ts')
const { stableStringify } = await import('../../lib/wave1/shared/canonical.ts')

const { industryPackCatalog, CAPABILITY_KEYS } = packs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hash = sha256Hex
const recommend = (answers, extra = {}) => ss.recommendSmartSetup(answers, { catalog: industryPackCatalog, hash, ...extra })
const score = (result, pack) => result.packScores.find((entry) => entry.pack === pack)
const bps = (result, pack) => score(result, pack).confidence.bps
const clone = (value) => structuredClone(value)

// Deterministic PRNG for shuffles (tests only; the engine itself has no randomness).
function lcg(seed) {
  let state = seed >>> 0
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}
function shuffle(list, random) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---- 14 normative personas (§16) -------------------------------------------------------------------------
const PERSONAS = {
  G1: {
    answers: { 'q.business_type': 'GRAPHICS', 'q.subsegment': 'PRINT_SHOP', 'q.offer_kind': 'BOTH', 'q.quote_flow': 'FREQUENT', 'q.production': 'CUSTOM_TO_ORDER', 'q.art_approval': 'REQUIRED', 'q.fulfillment': ['PICKUP', 'DELIVERY'], 'q.stock_control': 'SIMPLE_STOCK' },
    outcome: 'CLEAR_MATCH', primary: 'graphic.print_shop', codes: ['DECLARED_BUSINESS_TYPE', 'SUBSEGMENT_MATCH', 'QUOTE_LED_OPERATION', 'CUSTOM_PRODUCTION', 'ART_APPROVAL', 'DELIVERY_OPERATION', 'PICKUP_OPERATION'],
  },
  G2: {
    answers: { 'q.business_type': 'GRAPHICS', 'q.subsegment': 'VISUAL_COMMUNICATION', 'q.offer_kind': 'BOTH', 'q.quote_flow': 'FREQUENT', 'q.production': 'MULTI_STAGE', 'q.art_approval': 'SOMETIMES', 'q.fulfillment': ['ON_SITE', 'PICKUP'], 'q.lead_followup': 'FREQUENT' },
    outcome: 'CLEAR_MATCH', primary: 'graphic.print_shop', codes: ['DECLARED_BUSINESS_TYPE', 'QUOTE_LED_OPERATION', 'PRODUCTION_TRACKING', 'ART_APPROVAL'],
  },
  F1: {
    answers: { 'q.business_type': 'FOOD', 'q.subsegment': 'RESTAURANT', 'q.offer_kind': 'PRODUCTS', 'q.sales_channels': ['IN_PERSON', 'WHATSAPP'], 'q.production': 'SIMPLE_PREPARATION', 'q.fulfillment': ['DELIVERY', 'PICKUP'], 'q.stock_control': 'SIMPLE_STOCK' },
    outcome: 'CLEAR_MATCH', primary: 'food.restaurant', codes: ['DECLARED_BUSINESS_TYPE', 'FOOD_PREPARATION', 'DELIVERY_OPERATION', 'STOCK_OPERATION'],
  },
  F2: {
    answers: { 'q.business_type': 'FOOD', 'q.subsegment': 'DARK_KITCHEN', 'q.offer_kind': 'PRODUCTS', 'q.sales_channels': ['WEBSITE_ECOMMERCE', 'WHATSAPP'], 'q.production': 'SIMPLE_PREPARATION', 'q.fulfillment': ['DELIVERY'], 'q.stock_control': 'SIMPLE_STOCK' },
    outcome: 'CLEAR_MATCH', primary: 'food.restaurant', codes: ['DECLARED_BUSINESS_TYPE', 'FOOD_PREPARATION', 'DELIVERY_OPERATION'],
  },
  S1: {
    answers: { 'q.business_type': 'SERVICES', 'q.subsegment': 'TECHNICAL_ASSISTANCE', 'q.offer_kind': 'SERVICES', 'q.quote_flow': 'FREQUENT', 'q.fulfillment': ['ON_SITE'], 'q.scheduling': 'FREQUENT', 'q.lead_followup': 'SOMETIMES' },
    outcome: 'CLEAR_MATCH', primary: 'services.general', codes: ['DECLARED_BUSINESS_TYPE', 'QUOTE_LED_OPERATION', 'ON_SITE_SERVICE', 'APPOINTMENT_LED_SERVICE'],
  },
  S2: {
    answers: { 'q.business_type': 'SERVICES', 'q.subsegment': 'CONSULTING', 'q.offer_kind': 'SERVICES', 'q.sales_channels': ['WHATSAPP', 'WEBSITE_ECOMMERCE'], 'q.quote_flow': 'SOMETIMES', 'q.fulfillment': ['DIGITAL_OR_REMOTE'], 'q.scheduling': 'FREQUENT', 'q.lead_followup': 'FREQUENT' },
    outcome: 'CLEAR_MATCH', primary: 'services.general', codes: ['DECLARED_BUSINESS_TYPE', 'APPOINTMENT_LED_SERVICE', 'CRM_FOLLOWUP', 'QUOTE_LED_OPERATION'],
  },
  R1: {
    answers: { 'q.business_type': 'STORE', 'q.subsegment': 'LOCAL_RETAIL', 'q.offer_kind': 'PRODUCTS', 'q.sales_channels': ['IN_PERSON', 'WHATSAPP'], 'q.fulfillment': ['PICKUP'], 'q.stock_control': 'WAREHOUSE_OR_DEPOSIT' },
    outcome: 'CLEAR_MATCH', primary: 'store.local_store', codes: ['DECLARED_BUSINESS_TYPE', 'OFFER_PRODUCTS', 'DEPOSIT_OR_MULTI_LOCATION', 'PICKUP_OPERATION'],
  },
  R2: {
    answers: { 'q.business_type': 'STORE', 'q.subsegment': 'HYBRID_PHYSICAL_ONLINE', 'q.offer_kind': 'PRODUCTS', 'q.sales_channels': ['IN_PERSON', 'WEBSITE_ECOMMERCE', 'MARKETPLACE'], 'q.fulfillment': ['DELIVERY', 'PICKUP'], 'q.stock_control': 'MULTI_LOCATION' },
    outcome: 'CLEAR_MATCH', primary: 'store.local_store', codes: ['DECLARED_BUSINESS_TYPE', 'MARKETPLACE_SALES', 'DEPOSIT_OR_MULTI_LOCATION'],
  },
  A1: {
    answers: { 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'BOTH', 'q.quote_flow': 'FREQUENT', 'q.production': 'CUSTOM_TO_ORDER', 'q.art_approval': 'NO', 'q.fulfillment': ['ON_SITE'], 'q.scheduling': 'FREQUENT', 'q.lead_followup': 'FREQUENT' },
    outcome: 'AMBIGUOUS', primary: null, candidates: ['graphic.print_shop', 'services.general'], codes: ['CLOSE_CANDIDATES', 'QUOTE_LED_OPERATION', 'CUSTOM_PRODUCTION', 'ON_SITE_SERVICE', 'APPOINTMENT_LED_SERVICE', 'CRM_FOLLOWUP'],
  },
  A2: {
    answers: { 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'PRODUCTS', 'q.sales_channels': ['IN_PERSON', 'WEBSITE_ECOMMERCE'], 'q.production': 'SIMPLE_PREPARATION', 'q.fulfillment': ['DELIVERY', 'PICKUP'], 'q.stock_control': 'SIMPLE_STOCK' },
    outcome: 'AMBIGUOUS', primary: null, candidates: ['food.restaurant', 'store.local_store'], codes: ['CLOSE_CANDIDATES', 'FOOD_PREPARATION', 'CATALOG_SALES', 'STOCK_OPERATION'],
  },
  N1: {
    answers: { 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'BOTH', 'q.sales_channels': ['WHATSAPP'], 'q.quote_flow': 'NO', 'q.production': 'NO', 'q.fulfillment': ['NONE_OR_NOT_APPLICABLE'], 'q.scheduling': 'NO', 'q.stock_control': 'NO_STOCK', 'q.lead_followup': 'NO' },
    outcome: 'NO_CLEAR_MATCH', primary: null, codes: ['WEAK_EVIDENCE'],
  },
  N2: {
    answers: { 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'NOT_SURE', 'q.sales_channels': ['WHATSAPP'], 'q.quote_flow': 'NOT_SURE', 'q.production': 'NOT_SURE' },
    outcome: 'NO_CLEAR_MATCH', primary: null, codes: ['INSUFFICIENT_COMPLETENESS'],
  },
  B1: {
    answers: { 'q.business_type': 'SERVICES', 'q.subsegment': 'NOT_SURE', 'q.offer_kind': 'NOT_SURE' },
    outcome: 'BUSINESS_TYPE_ONLY', primary: 'services.general', codes: ['DECLARED_BUSINESS_TYPE', 'INSUFFICIENT_COMPLETENESS'],
  },
  C1: {
    answers: { 'q.business_type': 'STORE', 'q.subsegment': 'LOCAL_RETAIL', 'q.offer_kind': 'SERVICES', 'q.quote_flow': 'FREQUENT', 'q.production': 'NO', 'q.fulfillment': ['ON_SITE'], 'q.scheduling': 'FREQUENT', 'q.stock_control': 'NO_STOCK', 'q.lead_followup': 'FREQUENT' },
    outcome: 'BUSINESS_TYPE_ONLY', primary: 'store.local_store', alternative: 'services.general', codes: ['DECLARED_BUSINESS_TYPE', 'CROSS_SEGMENT_SIGNAL', 'COUNTER_SIGNAL_EXPLICIT', 'WEAK_EVIDENCE'],
  },
}

for (const [name, persona] of Object.entries(PERSONAS)) {
  test(`persona ${name}: ${persona.outcome}${persona.primary ? ` → ${persona.primary}` : ' (primary null)'}`, () => {
    const result = recommend(persona.answers)
    assert.equal(result.outcome, persona.outcome)
    assert.equal(result.primaryPack, persona.primary)
    assert.deepEqual(result.inputIssues, [], 'persona answers are valid contract input')
    if (persona.candidates) assert.deepEqual([...result.candidates].sort(), persona.candidates)
    else assert.deepEqual(result.candidates, [])
    for (const code of persona.codes) assert.ok(result.rationaleCodes.includes(code), `${name} rationale includes ${code}: ${result.rationaleCodes.join(',')}`)
    if (persona.alternative) {
      assert.deepEqual(result.alternativeSignals.map((signal) => signal.pack), [persona.alternative])
      assert.equal(result.alternativeSignals[0].label, 'ALTERNATIVE_SIGNAL')
      assert.equal(result.alternativeSignals[0].requiresExplicitUserChoice, true)
    } else assert.deepEqual(result.alternativeSignals, [])
    assert.equal(result.applied, false)
    assert.equal(result.applyStatus, 'NOT_AUTHORIZED')
  })
}

test('persona score snapshot (regression guard for the ruleset table)', () => {
  const snapshot = Object.fromEntries(
    Object.entries(PERSONAS).map(([name, persona]) => {
      const result = recommend(persona.answers)
      return [name, [result.completeness.ratio.bps, ...result.packScores.map((entry) => entry.confidence.bps)]]
    }),
  )
  // [completeness, graphic, food, services, store] in basis points.
  assert.deepEqual(snapshot, {
    G1: [7000, 8043, 2608, 2608, 2608],
    G2: [7000, 8043, 2608, 5217, 2608],
    F1: [8571, 3000, 7000, 750, 4500],
    F2: [8571, 3000, 7000, 750, 5250],
    S1: [6666, 2250, 0, 7750, 0],
    S2: [7777, 1956, 0, 7391, 0],
    R1: [6250, 2647, 3529, 0, 8235],
    R2: [6250, 2647, 3529, 0, 10000],
    A1: [7777, 5000, 714, 5714, 1428],
    A2: [7142, 4000, 6000, 1000, 7000],
    N1: [10000, 625, 625, 625, 625],
    N2: [1250, 0, 0, 0, 0],
    B1: [0, 0, 0, 0, 0],
    C1: [8888, 2307, 0, 4615, 961],
  })
})

// ---- Determinism ------------------------------------------------------------------------------------------
test('same input + same catalog → byte-equivalent canonical output', () => {
  for (const persona of Object.values(PERSONAS)) {
    const a = stableStringify(recommend(persona.answers))
    const b = stableStringify(recommend(clone(persona.answers)))
    assert.ok(a !== null)
    assert.equal(a, b)
  }
})

test('input key order and multi-select order never change the result', () => {
  const random = lcg(7)
  for (const persona of Object.values(PERSONAS)) {
    const baseline = stableStringify(recommend(persona.answers))
    for (let round = 0; round < 10; round += 1) {
      const reordered = {}
      for (const key of shuffle(Object.keys(persona.answers), random)) {
        const value = persona.answers[key]
        reordered[key] = Array.isArray(value) ? shuffle(value, random) : value
      }
      assert.equal(stableStringify(recommend(reordered)), baseline)
    }
  }
})

test('catalog shuffled 100 times → identical result and catalog fingerprint', () => {
  const random = lcg(2026)
  const baselines = Object.fromEntries(Object.entries(PERSONAS).map(([name, persona]) => [name, stableStringify(recommend(persona.answers))]))
  for (let round = 0; round < 100; round += 1) {
    const catalog = shuffle(industryPackCatalog, random)
    for (const [name, persona] of Object.entries(PERSONAS)) {
      assert.equal(stableStringify(ss.recommendSmartSetup(persona.answers, { catalog, hash })), baselines[name], `${name} round ${round}`)
    }
  }
})

test('fingerprints: stable, input-sensitive, catalog-sensitive, and never raw answers', () => {
  const a = recommend(PERSONAS.G1.answers)
  const b = recommend({ ...PERSONAS.G1.answers, 'q.stock_control': 'NO_STOCK' })
  assert.match(a.inputFingerprint, /^[0-9a-f]{64}$/)
  assert.notEqual(a.inputFingerprint, b.inputFingerprint)
  assert.equal(a.catalogFingerprint, b.catalogFingerprint)
  const other = recommend(PERSONAS.G1.answers, { catalog: industryPackCatalog.filter((pack) => pack.key !== 'food.restaurant') })
  assert.notEqual(other.catalogFingerprint, a.catalogFingerprint)
  // Hidden/ignored answers do not change the input fingerprint (only effective normalized answers count).
  const withHidden = recommend({ ...PERSONAS.F1.answers, 'q.lead_followup': 'FREQUENT' })
  assert.equal(withHidden.inputFingerprint, recommend(PERSONAS.F1.answers).inputFingerprint)
})

// ---- Validation / normalization ---------------------------------------------------------------------------
test('invalid option → dropped and reported (no score, no echo)', () => {
  const result = recommend({ ...PERSONAS.R1.answers, 'q.stock_control': 'BIG_WAREHOUSE', 'q.sales_channels': ['IN_PERSON', 'TELEPATHY'] })
  assert.deepEqual(result.inputIssues, [
    { code: 'INVALID_OPTION', questionId: 'q.sales_channels' },
    { code: 'INVALID_OPTION', questionId: 'q.stock_control' },
  ])
  assert.equal(result.questions.find((question) => question.id === 'q.stock_control').status, 'UNANSWERED')
  assert.deepEqual(result.questions.find((question) => question.id === 'q.sales_channels').selected, ['IN_PERSON'])
  assert.ok(!JSON.stringify(result).includes('TELEPATHY'))
})

test('unknown and removed questions → dropped and reported; q.main_goal / q.deposit have zero impact', () => {
  const baseline = recommend(PERSONAS.S1.answers)
  const result = recommend({ ...PERSONAS.S1.answers, 'q.main_goal': 'SELL_MORE', 'q.deposit': 'YES', 'q.team_size': '10', 'q.delivery': 'YES', 'q.favorite_color': 'blue', 'Nome da empresa': 'ACME' })
  assert.deepEqual(result.inputIssues.map((issue) => `${issue.code}:${issue.questionId}`).sort(), [
    'REMOVED_QUESTION:q.delivery',
    'REMOVED_QUESTION:q.deposit',
    'REMOVED_QUESTION:q.main_goal',
    'REMOVED_QUESTION:q.team_size',
    'UNKNOWN_QUESTION:null',
    'UNKNOWN_QUESTION:q.favorite_color',
  ])
  assert.deepEqual(result.packScores, baseline.packScores)
  assert.equal(result.outcome, baseline.outcome)
  assert.equal(ss.WEIGHTS.GOAL_ALIGNMENT, 0)
  assert.ok(!ss.QUESTION_IDS.includes('q.main_goal') && !ss.QUESTION_IDS.includes('q.deposit'))
})

test('free text and PII-shaped fields → zero score impact and never copied into the result', () => {
  const secret = 'Maria Silva, maria@example.com, 11 99999-0000, CPF 123.456.789-00, Rua X 10: vendemos marmita e fazemos gráfica'
  const baseline = recommend(PERSONAS.A2.answers)
  const result = recommend({ ...PERSONAS.A2.answers, description: secret, email: 'maria@example.com', 'q.offer_kind_text': secret, 'q.subsegment': secret, 'q.business_type': 'NOT_SURE' })
  assert.deepEqual(result.packScores, baseline.packScores)
  assert.equal(result.outcome, baseline.outcome)
  const serialized = JSON.stringify(result)
  for (const fragment of ['Maria', 'maria@', '99999', '123.456', 'Rua X', 'marmita']) assert.ok(!serialized.includes(fragment), fragment)
  // A free-text value in a single-choice field is an invalid option (ignored), never a scoring signal.
  const textInField = recommend({ ...PERSONAS.S1.answers, 'q.offer_kind': 'SERVIÇOS DE TI' })
  assert.equal(textInField.questions.find((question) => question.id === 'q.offer_kind').status, 'UNANSWERED')
})

test('NOT_SURE → valid answer, zero score and not counted as answered evidence', () => {
  const withNotSure = recommend({ ...PERSONAS.F1.answers, 'q.stock_control': 'NOT_SURE' })
  const unanswered = recommend(Object.fromEntries(Object.entries(PERSONAS.F1.answers).filter(([key]) => key !== 'q.stock_control')))
  assert.deepEqual(withNotSure.inputIssues, [])
  assert.equal(withNotSure.questions.find((question) => question.id === 'q.stock_control').status, 'NOT_SURE')
  assert.deepEqual(withNotSure.packScores, unanswered.packScores)
  assert.deepEqual(withNotSure.completeness, unanswered.completeness)
  // NOT_SURE on business_type is valid and is not an authority.
  const notSure = recommend({ 'q.business_type': 'NOT_SURE' })
  assert.equal(notSure.declaredBusinessType, null)
  assert.deepEqual(notSure.inputIssues, [])
})

test('multi-select: NOT_SURE mixed with options is dropped; duplicates and empty selections are reported', () => {
  const result = recommend({ ...PERSONAS.R1.answers, 'q.sales_channels': ['WHATSAPP', 'NOT_SURE', 'WHATSAPP'], 'q.fulfillment': [] })
  assert.deepEqual(result.inputIssues.map((issue) => issue.code).sort(), ['DUPLICATE_OPTION', 'EMPTY_SELECTION', 'NOT_SURE_MIXED_WITH_OPTIONS'])
  assert.deepEqual(result.questions.find((question) => question.id === 'q.sales_channels').selected, ['WHATSAPP'])
  assert.equal(result.questions.find((question) => question.id === 'q.fulfillment').status, 'UNANSWERED')
  const onlyNotSure = recommend({ ...PERSONAS.R1.answers, 'q.sales_channels': ['NOT_SURE'] })
  assert.equal(onlyNotSure.questions.find((question) => question.id === 'q.sales_channels').status, 'NOT_SURE')
})

test('wrong value types and non-object input are rejected safely', () => {
  const result = recommend({ ...PERSONAS.R1.answers, 'q.offer_kind': ['PRODUCTS'], 'q.sales_channels': 'IN_PERSON', 'q.quote_flow': 42 })
  assert.deepEqual(result.inputIssues.map((issue) => `${issue.code}:${issue.questionId}`).sort(), ['INVALID_VALUE_TYPE:q.offer_kind', 'INVALID_VALUE_TYPE:q.quote_flow', 'INVALID_VALUE_TYPE:q.sales_channels'])
  for (const input of [null, 'GRAPHICS', ['q.business_type'], 7, Object.create(null)]) {
    const bad = recommend(input)
    assert.deepEqual(bad.inputIssues, [{ code: 'ANSWERS_NOT_OBJECT', questionId: null }])
    assert.equal(bad.outcome, 'NO_CLEAR_MATCH')
    assert.equal(bad.primaryPack, null)
  }
  const many = { ...PERSONAS.R1.answers }
  for (let i = 0; i < 80; i += 1) many[`extra_${i}`] = i
  assert.ok(recommend(many).inputIssues.some((issue) => issue.code === 'TOO_MANY_FIELDS'))
  // Subsegment options depend on the declared type: a Food subsegment under GRAPHICS is invalid.
  const wrongSub = recommend({ ...PERSONAS.G1.answers, 'q.subsegment': 'PIZZERIA' })
  assert.deepEqual(wrongSub.inputIssues, [{ code: 'INVALID_OPTION', questionId: 'q.subsegment' }])
})

// ---- Branching ---------------------------------------------------------------------------------------------
test('conditional questions follow the approved branching rules', () => {
  const state = (answers, id) => recommend(answers).questions.find((question) => question.id === id).presented
  assert.equal(state({ 'q.business_type': 'NOT_SURE' }, 'q.subsegment'), false)
  assert.equal(state({ 'q.business_type': 'FOOD' }, 'q.subsegment'), true)
  assert.equal(state({ 'q.business_type': 'GRAPHICS' }, 'q.art_approval'), true)
  assert.equal(state({ 'q.business_type': 'NOT_SURE', 'q.production': 'CUSTOM_TO_ORDER' }, 'q.art_approval'), true)
  assert.equal(state({ 'q.business_type': 'STORE', 'q.production': 'MULTI_STAGE' }, 'q.art_approval'), false)
  assert.equal(state({ 'q.business_type': 'STORE', 'q.offer_kind': 'PRODUCTS', 'q.fulfillment': ['PICKUP'] }, 'q.scheduling'), false)
  assert.equal(state({ 'q.business_type': 'STORE', 'q.offer_kind': 'PRODUCTS', 'q.fulfillment': ['ON_SITE'] }, 'q.scheduling'), true)
  assert.equal(state({ 'q.business_type': 'STORE', 'q.offer_kind': 'PRODUCTS', 'q.fulfillment': ['DIGITAL_OR_REMOTE'] }, 'q.scheduling'), true)
  assert.equal(state({ 'q.business_type': 'SERVICES', 'q.offer_kind': 'PRODUCTS' }, 'q.scheduling'), true)
  assert.equal(state({ 'q.business_type': 'NOT_SURE' }, 'q.scheduling'), true)
  assert.equal(state({ 'q.business_type': 'FOOD' }, 'q.lead_followup'), false)
  assert.equal(state({ 'q.business_type': 'STORE' }, 'q.lead_followup'), true)
  for (const definition of ss.QUESTIONNAIRE_V1) assert.equal(definition.condition !== null, ['q.subsegment', 'q.art_approval', 'q.scheduling', 'q.lead_followup'].includes(definition.id))
})

test('hidden question → answer ignored and reported, zero completeness penalty', () => {
  const base = PERSONAS.F1.answers
  const withHidden = recommend({ ...base, 'q.lead_followup': 'FREQUENT', 'q.scheduling': 'FREQUENT', 'q.art_approval': 'REQUIRED' })
  const plain = recommend(base)
  assert.deepEqual(withHidden.inputIssues.map((issue) => `${issue.code}:${issue.questionId}`).sort(), [
    'HIDDEN_QUESTION_ANSWER_IGNORED:q.art_approval',
    'HIDDEN_QUESTION_ANSWER_IGNORED:q.lead_followup',
    'HIDDEN_QUESTION_ANSWER_IGNORED:q.scheduling',
  ])
  assert.deepEqual(withHidden.completeness, plain.completeness)
  assert.deepEqual(withHidden.packScores, plain.packScores)
  // Hidden questions are not in the completeness denominator.
  assert.equal(plain.completeness.presentedScored, plain.questions.filter((question) => question.scored && question.status !== 'HIDDEN').length)
})

// ---- Scoring rules -----------------------------------------------------------------------------------------
test('weights and thresholds are exactly the approved V1 values; BusinessType has no numeric weight', () => {
  assert.deepEqual({ ...ss.WEIGHTS }, { SUBSEGMENT: 10, STRONG: 6, WEAK: 3, EXPLICIT_CONTRADICTION: 8, GOAL_ALIGNMENT: 0 })
  assert.equal(ss.MAX_PACK_POINTS_PER_QUESTION, 6)
  assert.deepEqual({ ...ss.THRESHOLDS_BPS }, { T_CLEAR: 7000, T_MIN: 4500, MARGIN: 1500, MIN_COMPLETENESS: 4000 })
  assert.deepEqual([...ss.OUTCOMES], ['CLEAR_MATCH', 'AMBIGUOUS', 'NO_CLEAR_MATCH', 'BUSINESS_TYPE_ONLY'])
  assert.ok(!ss.EVIDENCE_RULES.some((rule) => rule.questionId === 'q.business_type' || rule.questionId === 'q.team_mode'))
  const source = readFileSync(path.join(root, 'lib/smart-setup/core/ruleset.ts'), 'utf8')
  assert.ok(!/W_BT\s*[:=]/.test(source))
  // Declaring a type changes eligibility, never support: same operational answers → same support per pack.
  const operational = { ...PERSONAS.A1.answers }
  delete operational['q.business_type']
  const declared = recommend({ ...operational, 'q.business_type': 'GRAPHICS' })
  const undeclared = recommend({ ...operational, 'q.business_type': 'NOT_SURE' })
  for (const pack of ss.SMART_SETUP_PACKS) assert.equal(score(declared, pack).rawSupport, score(undeclared, pack).rawSupport)
})

test('q.team_mode infers cap.team_tasks but contributes zero pack points and zero completeness', () => {
  const base = recommend(PERSONAS.S1.answers)
  const team = recommend({ ...PERSONAS.S1.answers, 'q.team_mode': 'TEAM_SHARED_TASKS' })
  assert.deepEqual(team.packScores, base.packScores)
  assert.deepEqual(team.completeness, base.completeness)
  assert.ok(team.recommendedCapabilities.some((entry) => entry.capability === 'cap.team_tasks' && entry.sources.some((source) => source.questionId === 'q.team_mode')))
  const solo = recommend({ ...PERSONAS.R1.answers, 'q.team_mode': 'SOLO' })
  assert.ok(!solo.recommendedCapabilities.some((entry) => entry.capability === 'cap.team_tasks'))
})

test('multi-select per-question cap: many options never exceed one strong unit per pack', () => {
  const all = recommend({ 'q.business_type': 'NOT_SURE', 'q.fulfillment': ['DELIVERY', 'PICKUP', 'ON_SITE', 'DIGITAL_OR_REMOTE'], 'q.sales_channels': ['IN_PERSON', 'WHATSAPP', 'WEBSITE_ECOMMERCE', 'INSTAGRAM_SOCIAL', 'MARKETPLACE', 'PHONE_OTHER'] })
  for (const pack of ss.SMART_SETUP_PACKS) {
    for (const questionId of ['q.fulfillment', 'q.sales_channels']) {
      const counted = all.supportingSignals.filter((signal) => signal.pack === pack && signal.questionId === questionId).reduce((sum, signal) => sum + signal.points, 0)
      assert.ok(counted <= 6, `${pack} ${questionId} ${counted}`)
    }
  }
  // Store: delivery (6) + pickup (6) capped to 6 on fulfillment; marketplace (6) + website (3) capped to 6 on channels.
  assert.equal(score(all, 'store.local_store').rawSupport, 12)
  const absorbed = all.supportingSignals.filter((signal) => signal.pack === 'store.local_store' && signal.points === 0)
  assert.ok(absorbed.length >= 2)
})

test('subsegment: known value +10 to the declared pack only; OTHER/NOT_SURE never score or contradict', () => {
  const known = recommend({ 'q.business_type': 'FOOD', 'q.subsegment': 'PIZZERIA' })
  assert.equal(score(known, 'food.restaurant').rawSupport, 10)
  for (const pack of ['graphic.print_shop', 'services.general', 'store.local_store']) assert.equal(score(known, pack).rawSupport, 0)
  const other = recommend({ 'q.business_type': 'FOOD', 'q.subsegment': 'OTHER' })
  assert.equal(score(other, 'food.restaurant').rawSupport, 0)
  assert.equal(score(other, 'food.restaurant').rawPenalty, 0)
  assert.equal(other.questions.find((question) => question.id === 'q.subsegment').status, 'ANSWERED')
  const notSure = recommend({ 'q.business_type': 'FOOD', 'q.subsegment': 'NOT_SURE' })
  assert.equal(notSure.questions.find((question) => question.id === 'q.subsegment').status, 'NOT_SURE')
  assert.equal(notSure.completeness.answeredScored, 0)
})

test('offer SERVICES gives weak Graphics only where custom work exists', () => {
  const withoutCustom = recommend({ 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'SERVICES' })
  const withCustom = recommend({ 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'SERVICES', 'q.production': 'MULTI_STAGE' })
  const offerPoints = (result) => result.supportingSignals.filter((signal) => signal.pack === 'graphic.print_shop' && signal.questionId === 'q.offer_kind').reduce((sum, signal) => sum + signal.points, 0)
  assert.equal(offerPoints(withoutCustom), 0)
  assert.equal(offerPoints(withCustom), 3)
})

test('ADAPTATION A1: on-site + scheduling share one strong unit for Services (family cap)', () => {
  const result = recommend(PERSONAS.A1.answers)
  const family = result.supportingSignals.filter((signal) => signal.pack === 'services.general' && (signal.questionId === 'q.scheduling' || (signal.questionId === 'q.fulfillment' && signal.option === 'ON_SITE')))
  assert.equal(family.reduce((sum, signal) => sum + signal.points, 0), 6)
  assert.deepEqual(family.map((signal) => [signal.questionId, signal.points, signal.nominalPoints]), [['q.fulfillment', 6, 6], ['q.scheduling', 0, 6]])
  // Remote service is not part of the family: S2 keeps both units.
  const s2 = recommend(PERSONAS.S2.answers)
  assert.equal(s2.supportingSignals.find((signal) => signal.pack === 'services.general' && signal.questionId === 'q.scheduling').points, 6)
  assert.equal(ss.EVIDENCE_FAMILIES.length, 1)
})

test('ADAPTATION A2: SIMPLE_STOCK is weak Store; warehouse/multi-location is strong Store', () => {
  const simple = recommend({ 'q.business_type': 'NOT_SURE', 'q.stock_control': 'SIMPLE_STOCK' })
  const warehouse = recommend({ 'q.business_type': 'NOT_SURE', 'q.stock_control': 'WAREHOUSE_OR_DEPOSIT' })
  assert.equal(score(simple, 'store.local_store').rawSupport, 3)
  assert.equal(score(warehouse, 'store.local_store').rawSupport, 6)
  assert.equal(score(simple, 'food.restaurant').rawSupport, 3)
})

test('contradiction −8 only for explicit mappings; atypical is not invalid (§14.2)', () => {
  const penalties = (answers) => recommend(answers).packScores.reduce((sum, entry) => sum + entry.rawPenalty, 0)
  assert.equal(penalties({ 'q.business_type': 'FOOD', 'q.subsegment': 'RESTAURANT', 'q.fulfillment': ['NONE_OR_NOT_APPLICABLE'] }), 0, 'restaurant without delivery')
  assert.equal(penalties({ 'q.business_type': 'STORE', 'q.stock_control': 'NO_STOCK' }), 0, 'store without stock')
  assert.equal(penalties({ 'q.business_type': 'SERVICES', 'q.offer_kind': 'PRODUCTS' }), 0, 'services selling products')
  assert.equal(penalties({ 'q.business_type': 'GRAPHICS', 'q.art_approval': 'NO' }), 0, 'graphics without art approval')
  const c1 = recommend(PERSONAS.C1.answers)
  assert.deepEqual(c1.counterSignals.map((signal) => [signal.pack, signal.questionId, signal.option, signal.points, signal.kind]), [['store.local_store', 'q.offer_kind', 'SERVICES', 8, 'CROSS_SEGMENT_COUNTER_SIGNAL']])
  assert.equal(score(c1, 'store.local_store').rawScore, Math.max(0, score(c1, 'store.local_store').rawSupport - 8))
})

test('confidence is clamped 0..1 on a shared answered-evidence denominator and is not a probability', () => {
  for (const persona of Object.values(PERSONAS)) {
    const result = recommend(persona.answers)
    for (const entry of result.packScores) {
      assert.ok(entry.confidence.bps >= 0 && entry.confidence.bps <= 10000)
      assert.equal(entry.maxAvailableSupport, result.packScores[0].maxAvailableSupport)
      assert.equal(entry.rawScore, Math.max(0, entry.rawSupport - entry.rawPenalty))
    }
    const total = result.packScores.reduce((sum, entry) => sum + entry.confidence.bps, 0)
    if (persona === PERSONAS.G2) assert.ok(total > 10000, 'confidences do not sum to 1: not a probability distribution')
  }
  // Store at 1.0 in R2 even with penalties elsewhere; a heavily penalized pack floors at 0.
  assert.equal(bps(recommend(PERSONAS.R2.answers), 'store.local_store'), 10000)
  assert.equal(recommend({ 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'SERVICES' }).packScores.find((entry) => entry.pack === 'store.local_store').rawScore, 0)
})

// ---- Outcomes and boundaries ------------------------------------------------------------------------------
test('exact boundaries: 0.70 confidence and 0.40 completeness are inclusive (integer arithmetic)', () => {
  const f1 = recommend(PERSONAS.F1.answers)
  assert.equal(bps(f1, 'food.restaurant'), 7000)
  assert.equal(f1.outcome, 'CLEAR_MATCH')
  // One point below T_CLEAR → BUSINESS_TYPE_ONLY (unit-level check on the resolver).
  const completeness = { answeredScored: 2, presentedScored: 5, ratio: ss.ratio(2, 5), meetsMinimum: ss.atLeast(ss.ratio(2, 5), 4000) }
  assert.equal(completeness.meetsMinimum, true)
  assert.equal(ss.atLeast(ss.ratio(1, 3), 4000), false)
  const mk = (pack, rawScore, max) => ({ pack, rawSupport: rawScore, rawPenalty: 0, rawScore, maxAvailableSupport: max, confidence: ss.ratio(rawScore, max) })
  const declaredAt = (raw) => ss.resolveOutcome({ declaredPack: 'food.restaurant', declaredPackAvailable: true, scores: [mk('food.restaurant', raw, 100)], completeness, hardContradictions: [] }).outcome
  assert.equal(declaredAt(70), 'CLEAR_MATCH')
  assert.equal(declaredAt(69), 'BUSINESS_TYPE_ONLY')
  // Margin exactly 0.15 is enough; 0.14 is not.
  const undeclared = (top, second) => ss.resolveOutcome({ declaredPack: null, declaredPackAvailable: false, scores: [mk('graphic.print_shop', top, 100), mk('services.general', second, 100)], completeness, hardContradictions: [] }).outcome
  assert.equal(undeclared(85, 70), 'CLEAR_MATCH')
  assert.equal(undeclared(85, 71), 'AMBIGUOUS')
  assert.equal(undeclared(70, 55), 'CLEAR_MATCH')
  assert.equal(undeclared(69, 50), 'AMBIGUOUS')
  assert.equal(undeclared(69, 44), 'NO_CLEAR_MATCH', 'single moderate candidate')
  assert.equal(undeclared(44, 44), 'NO_CLEAR_MATCH', 'below T_MIN')
  assert.equal(undeclared(45, 45), 'AMBIGUOUS', 'exact tie never auto-broken')
  const low = { answeredScored: 1, presentedScored: 3, ratio: ss.ratio(1, 3), meetsMinimum: false }
  assert.equal(ss.resolveOutcome({ declaredPack: null, declaredPackAvailable: false, scores: [mk('graphic.print_shop', 100, 100)], completeness: low, hardContradictions: [] }).outcome, 'NO_CLEAR_MATCH')
  assert.equal(ss.resolveOutcome({ declaredPack: null, declaredPackAvailable: false, scores: [mk('graphic.print_shop', 100, 100)], completeness, hardContradictions: [] }).outcome, 'CLEAR_MATCH', 'single eligible pack')
  assert.equal(ss.resolveOutcome({ declaredPack: null, declaredPackAvailable: false, scores: [], completeness, hardContradictions: [] }).outcome, 'NO_CLEAR_MATCH')
})

test('AMBIGUOUS never auto-breaks a tie: exact tie keeps primary null regardless of pack order', () => {
  // Food and Store both reach exactly 0.75 (18/24): the engine must not pick either.
  const answers = { 'q.business_type': 'NOT_SURE', 'q.offer_kind': 'PRODUCTS', 'q.production': 'SIMPLE_PREPARATION', 'q.fulfillment': ['DELIVERY'], 'q.stock_control': 'SIMPLE_STOCK' }
  const result = recommend(answers)
  assert.equal(bps(result, 'food.restaurant'), 7500)
  assert.equal(bps(result, 'store.local_store'), 7500)
  assert.equal(result.outcome, 'AMBIGUOUS')
  assert.equal(result.primaryPack, null)
  // Every pack with meaningful support (>= T_MIN) is shown: the tied pair plus Graphics at 0.50.
  assert.deepEqual([...result.candidates].sort(), ['food.restaurant', 'graphic.print_shop', 'store.local_store'])
  assert.equal(bps(result, 'graphic.print_shop'), 5000)
  // Same answers with the catalog reversed: still no winner.
  assert.equal(ss.recommendSmartSetup(answers, { catalog: [...industryPackCatalog].reverse(), hash }).primaryPack, null)
  // rankScores is display-only and fully determined by (rawScore, canonical pack order).
  const ranked = ss.rankScores([...result.packScores].reverse()).map((entry) => entry.pack)
  assert.deepEqual(ranked, ss.rankScores(result.packScores).map((entry) => entry.pack))
})

test('BusinessType authority is never overridden by a higher-scoring pack', () => {
  // Declared GRAPHICS with a strongly service-like operation.
  const answers = { 'q.business_type': 'GRAPHICS', 'q.offer_kind': 'SERVICES', 'q.quote_flow': 'FREQUENT', 'q.fulfillment': ['ON_SITE'], 'q.scheduling': 'FREQUENT', 'q.lead_followup': 'FREQUENT' }
  const result = recommend(answers)
  assert.equal(bps(result, 'services.general'), 8000)
  assert.equal(bps(result, 'graphic.print_shop'), 4000)
  assert.equal(result.primaryPack, 'graphic.print_shop')
  assert.equal(result.outcome, 'BUSINESS_TYPE_ONLY')
  for (const signal of result.alternativeSignals) {
    assert.notEqual(signal.pack, result.primaryPack)
    assert.equal(signal.label, 'ALTERNATIVE_SIGNAL')
    assert.equal(signal.conflictsWithDeclaredBusinessType, true)
  }
  assert.deepEqual(result.alternativeSignals.map((signal) => [signal.pack, signal.reason]), [['services.general', 'CONFIDENCE_EXCEEDS_DECLARED']])
  assert.equal(result.rationale.nextChoice, 'REVIEW_REFERENCE_PACK')
  // For every supported declared type, primary is always the mapped pack.
  for (const [answer, pack] of [['GRAPHICS', 'graphic.print_shop'], ['FOOD', 'food.restaurant'], ['SERVICES', 'services.general'], ['STORE', 'store.local_store']]) {
    for (const persona of Object.values(PERSONAS)) {
      const operational = { ...persona.answers, 'q.business_type': answer }
      delete operational['q.subsegment']
      assert.equal(recommend(operational).primaryPack, pack)
    }
  }
})

test('cross-segment alternative is never an automatic primary and blocks CLEAR_MATCH', () => {
  const scores = [
    { pack: 'graphic.print_shop', rawSupport: 75, rawPenalty: 0, rawScore: 75, maxAvailableSupport: 100, confidence: ss.ratio(75, 100) },
    { pack: 'services.general', rawSupport: 95, rawPenalty: 0, rawScore: 95, maxAvailableSupport: 100, confidence: ss.ratio(95, 100) },
  ]
  const completeness = { answeredScored: 5, presentedScored: 5, ratio: ss.ratio(5, 5), meetsMinimum: true }
  const decision = ss.resolveOutcome({ declaredPack: 'graphic.print_shop', declaredPackAvailable: true, scores, completeness, hardContradictions: [] })
  assert.equal(decision.primaryPack, 'graphic.print_shop')
  assert.equal(decision.outcome, 'BUSINESS_TYPE_ONLY')
  assert.deepEqual(decision.alternatives.map((alt) => alt.pack), ['services.general'])
  // Below the alternative rule: no alternative, declared stays CLEAR.
  scores[1] = { ...scores[1], rawScore: 89, rawSupport: 89, confidence: ss.ratio(89, 100) }
  const calm = ss.resolveOutcome({ declaredPack: 'graphic.print_shop', declaredPackAvailable: true, scores, completeness, hardContradictions: [] })
  assert.equal(calm.outcome, 'CLEAR_MATCH')
  assert.deepEqual(calm.alternatives, [])
  assert.deepEqual(ss.crossSegmentAlternatives('food.restaurant', scores), [])
})

test('hard answer contradiction blocks CLEAR_MATCH: BUSINESS_TYPE_ONLY when declared, NO_CLEAR_MATCH otherwise', () => {
  const contradictory = { ...PERSONAS.F1.answers, 'q.fulfillment': ['DELIVERY', 'PICKUP', 'NONE_OR_NOT_APPLICABLE'] }
  const declared = recommend(contradictory)
  assert.equal(declared.outcome, 'BUSINESS_TYPE_ONLY')
  assert.equal(declared.primaryPack, 'food.restaurant')
  assert.deepEqual(declared.hardContradictions, [{ kind: 'HARD_ANSWER_CONTRADICTION', rule: 'hard.fulfillment_none_with_modes', questionIds: ['q.fulfillment'], options: ['NONE_OR_NOT_APPLICABLE', 'DELIVERY', 'PICKUP'] }])
  assert.ok(declared.rationaleCodes.includes('ANSWER_CONTRADICTION'))
  const undeclared = recommend({ ...PERSONAS.R2.answers, 'q.business_type': 'NOT_SURE', 'q.fulfillment': ['DELIVERY', 'NONE_OR_NOT_APPLICABLE'] })
  assert.equal(undeclared.outcome, 'NO_CLEAR_MATCH')
  assert.equal(undeclared.primaryPack, null)
  assert.equal(undeclared.rationale.primaryReason, 'ANSWER_CONTRADICTION')
})

test('no declared type: a clear winner is CLEAR_MATCH with rationale from its strongest evidence', () => {
  const answers = { ...PERSONAS.R2.answers, 'q.business_type': 'NOT_SURE' }
  delete answers['q.subsegment']
  const result = recommend(answers)
  assert.equal(result.outcome, 'CLEAR_MATCH')
  assert.equal(result.primaryPack, 'store.local_store')
  assert.equal(result.declaredBusinessType, null)
  assert.ok(!result.rationaleCodes.includes('DECLARED_BUSINESS_TYPE'))
  assert.equal(result.rationale.primaryReason, 'OFFER_PRODUCTS')
  assert.equal(result.rationale.nextChoice, 'CONFIRM_OR_CHANGE_PRIMARY')
})

test('declared pack unavailable (catalog or caller context) → BUSINESS_TYPE_ONLY, never switches segment', () => {
  const withoutFood = industryPackCatalog.filter((pack) => pack.key !== 'food.restaurant')
  const missing = ss.recommendSmartSetup(PERSONAS.F1.answers, { catalog: withoutFood, hash })
  assert.equal(missing.outcome, 'BUSINESS_TYPE_ONLY')
  assert.equal(missing.primaryPack, 'food.restaurant')
  assert.ok(missing.rationaleCodes.includes('DECLARED_PACK_UNAVAILABLE'))
  assert.deepEqual(missing.blockedOrUnavailable, [{ kind: 'pack', key: 'food.restaurant', reason: 'PACK_NOT_IN_CATALOG' }])
  const context = recommend(PERSONAS.F1.answers, { context: { unavailablePacks: ['food.restaurant'], blockedCapabilities: ['cap.delivery'] } })
  assert.equal(context.outcome, 'BUSINESS_TYPE_ONLY')
  assert.deepEqual(context.blockedOrUnavailable, [
    { kind: 'pack', key: 'food.restaurant', reason: 'UNAVAILABLE_IN_CALLER_CONTEXT' },
    { kind: 'capability', key: 'cap.delivery', reason: 'BLOCKED_IN_CALLER_CONTEXT' },
  ])
  assert.ok(!context.recommendedCapabilities.some((entry) => entry.capability === 'cap.delivery'))
  // Undeclared: an unavailable pack is simply not a candidate.
  const a2 = recommend(PERSONAS.A2.answers, { context: { unavailablePacks: ['store.local_store'] } })
  assert.ok(!a2.packScores.some((entry) => entry.pack === 'store.local_store'))
  // Food alone at 0.60 (< T_CLEAR) is a single moderate candidate: never forced into a primary.
  assert.equal(bps(a2, 'food.restaurant'), 6000)
  assert.equal(a2.outcome, 'NO_CLEAR_MATCH')
  assert.equal(a2.primaryPack, null)
})

// ---- Capabilities -----------------------------------------------------------------------------------------
test('capabilities: only the 15 certified keys, deterministic order, sources explained', () => {
  const allowed = new Set(CAPABILITY_KEYS)
  assert.equal(allowed.size, 15)
  for (const rule of ss.CAPABILITY_RULES) assert.ok(allowed.has(rule.capability), rule.capability)
  const g1 = recommend(PERSONAS.G1.answers)
  const keys = g1.recommendedCapabilities.map((entry) => entry.capability)
  assert.deepEqual(keys, [...keys].sort((a, b) => CAPABILITY_KEYS.indexOf(a) - CAPABILITY_KEYS.indexOf(b)))
  for (const capability of ['cap.quotes', 'cap.custom_production', 'cap.art_approval', 'cap.delivery', 'cap.pickup', 'cap.stock']) assert.ok(keys.includes(capability), capability)
  for (const entry of g1.recommendedCapabilities) assert.ok(allowed.has(entry.capability) && entry.sources.length > 0)
  const r2 = recommend(PERSONAS.R2.answers).recommendedCapabilities.map((entry) => entry.capability)
  for (const capability of ['cap.marketplace_channel', 'cap.catalog_sales', 'cap.stock', 'cap.deposit']) assert.ok(r2.includes(capability), capability)
  // Food pack capabilities (menu_daily_orders) arrive from the primary pack, not from any answer.
  const f1 = recommend(PERSONAS.F1.answers).recommendedCapabilities.find((entry) => entry.capability === 'cap.menu_daily_orders')
  assert.deepEqual(f1.sources, [{ questionId: 'PRIMARY_PACK', option: null }])
  const prep = recommend({ 'q.business_type': 'NOT_SURE', 'q.production': 'SIMPLE_PREPARATION' }).recommendedCapabilities.find((entry) => entry.capability === 'cap.production_tracking')
  assert.equal(prep.strength, 'WEAK')
  // AMBIGUOUS / NO_CLEAR_MATCH: capabilities from answers only (no pack is assumed).
  assert.ok(!recommend(PERSONAS.A1.answers).recommendedCapabilities.some((entry) => entry.sources.some((source) => source.questionId === 'PRIMARY_PACK')))
})

// ---- Rationale -----------------------------------------------------------------------------------------------
test('rationale: structured codes in canonical order, per outcome next choice', () => {
  const expectations = { CLEAR_MATCH: 'CONFIRM_OR_CHANGE_PRIMARY', BUSINESS_TYPE_ONLY: 'REVIEW_REFERENCE_PACK', AMBIGUOUS: 'CHOOSE_BETWEEN_CANDIDATES', NO_CLEAR_MATCH: 'CHOOSE_SEGMENT_OR_CONTINUE_WITHOUT_PACK' }
  const order = new Map(ss.RATIONALE_CODE_ORDER.map((code, index) => [code, index]))
  for (const persona of Object.values(PERSONAS)) {
    const result = recommend(persona.answers)
    assert.equal(result.rationale.nextChoice, expectations[result.outcome])
    const codes = result.rationaleCodes
    assert.deepEqual(codes, [...new Set(codes)].sort((a, b) => order.get(a) - order.get(b)))
    for (const code of codes) assert.ok(order.has(code), code)
  }
  assert.equal(recommend(PERSONAS.C1.answers).rationale.counterSignals.join(','), 'CROSS_SEGMENT_SIGNAL,COUNTER_SIGNAL_EXPLICIT')
  const a1 = recommend(PERSONAS.A1.answers)
  assert.deepEqual(a1.rationale.uncertainty, ['CLOSE_CANDIDATES'])
  // Caps limit the score, not the explanation: capped evidence is still listed, with its counted points visible.
  assert.ok(a1.rationale.supportingSignals.includes('APPOINTMENT_LED_SERVICE'))
  assert.equal(a1.supportingSignals.find((signal) => signal.pack === 'services.general' && signal.questionId === 'q.scheduling').points, 0)
})

// ---- Proposal (data only, never applied) -------------------------------------------------------------------
function company(overrides = {}) {
  return {
    schemaVersion: 1,
    companyId: '00000000-0000-4000-8000-000000000002',
    businessType: 'food',
    plan: 'essencial',
    entitledFeatures: [],
    enabledModules: [],
    statuses: {},
    categories: [],
    settings: {},
    templates: [],
    dashboardCards: [],
    enabledReports: [],
    activeRecipes: [],
    integrations: [],
    rolePermissionProfiles: {},
    onboardingSteps: [],
    appliedPack: null,
    userOverrides: [],
    platform: { availableIntegrations: [], availableRecipes: [] },
    ...overrides,
  }
}

test('proposal: composes T1 diff/proposal as data only; never applies', () => {
  const registry = buildWave1PackRegistry()
  const recommendation = recommend(PERSONAS.F1.answers)
  const proposal = ss.buildSetupProposal(recommendation, { catalog: industryPackCatalog, hash, company: company(), registry })
  assert.equal(proposal.status, 'PROPOSAL_READY')
  assert.equal(proposal.source, 'RECOMMENDED_PRIMARY')
  assert.equal(proposal.packRef, 'food.restaurant@1.0.0')
  assert.equal(proposal.notApplied, true)
  assert.equal(proposal.applyStatus, 'NOT_AUTHORIZED')
  assert.equal(proposal.requiresUserConfirmation, true)
  assert.equal(proposal.packProposal.notApplied, true)
  assert.equal(proposal.packProposal.applyStatus, 'MIGRATION_REQUIRED_BLOCKED_BY_M0')
  assert.equal(stableStringify(ss.buildSetupProposal(recommendation, { catalog: industryPackCatalog, hash, company: company(), registry })), stableStringify(proposal))
  const reference = ss.buildSetupProposal(recommendation, { catalog: industryPackCatalog, hash })
  assert.equal(reference.status, 'REFERENCE_ONLY_NO_COMPANY_SNAPSHOT')
  assert.equal(reference.packProposal, null)
})

test('proposal: AMBIGUOUS / NO_CLEAR_MATCH require an explicit user choice; manual choice always possible', () => {
  const ambiguous = recommend(PERSONAS.A2.answers)
  const pending = ss.buildSetupProposal(ambiguous, { catalog: industryPackCatalog, hash })
  assert.equal(pending.status, 'USER_CHOICE_REQUIRED')
  assert.equal(pending.packRef, null)
  assert.deepEqual([...pending.candidates].sort(), ['food.restaurant', 'store.local_store'])
  const chosen = ss.buildSetupProposal(ambiguous, { catalog: industryPackCatalog, hash, userSelection: 'store.local_store' })
  assert.equal(chosen.source, 'USER_CHOICE')
  assert.equal(chosen.packRef, 'store.local_store@1.0.0')
  // Manual change is possible even against a declared type (explicit user action only).
  const override = ss.buildSetupProposal(recommend(PERSONAS.C1.answers), { catalog: industryPackCatalog, hash, userSelection: 'services.general' })
  assert.equal(override.source, 'USER_CHOICE')
  assert.equal(override.packRef, 'services.general@1.0.0')
  assert.equal(ss.buildSetupProposal(ambiguous, { catalog: industryPackCatalog, hash, userSelection: 'beauty.salon' }).status, 'INVALID_USER_SELECTION')
  const unavailable = ss.buildSetupProposal(recommend(PERSONAS.F1.answers), { catalog: industryPackCatalog.filter((pack) => pack.key !== 'food.restaurant'), hash })
  assert.equal(unavailable.status, 'PACK_UNAVAILABLE')
  assert.equal(unavailable.issues[0].code, 'PACK_NOT_FOUND')
})

// ---- Legacy prefill ------------------------------------------------------------------------------------------
test('legacy prefill: suggestion only, never invents a pack', () => {
  assert.deepEqual(legacyPrefill({ businessType: 'graphic' }), { suggestedBusinessType: 'GRAPHICS', basis: 'BUSINESS_TYPE', requiresUserConfirmation: true })
  assert.deepEqual(legacyPrefill({ nichoId: 'vidracaria' }), { suggestedBusinessType: 'SERVICES', basis: 'LEGACY_NICHO', requiresUserConfirmation: true })
  assert.deepEqual(legacyPrefill({ businessType: 'beauty', nichoId: 'barbearia' }), { suggestedBusinessType: null, basis: 'NONE', requiresUserConfirmation: true })
  assert.deepEqual(legacyPrefill({ businessType: null, nichoId: 'desconhecido' }), { suggestedBusinessType: null, basis: 'NONE', requiresUserConfirmation: true })
  assert.deepEqual(legacyPrefill({}), { suggestedBusinessType: null, basis: 'NONE', requiresUserConfirmation: true })
})

// ---- Manifest ------------------------------------------------------------------------------------------------
test('Wave 1 manifest smartSetup section: safe metadata only', () => {
  const manifest = buildSmartSetupManifest()
  assert.equal(manifest.questionnaireVersion, ss.QUESTIONNAIRE_VERSION)
  assert.equal(manifest.rulesetVersion, ss.RULESET_VERSION)
  assert.deepEqual(manifest.supportedPacks, ['graphic.print_shop', 'food.restaurant', 'services.general', 'store.local_store'])
  assert.deepEqual(manifest.thresholds, { T_CLEAR: 0.7, T_MIN: 0.45, MARGIN: 0.15, MIN_COMPLETENESS: 0.4 })
  assert.deepEqual(manifest.outcomes, ['CLEAR_MATCH', 'AMBIGUOUS', 'NO_CLEAR_MATCH', 'BUSINESS_TYPE_ONLY'])
  assert.equal(manifest.runtimeStatus, 'PURE_RECOMMENDATION_ONLY')
  assert.equal(manifest.applyStatus, 'NOT_AUTHORIZED')
  const serialized = JSON.stringify(manifest)
  assert.ok(!/answers|inputFingerprint|companyId/.test(serialized))
  assert.ok(stableStringify(manifest) !== null)
})

// ---- Purity: no I/O, no clock, no randomness, no provider, no UI/runtime imports ------------------------------
test('pure core: no DB/runtime/provider/clock/randomness/env access in lib/smart-setup', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.ts')) files.push(full)
    }
  }
  walk(path.join(root, 'lib/smart-setup'))
  assert.ok(files.length >= 11)
  const forbidden = [
    /\bfetch\s*\(/, /supabase/i, /process\.env/, /Date\.now|new Date\(/, /Math\.random/, /crypto/, /\brequire\(/,
    /from\s+['"]node:/, /XMLHttpRequest|localStorage|sessionStorage|WebSocket/, /from\s+['"]@\/app|from\s+['"]@\/components|from\s+['"]\.\.\/\.\.\/\.\.\/app/,
    /\b(openai|anthropic|llm|chatgpt)\b|gpt-\d/i, /sha256\.server/, /\bapply(Pack|Configuration)\s*\(/,
  ]
  for (const file of files) {
    const source = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '')
    for (const pattern of forbidden) assert.ok(!pattern.test(source), `${path.relative(root, file)} matches ${pattern}`)
  }
})
