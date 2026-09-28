// Wave 1 T1 — Automation Recipe / Action / Event / Detector contracts (catalog + pure planning only).
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const recipes = await import('../../lib/automation-recipes/index.ts')
const { ACTION_CATALOG } = await import('../../lib/actions/contracts/catalog.ts')
const { DOMAIN_EVENTS, TIMELINE_ONLY_EVENTS } = await import('../../lib/events/contracts/registry.ts')
const { DETECTORS } = await import('../../lib/detectors/contracts/registry.ts')
const { sha256Hex } = await import('../../lib/wave1/shared/sha256.server.ts')
const { getRequiredPlan, planLimits } = await import('../../lib/plan-limits.ts')
const { buildRecipeManifest } = await import('../../lib/wave1/manifest.ts')

const {
  recipeCatalog,
  validateRecipe,
  validateRecipeParams,
  deriveRecipeRisk,
  evaluateRecipeDependencies,
  planRecipeRun,
  renderRunKey,
  diffRecipeVersions,
  defaultRecipeRegistry,
  findAction,
  T1_ALLOWED_RECIPE_STATUSES,
  RECIPE_RUNTIME_STATUS,
} = recipes

const registry = defaultRecipeRegistry()
const clone = (value) => structuredClone(value)
const byKey = (key) => recipeCatalog.find((recipe) => recipe.key === key)
const codes = (result) => (result.ok ? [] : result.errors.map((error) => error.code))
const reasons = (result) => (result.ok ? [] : result.errors.map((error) => error.params?.reason).filter(Boolean))
const mutate = (key, fn, reg = registry) => {
  const recipe = clone(byKey(key))
  fn(recipe)
  return validateRecipe(recipe, reg)
}

const COMPANY_A = '00000000-0000-4000-8000-00000000000a'
const COMPANY_B = '00000000-0000-4000-8000-00000000000b'
const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111'
const EVENT_1 = '22222222-2222-4222-8222-222222222221'
const EVENT_2 = '22222222-2222-4222-8222-222222222222'
const MEMBER = '33333333-3333-4333-8333-333333333333'

const proposalAccepted = (overrides = {}) => ({
  kind: 'domain_event',
  eventId: EVENT_1,
  eventType: 'proposal.accepted',
  eventVersion: 1,
  companyId: COMPANY_A,
  subjectId: PROPOSAL_ID,
  occurredAt: '2026-09-28T12:00:00.000Z',
  ...overrides,
})

const plan = (recipe, trigger, params = {}, subject = {}, extra = {}) =>
  planRecipeRun({ recipe, params, trigger, subject, registry, hash: sha256Hex, ...extra })

// ---- catalog --------------------------------------------------------------------------------------

test('catalog has exactly the five Wave 1 recipes and all validate', () => {
  assert.deepEqual(recipeCatalog.map((recipe) => recipe.key).sort(), [
    'lead_followup_task',
    'order_delayed_internal_task',
    'proposal_accepted_production_task',
    'proposal_followup_task',
    'stock_critical_alert',
  ])
  for (const recipe of recipeCatalog) {
    const result = validateRecipe(recipe, registry)
    assert.equal(result.ok, true, `${recipe.key}: ${JSON.stringify(result.ok ? [] : result.errors)}`)
  }
})

test('no recipe is published; statuses are limited to draft/catalog_only/runtime_candidate', () => {
  assert.deepEqual([...T1_ALLOWED_RECIPE_STATUSES], ['draft', 'catalog_only', 'runtime_candidate'])
  for (const recipe of recipeCatalog) assert.ok(T1_ALLOWED_RECIPE_STATUSES.includes(recipe.status), recipe.key)
  assert.equal(byKey('stock_critical_alert').status, 'catalog_only')
  for (const key of ['proposal_accepted_production_task', 'order_delayed_internal_task', 'lead_followup_task', 'proposal_followup_task']) {
    assert.equal(byKey(key).status, 'runtime_candidate')
  }
  for (const status of ['published', 'deprecated', 'retired']) {
    assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.status = status))).includes('RECIPE_STATUS_NOT_ALLOWED'), status)
  }
  assert.equal(RECIPE_RUNTIME_STATUS, 'NOT_READY_FOR_RUNTIME')
  assert.equal(buildRecipeManifest().runtimeStatus, 'NOT_READY_FOR_RUNTIME')
})

test('no external communication, payment, financial or destructive action anywhere', () => {
  for (const recipe of recipeCatalog) {
    assert.equal(recipe.internalOnly, true, recipe.key)
    for (const requirement of recipe.actions) {
      assert.doesNotMatch(requirement.action, /whatsapp|email|sms|message\.send|payment|refund|payout|stock\.adjust|status/i)
      const action = findAction(registry, requirement.action)
      assert.ok(action, requirement.action)
      assert.deepEqual([...action.sensitivity], [])
      assert.notEqual(action.impact, 'DESTRUCTIVE')
    }
    assert.ok(!recipe.dependencies.some((dependency) => dependency.type === 'communication_consent' || dependency.type === 'integration'))
  }
  for (const action of ACTION_CATALOG) {
    assert.deepEqual([...action.sensitivity], [], action.key)
    assert.equal(action.executor, 'NOT_IMPLEMENTED')
    assert.equal(action.publication, 'METADATA_ONLY')
  }
})

// ---- action contract ---------------------------------------------------------------------------------

test('business.task.create@1 is metadata-only and flags permission + tenant reconciliation', () => {
  const task = findAction(registry, 'business.task.create@1')
  assert.equal(task.requiredPermission, null)
  assert.ok(task.reconciliation.includes('PERMISSION_RECONCILIATION_REQUIRED'))
  assert.ok(task.reconciliation.includes('TENANT_REFERENCE_VALIDATION_REQUIRED'))
  assert.deepEqual(
    Object.entries(task.input).filter(([, field]) => field.type === 'uuid').map(([key, field]) => [key, field.tenantReference]).sort(),
    [['crm_lead_id', 'crm_leads'], ['order_id', 'orders'], ['proposal_id', 'proposals'], ['responsavel_id', 'company_members']],
  )
  for (const action of ACTION_CATALOG) {
    if (action.requiredPermission === null) assert.ok(action.reconciliation.includes('PERMISSION_RECONCILIATION_REQUIRED'), action.key)
  }
})

// ---- event / detector registries ----------------------------------------------------------------------

test('event registry holds only events proven to exist in the outbox trigger', () => {
  assert.deepEqual(DOMAIN_EVENTS.map((event) => event.eventType).sort(), ['order.created', 'order.ready', 'payment.confirmed', 'proposal.accepted'])
  const migration = readFileSync(new URL('../../supabase/migrations/20260907233000_orcaly_3_1_reliability_foundation.sql', import.meta.url), 'utf8')
  const fn = migration.slice(migration.indexOf('function public.orcaly_record_business_event'))
  for (const event of DOMAIN_EVENTS) {
    assert.equal(event.status, 'EXISTING')
    assert.equal(event.consumerRuntime, 'NONE')
    assert.ok(fn.includes(`'${event.eventType}'`), `${event.eventType} present in orcaly_record_business_event`)
  }
  for (const invented of ['stock.low', 'customer.inactive', 'contract.expiring', 'order.delayed', 'quote.expiring', 'invoice.overdue']) {
    assert.equal(DOMAIN_EVENTS.some((event) => event.eventType === invented), false, invented)
  }
  for (const timeline of TIMELINE_ONLY_EVENTS) {
    assert.equal(DOMAIN_EVENTS.some((event) => event.eventType === timeline), false, timeline)
    assert.ok(fn.includes(`'${timeline}'`), `${timeline} exists as timeline event`)
  }
})

test('timeline-only and unknown events cannot trigger recipes', () => {
  const timeline = mutate('proposal_accepted_production_task', (recipe) => (recipe.trigger.eventType = 'proposal.status_changed'))
  assert.ok(codes(timeline).includes('RECIPE_TRIGGER_TIMELINE_ONLY'))
  const invented = mutate('proposal_accepted_production_task', (recipe) => (recipe.trigger.eventType = 'contract.expiring'))
  assert.ok(codes(invented).includes('RECIPE_TRIGGER_UNKNOWN'))
  const version = mutate('proposal_accepted_production_task', (recipe) => (recipe.trigger.acceptedVersions = [2]))
  assert.ok(codes(version).includes('RECIPE_TRIGGER_UNKNOWN'))
  const subject = mutate('proposal_accepted_production_task', (recipe) => (recipe.trigger.subject = 'order'))
  assert.ok(codes(subject).includes('RECIPE_TRIGGER_SUBJECT_MISMATCH'))
})

test('detector registry distinguishes EXISTING (in source) from PLANNED', () => {
  const source = readFileSync(new URL('../../lib/orcaly-smart-notifications.ts', import.meta.url), 'utf8')
  const declared = new Set([...source.matchAll(/event_type: '([a-z_]+)'/g)].map((match) => match[1]))
  for (const detector of DETECTORS) {
    assert.equal(detector.scheduled, false)
    if (detector.status === 'EXISTING') assert.ok(declared.has(detector.key), `${detector.key} exists in smart notifications`)
    else assert.equal(declared.has(detector.key), false, `${detector.key} must not exist yet`)
  }
  assert.deepEqual(DETECTORS.filter((detector) => detector.status === 'PLANNED').map((detector) => detector.key), ['stock_critical'])
  assert.deepEqual([...declared].sort(), DETECTORS.filter((detector) => detector.status === 'EXISTING').map((detector) => detector.key).sort())
})

test('a PLANNED detector can never sustain a runtime_candidate', () => {
  const promoted = mutate('stock_critical_alert', (recipe) => (recipe.status = 'runtime_candidate'))
  assert.ok(codes(promoted).includes('RECIPE_TRIGGER_PLANNED'))
  for (const recipe of recipeCatalog.filter((entry) => entry.status === 'runtime_candidate')) {
    if (recipe.trigger.type === 'detector') {
      const detector = DETECTORS.find((entry) => entry.key === recipe.trigger.detectorKey)
      assert.equal(detector.status, 'EXISTING', recipe.key)
    }
  }
  const evaluation = evaluateRecipeDependencies(byKey('stock_critical_alert'), { entitledFeatures: ['automacoes'], enabledModules: [], connectedIntegrations: [], dataQuality: { products_have_stock: true } }, registry)
  assert.equal(evaluation.find((entry) => entry.dependency.type === 'trigger_available').reason, 'DETECTOR_PLANNED')
})

// ---- risk -------------------------------------------------------------------------------------------------

function registryWithAction(overrides) {
  const extra = {
    ...clone(ACTION_CATALOG[0]),
    key: 'customer.message.send',
    majorVersion: 1,
    input: { titulo: { type: 'string', required: true, maxLength: 160 } },
    ...overrides,
  }
  return { ...registry, actions: [...registry.actions, extra] }
}

function withAction(recipe, ref) {
  recipe.actions = [{ action: ref, input: { titulo: { literal: 'x' } }, onFailure: 'stop' }]
  recipe.dependencies = recipe.dependencies.filter((dependency) => dependency.type !== 'action_available').concat({ type: 'action_available', action: ref })
}

test('risk blocks external communication, financial, regulated, destructive and irreversible actions', () => {
  const cases = [
    [{ sensitivity: ['EXTERNAL_COMMUNICATION'] }, 'SENSITIVITY:EXTERNAL_COMMUNICATION'],
    [{ sensitivity: ['FINANCIAL'] }, 'SENSITIVITY:FINANCIAL'],
    [{ sensitivity: ['REGULATED'] }, 'SENSITIVITY:REGULATED'],
    [{ sensitivity: ['CROSS_PRODUCT'] }, 'SENSITIVITY:CROSS_PRODUCT'],
    [{ sensitivity: ['BULK'] }, 'SENSITIVITY:BULK'],
    [{ impact: 'DESTRUCTIVE' }, 'IMPACT:DESTRUCTIVE'],
    [{ reversibility: 'irreversible' }, 'IRREVERSIBLE:customer.message.send@1'],
    [{ allowedActors: ['member'] }, 'ACTOR_NOT_ALLOWED:customer.message.send@1'],
  ]
  for (const [overrides, reason] of cases) {
    const reg = registryWithAction(overrides)
    const risk = deriveRecipeRisk({ actions: [{ action: 'customer.message.send@1' }] }, (ref) => findAction(reg, ref))
    assert.equal(risk.effectiveClass, 'BLOCKED', reason)
    assert.ok(risk.reasons.includes(reason), `${reason} in ${risk.reasons}`)
    const result = mutate('lead_followup_task', (recipe) => withAction(recipe, 'customer.message.send@1'), reg)
    assert.ok(codes(result).includes('RECIPE_RISK_BLOCKED'), reason)
  }
  const external = mutate('lead_followup_task', (recipe) => withAction(recipe, 'customer.message.send@1'), registryWithAction({ sensitivity: ['EXTERNAL_COMMUNICATION'] }))
  assert.ok(codes(external).includes('RECIPE_EXTERNAL_FORBIDDEN'))
  const unknown = deriveRecipeRisk({ actions: [{ action: 'nope.nope.nope@1' }] }, () => null)
  assert.equal(unknown.effectiveClass, 'BLOCKED')
})

test('declared risk must equal derived risk; WRITE_BUSINESS requires human confirmation per run', () => {
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.risk.effectiveClass = 'MEDIUM'))).includes('RECIPE_RISK_MISMATCH'))
  const reg = registryWithAction({ impact: 'WRITE_BUSINESS' })
  const high = mutate('lead_followup_task', (recipe) => {
    withAction(recipe, 'customer.message.send@1')
    recipe.risk = { ...recipe.risk, maxImpact: 'WRITE_BUSINESS', effectiveClass: 'HIGH' }
  }, reg)
  assert.ok(codes(high).includes('RECIPE_CONFIRMATION_INVALID'))
  const confirmed = mutate('lead_followup_task', (recipe) => {
    withAction(recipe, 'customer.message.send@1')
    recipe.risk = { ...recipe.risk, maxImpact: 'WRITE_BUSINESS', effectiveClass: 'HIGH' }
    recipe.confirmation.perRun = 'human_each_run'
  }, reg)
  assert.equal(confirmed.ok, true, JSON.stringify(confirmed.ok ? [] : confirmed.errors))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.internalOnly = false))).includes('RECIPE_EXTERNAL_FORBIDDEN'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.confirmation.activationRequires = 'orders.read'))).includes('RECIPE_CONFIRMATION_INVALID'))
})

// ---- entitlement ---------------------------------------------------------------------------------------

test('entitlement: every recipe requires automacoes, which remains premium-only (unchanged)', () => {
  assert.equal(getRequiredPlan('automacoes'), 'premium')
  assert.equal(planLimits.basic.features.includes('automacoes'), false)
  assert.equal(planLimits.intermediate.features.includes('automacoes'), false)
  for (const recipe of recipeCatalog) {
    assert.ok(recipe.dependencies.some((dependency) => dependency.type === 'feature' && dependency.feature === 'automacoes'), recipe.key)
  }
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.dependencies = recipe.dependencies.filter((dependency) => dependency.feature !== 'automacoes')))).includes('RECIPE_ENTITLEMENT_MISSING'))
  const basic = plan(byKey('proposal_accepted_production_task'), proposalAccepted(), {}, {}, {
    dependencyContext: { entitledFeatures: [...planLimits.basic.features], enabledModules: ['tarefas'], connectedIntegrations: [], dataQuality: {} },
  })
  assert.equal(basic.outcome, 'BLOCKED_BY_DEPENDENCY')
})

// ---- dedupe / run key / idempotency ------------------------------------------------------------------

test('proposal_accepted_production_task dedupes by event: re-approval is a new fact', () => {
  const recipe = byKey('proposal_accepted_production_task')
  assert.ok(recipe.dedupe.runKeyTemplate.includes('{{trigger.eventId}}'))
  const first = plan(recipe, proposalAccepted())
  const again = plan(recipe, proposalAccepted())
  const reapproval = plan(recipe, proposalAccepted({ eventId: EVENT_2 }))
  assert.equal(first.outcome, 'WOULD_RUN')
  assert.equal(first.runKey, `${PROPOSAL_ID}:${EVENT_1}`)
  assert.deepEqual(again, first)
  assert.notEqual(reapproval.runKey, first.runKey)
  assert.notEqual(reapproval.actions[0].idempotencyKey, first.actions[0].idempotencyKey)
  const withoutEvent = mutate('proposal_accepted_production_task', (entry) => (entry.dedupe.runKeyTemplate = '{{trigger.subjectId}}'))
  assert.ok(reasons(withoutEvent).includes('event_identity_required'))
})

test('idempotency planning is stable and scoped by company and recipe', () => {
  const recipe = byKey('proposal_accepted_production_task')
  const a = plan(recipe, proposalAccepted())
  const b = plan(recipe, proposalAccepted({ companyId: COMPANY_B }))
  assert.equal(a.runKey, b.runKey)
  assert.notEqual(a.actions[0].idempotencyKey, b.actions[0].idempotencyKey)
  assert.match(a.actions[0].idempotencyKey, /^[0-9a-f]{64}$/)
  const other = { ...clone(recipe), key: 'proposal_accepted_production_task_copy', changelog: recipe.changelog }
  const c = plan(other, proposalAccepted())
  if (c.outcome === 'WOULD_RUN') assert.notEqual(c.actions[0].idempotencyKey, a.actions[0].idempotencyKey)
  for (let index = 0; index < 20; index += 1) assert.deepEqual(plan(recipe, proposalAccepted()), a)
})

test('detector run keys include subject and window', () => {
  const recipe = byKey('order_delayed_internal_task')
  const trigger = { kind: 'detector', detectorKey: 'order_stuck', detectorVersion: 1, companyId: COMPANY_A, subjectId: 'order-1', windowKey: 'em_producao', occurredAt: '2026-09-28T00:00:00.000Z' }
  assert.equal(renderRunKey(recipe.dedupe.runKeyTemplate, trigger), 'order-1:em_producao')
  const noWindow = mutate('order_delayed_internal_task', (entry) => (entry.dedupe.runKeyTemplate = '{{trigger.subjectId}}'))
  assert.ok(reasons(noWindow).includes('window_required'))
  const eventId = mutate('order_delayed_internal_task', (entry) => (entry.dedupe.runKeyTemplate = '{{trigger.subjectId}}:{{trigger.windowKey}}:{{trigger.eventId}}'))
  assert.ok(reasons(eventId).includes('detector_has_no_event_id'))
  const junk = mutate('order_delayed_internal_task', (entry) => (entry.dedupe.runKeyTemplate = '{{trigger.subjectId}}{{company.secret}}'))
  assert.ok(reasons(junk).includes('tokens'))
})

// ---- pure planning ------------------------------------------------------------------------------------

test('planRecipeRun resolves inputs without executing anything', () => {
  const run = plan(byKey('proposal_accepted_production_task'), proposalAccepted(), { assignee: MEMBER, priority: 'media' })
  assert.equal(run.outcome, 'WOULD_RUN')
  assert.equal(run.runtimeAuthorized, false)
  assert.deepEqual(run.actions[0].input, {
    due_in_days: 1,
    prioridade: 'media',
    proposal_id: PROPOSAL_ID,
    responsavel_id: MEMBER,
    titulo: 'Iniciar produção da proposta aprovada',
  })
})

test('planRecipeRun outcomes: mismatch, invalid params, conditions, dependencies, invalid recipe', () => {
  const accepted = byKey('proposal_accepted_production_task')
  assert.equal(plan(accepted, proposalAccepted({ eventType: 'order.created' })).outcome, 'TRIGGER_MISMATCH')
  assert.equal(plan(accepted, proposalAccepted({ eventVersion: 2 })).outcome, 'TRIGGER_MISMATCH')
  assert.equal(plan(accepted, proposalAccepted(), { priority: 'urgentissima' }).outcome, 'INVALID_PARAMS')
  assert.equal(plan(accepted, proposalAccepted(), { assignee: 'not-a-uuid' }).outcome, 'INVALID_PARAMS')
  assert.equal(plan(accepted, proposalAccepted(), { unknown: 1 }).outcome, 'INVALID_PARAMS')

  const followup = byKey('proposal_followup_task')
  const idle = { kind: 'detector', detectorKey: 'proposal_idle', detectorVersion: 1, companyId: COMPANY_A, subjectId: PROPOSAL_ID, windowKey: 'enviado', occurredAt: '2026-09-28T00:00:00.000Z' }
  assert.equal(plan(followup, idle, {}, { 'proposal.status': 'enviado' }).outcome, 'WOULD_RUN')
  assert.equal(plan(followup, idle, {}, { 'proposal.status': 'aprovado' }).outcome, 'CONDITIONS_NOT_MET')
  assert.equal(plan(followup, idle, {}, {}).outcome, 'CONDITIONS_NOT_MET')

  const stock = byKey('stock_critical_alert')
  const stockTrigger = { kind: 'detector', detectorKey: 'stock_critical', detectorVersion: 1, companyId: COMPANY_A, subjectId: 'product-1', windowKey: '2026-09-28', occurredAt: '2026-09-28T00:00:00.000Z' }
  const blocked = plan(stock, stockTrigger, {}, { 'product.estoque': 1 }, {
    dependencyContext: { entitledFeatures: ['automacoes'], enabledModules: [], connectedIntegrations: [], dataQuality: { products_have_stock: true } },
  })
  assert.equal(blocked.outcome, 'BLOCKED_BY_DEPENDENCY')
  assert.ok(blocked.explanation.some((entry) => entry.code === 'DETECTOR_PLANNED'))
  assert.equal(plan(stock, stockTrigger, {}, { 'product.estoque': 10 }).outcome, 'CONDITIONS_NOT_MET')
  assert.equal(plan(stock, stockTrigger, {}, { 'product.estoque': null }).outcome, 'CONDITIONS_NOT_MET')

  const broken = { ...clone(accepted), status: 'published' }
  const invalid = plan(broken, proposalAccepted())
  assert.equal(invalid.outcome, 'INVALID_RECIPE')
  assert.equal(invalid.actions.length, 0)
  for (const run of [blocked, invalid]) assert.equal(run.runtimeAuthorized, false)
})

test('order_delayed respects ignored statuses', () => {
  const recipe = byKey('order_delayed_internal_task')
  const trigger = { kind: 'detector', detectorKey: 'order_stuck', detectorVersion: 1, companyId: COMPANY_A, subjectId: '44444444-4444-4444-8444-444444444444', windowKey: 'em_producao', occurredAt: '2026-09-28T00:00:00.000Z' }
  assert.equal(plan(recipe, trigger, {}, { 'order.status': 'Em produção' }).outcome, 'WOULD_RUN')
  assert.equal(plan(recipe, trigger, { ignored_statuses: ['em produção'] }, { 'order.status': 'Em produção' }).outcome, 'CONDITIONS_NOT_MET')
})

// ---- validation details ---------------------------------------------------------------------------------

test('action input mapping (R7) rejects unknown fields, missing required, wrong subject and unsafe text', () => {
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.hack = { literal: 'x' }))).includes('unknown_field'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => delete recipe.actions[0].input.titulo)).includes('required_missing'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => {
    delete recipe.actions[0].input.crm_lead_id
    recipe.actions[0].input.order_id = { trigger: 'subjectId' }
  })).includes('subject_reference_mismatch'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.order_id = { literal: '44444444-4444-4444-8444-444444444444' }))).includes('literal_uuid_not_allowed'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.titulo = { param: 'priority' }))).includes('string_from_param_not_allowed'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.titulo = { literal: '<b>oi</b>' }))).includes('RECIPE_TEMPLATE_UNSAFE'))
  assert.ok(codes(mutate('stock_critical_alert', (recipe) => (recipe.actions[0].input.link_path = { literal: 'https://evil.example' }))).includes('RECIPE_TEMPLATE_UNSAFE'))
  assert.ok(reasons(mutate('stock_critical_alert', (recipe) => (recipe.actions[0].input.link_path = { literal: '/admin/usuarios' }))).includes('literal_pattern'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.prioridade = { literal: 'critica' }))).includes('literal_enum'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.actions[0].action = 'business.task.delete@1'))).includes('RECIPE_ACTION_UNKNOWN'))
})

test('conditions (R6), parameters (R16), dependencies (R14) and limits (R10)', () => {
  assert.ok(codes(mutate('order_delayed_internal_task', (recipe) => (recipe.conditions.of[0].field = 'order.valor_total'))).includes('RECIPE_CONDITION_INVALID'))
  assert.ok(codes(mutate('order_delayed_internal_task', (recipe) => (recipe.conditions.of[0].value = { param: 'ghost' }))).includes('RECIPE_CONDITION_INVALID'))
  assert.ok(codes(mutate('order_delayed_internal_task', (recipe) => (recipe.conditions = { op: 'all', of: [{ op: 'any', of: [{ op: 'all', of: [{ op: 'any', of: [] }] }] }] }))).includes('RECIPE_CONDITION_INVALID'))
  assert.ok(codes(mutate('order_delayed_internal_task', (recipe) => (recipe.conditions = { op: 'eval', code: 'process.exit()' }))).includes('RECIPE_CONDITION_INVALID'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => recipe.parameters.push(clone(recipe.parameters[0])))).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.parameters[1].max = 365))).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.dependencies = recipe.dependencies.filter((dependency) => dependency.type !== 'trigger_available')))).includes('RECIPE_DEPENDENCY_INVALID'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => recipe.dependencies.push({ type: 'communication_consent', channel: 'whatsapp', purpose: 'marketing' }))).includes('RECIPE_EXTERNAL_FORBIDDEN'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.limits.maxRunsPerHourPerCompany = 1000))).includes('RECIPE_LIMITS_INVALID'))
  assert.ok(codes(mutate('lead_followup_task', (recipe) => (recipe.businessTypes = ['retail']))).includes('RECIPE_FIELD_INVALID'))
})

test('validateRecipe and validateRecipeParams never throw on invalid input', () => {
  for (const junk of [null, undefined, 0, 'x', [], {}, { trigger: null, actions: 'x' }, { actions: [null, 1], parameters: [null], conditions: null }]) {
    assert.equal(validateRecipe(junk, registry).ok, false)
  }
  assert.equal(validateRecipeParams(byKey('lead_followup_task'), 'x').ok, false)
  assert.equal(validateRecipeParams(byKey('lead_followup_task'), [1]).ok, false)
  const defaults = validateRecipeParams(byKey('lead_followup_task'), undefined)
  assert.deepEqual(defaults, { ok: true, value: { assignee: null, due_in_days: 1, priority: 'media' }, warnings: [] })
})

test('dependency evaluation reports actions as metadata-only (never satisfied)', () => {
  const evaluation = evaluateRecipeDependencies(byKey('lead_followup_task'), { entitledFeatures: ['automacoes', 'crm'], enabledModules: ['tarefas'], connectedIntegrations: [], dataQuality: {} }, registry)
  const action = evaluation.find((entry) => entry.dependency.type === 'action_available')
  assert.equal(action.status, 'DEGRADED')
  assert.equal(action.reason, 'ACTION_METADATA_ONLY_NO_EXECUTOR')
  assert.equal(evaluation.find((entry) => entry.dependency.type === 'trigger_available').status, 'SATISFIED')
})

test('diffRecipeVersions', () => {
  const base = byKey('lead_followup_task')
  const patch = { ...clone(base), version: '1.0.1' }
  patch.parameters.push({ key: 'note_flag', type: 'boolean', label: 'x', default: false })
  const minor = diffRecipeVersions(base, patch)
  assert.deepEqual(minor.params.added, ['note_flag'])
  assert.equal(minor.autoMigratable, true)
  const major = diffRecipeVersions(base, { ...clone(base), version: '2.0.0' })
  assert.equal(major.autoMigratable, false)
  const risky = diffRecipeVersions(base, { ...clone(base), version: '1.1.0', risk: { ...base.risk, effectiveClass: 'HIGH' } })
  assert.equal(risky.riskIncreased, true)
  assert.equal(risky.autoMigratable, false)
})

test('recipe manifest is deterministic and reflects the catalog', () => {
  const first = buildRecipeManifest()
  assert.deepEqual(buildRecipeManifest(), first)
  assert.equal(first.recipes.length, 5)
  assert.ok(first.recipes.every((recipe) => recipe.valid && recipe.risk === 'LOW' && recipe.internalOnly))
  assert.equal(first.recipes.filter((recipe) => recipe.status === 'published').length, 0)
})

// ---- branch coverage: conditions, dependencies, registries ------------------------------------------

test('evaluateConditions supports every operator deterministically', async () => {
  const { evaluateConditions, validateConditions } = recipes
  const subject = { 'order.status': ' Pronto ', 'product.estoque': 5, 'order.prazo_entrega': null }
  const leaf = (op, field, value) => ({ op, field, ...(value === undefined ? {} : { value }) })
  assert.equal(evaluateConditions(leaf('eq', 'order.status', { literal: 'pronto' }), subject, {}), true)
  assert.equal(evaluateConditions(leaf('neq', 'order.status', { literal: 'pronto' }), subject, {}), false)
  assert.equal(evaluateConditions(leaf('in', 'order.status', { literal: ['x', 'PRONTO'] }), subject, {}), true)
  assert.equal(evaluateConditions(leaf('not_in', 'order.status', { literal: ['pronto'] }), subject, {}), false)
  assert.equal(evaluateConditions(leaf('gte', 'product.estoque', { literal: 5 }), subject, {}), true)
  assert.equal(evaluateConditions(leaf('lte', 'product.estoque', { param: 'max' }), subject, { max: 4 }), false)
  assert.equal(evaluateConditions(leaf('gte', 'order.status', { literal: 1 }), subject, {}), false)
  assert.equal(evaluateConditions(leaf('is_null', 'order.prazo_entrega'), subject, {}), true)
  assert.equal(evaluateConditions(leaf('not_null', 'order.prazo_entrega'), subject, {}), false)
  assert.equal(evaluateConditions(leaf('eq', 'order.canal_origem', { literal: null }), subject, {}), false)
  assert.equal(evaluateConditions({ op: 'any', of: [leaf('is_null', 'order.status'), leaf('gte', 'product.estoque', { literal: 1 })] }, subject, {}), true)
  assert.equal(evaluateConditions({ op: 'any', of: [] }, subject, {}), false)
  assert.equal(evaluateConditions({ op: 'all', of: [] }, subject, {}), true)

  const reasonsOf = (spec) => validateConditions(spec, 'order', ['max']).map((entry) => entry.params.reason)
  assert.deepEqual(reasonsOf(null), ['shape'])
  assert.deepEqual(reasonsOf({ op: 'all' }), ['of'])
  assert.deepEqual(reasonsOf(leaf('is_null', 'order.status', { literal: 1 })), ['unexpected_value'])
  assert.deepEqual(reasonsOf(leaf('eq', 'order.status')), ['missing_value'])
  assert.deepEqual(reasonsOf(leaf('eq', 'order.status', { raw: 1 })), ['value_shape'])
  assert.deepEqual(reasonsOf(leaf('in', 'order.status', { literal: 'x' })), ['list_operator_mismatch'])
  assert.deepEqual(reasonsOf({ op: 'all', of: Array.from({ length: 11 }, () => leaf('not_null', 'order.status')) }), ['too_many_leaves'])
  assert.deepEqual(reasonsOf(leaf('eq', 'product.estoque', { literal: 1 })), ['field'])
})

test('evaluateRecipeDependencies covers every dependency type', () => {
  const recipe = {
    dependencies: [
      { type: 'trigger_available', ref: 'event:proposal.accepted' },
      { type: 'trigger_available', ref: 'event:stock.low' },
      { type: 'trigger_available', ref: 'detector:ghost@1' },
      { type: 'trigger_available', ref: 'queue:x' },
      { type: 'action_available', action: 'ghost.ghost.ghost@1' },
      { type: 'feature', feature: 'crm' },
      { type: 'module', moduleId: 'tarefas' },
      { type: 'module', moduleId: 'producao' },
      { type: 'integration', provider: 'google_calendar', capability: 'calendar.read' },
      { type: 'integration', provider: 'google_drive', capability: 'files.read' },
      { type: 'data_quality', check: 'orders_have_due_date' },
      { type: 'data_quality', check: 'products_have_stock' },
      { type: 'data_quality', check: 'leads_have_next_contact' },
      { type: 'communication_consent', channel: 'whatsapp', purpose: 'transactional' },
    ],
  }
  const context = {
    entitledFeatures: [],
    enabledModules: ['tarefas'],
    connectedIntegrations: [{ provider: 'google_calendar', capabilities: ['calendar.read'] }],
    dataQuality: { orders_have_due_date: true, products_have_stock: false },
  }
  assert.deepEqual(
    evaluateRecipeDependencies(recipe, context, registry).map((entry) => `${entry.status}:${entry.reason}`),
    [
      'SATISFIED:EVENT_EXISTING_NO_CONSUMER_RUNTIME',
      'MISSING:EVENT_NOT_REGISTERED',
      'MISSING:DETECTOR_NOT_REGISTERED',
      'UNKNOWN:TRIGGER_REF_UNRECOGNIZED',
      'MISSING:ACTION_NOT_REGISTERED',
      'MISSING:FEATURE_NOT_ENTITLED',
      'SATISFIED:MODULE_ENABLED',
      'MISSING:MODULE_NOT_ENABLED',
      'SATISFIED:INTEGRATION_CONNECTED',
      'MISSING:INTEGRATION_NOT_CONNECTED',
      'SATISFIED:DATA_QUALITY_OK',
      'MISSING:DATA_QUALITY_FAILED',
      'UNKNOWN:DATA_QUALITY_NOT_MEASURED',
      'MISSING:COMMUNICATION_PREFERENCES_NOT_IMPLEMENTED',
    ],
  )
})

test('registry lookups', async () => {
  const { getAction } = await import('../../lib/actions/contracts/catalog.ts')
  const { getDomainEvent } = await import('../../lib/events/contracts/registry.ts')
  const { getDetector } = await import('../../lib/detectors/contracts/registry.ts')
  const { actionRef, ACTION_KEY_PATTERN } = await import('../../lib/actions/contracts/types.ts')
  assert.equal(getAction('business.task.create@1').key, 'business.task.create')
  assert.equal(getAction('business.task.create@2'), null)
  assert.equal(getAction('business.task.create'), null)
  assert.equal(findAction(registry, '@1'), null)
  assert.equal(getDomainEvent('proposal.accepted', 1).aggregateType, 'proposal')
  assert.equal(getDomainEvent('proposal.accepted', 2), null)
  assert.equal(getDetector('stock_critical', 1).status, 'PLANNED')
  assert.equal(getDetector('ghost', 1), null)
  for (const action of ACTION_CATALOG) {
    assert.match(action.key, ACTION_KEY_PATTERN)
    assert.equal(actionRef(action), `${action.key}@${action.majorVersion}`)
  }
})

test('parameter declarations and values: all types and bounds', () => {
  const decl = (parameters) => mutate('lead_followup_task', (recipe) => (recipe.parameters = parameters))
  assert.ok(codes(decl('x')).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(decl(Array.from({ length: 9 }, (_, index) => ({ key: `p_${index}`, type: 'boolean', label: 'x', default: true })))).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(decl([{ key: 'X', type: 'boolean', label: 'x', default: true }])).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(decl([{ key: 'bad', type: 'code', label: 'x', default: '' }])).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(decl([{ key: 'opts', type: 'enum', label: 'x', default: 'a', options: [] }])).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(decl([{ key: 'who', type: 'member_ref', label: 'x', required: true }])).includes('RECIPE_PARAMETER_INVALID'))
  assert.ok(codes(decl([{ key: 'flag', type: 'boolean', label: 'x', default: 'yes' }])).includes('RECIPE_PARAMETER_INVALID'))
  const recipe = {
    parameters: [
      { key: 'n', type: 'integer', label: 'x', default: 2, min: 0, max: 5 },
      { key: 'flag', type: 'boolean', label: 'x', default: false },
      { key: 'statuses', type: 'status_set', label: 'x', scope: 'order', default: ['a'] },
    ],
  }
  assert.deepEqual(validateRecipeParams(recipe, { n: 5, flag: true, statuses: ['b'] }).value, { n: 5, flag: true, statuses: ['b'] })
  assert.equal(validateRecipeParams(recipe, { n: 6 }).ok, false)
  assert.equal(validateRecipeParams(recipe, { n: 1.5 }).ok, false)
  assert.equal(validateRecipeParams(recipe, { flag: 'true' }).ok, false)
  assert.equal(validateRecipeParams(recipe, { statuses: [''] }).ok, false)
  assert.equal(validateRecipeParams(recipe, { statuses: 'a' }).ok, false)
})

test('header fields and trigger shape are validated', () => {
  const header = [
    [(recipe) => (recipe.schemaVersion = 2), 'RECIPE_SCHEMA_VERSION'],
    [(recipe) => (recipe.key = 'Bad Key'), 'RECIPE_ID_INVALID'],
    [(recipe) => (recipe.version = 'v1'), 'RECIPE_ID_INVALID'],
    [(recipe) => (recipe.changelog = []), 'RECIPE_ID_INVALID'],
    [(recipe) => (recipe.name = 'Veja www.evil.example'), 'RECIPE_FIELD_INVALID'],
    [(recipe) => (recipe.description = ''), 'RECIPE_FIELD_INVALID'],
    [(recipe) => (recipe.category = 'marketing'), 'RECIPE_FIELD_INVALID'],
    [(recipe) => (recipe.businessTypes = []), 'RECIPE_FIELD_INVALID'],
    [(recipe) => (recipe.trigger = null), 'RECIPE_TRIGGER_UNKNOWN'],
    [(recipe) => (recipe.trigger.type = 'webhook'), 'RECIPE_TRIGGER_UNKNOWN'],
    [(recipe) => (recipe.trigger.subject = 'invoice'), 'RECIPE_TRIGGER_UNKNOWN'],
    [(recipe) => (recipe.trigger.cadence = 'PT1M'), 'RECIPE_TRIGGER_UNKNOWN'],
    [(recipe) => (recipe.trigger.windowKey = 'hour'), 'RECIPE_TRIGGER_UNKNOWN'],
    [(recipe) => (recipe.trigger.detectorKey = 'ghost'), 'RECIPE_TRIGGER_UNKNOWN'],
    [(recipe) => (recipe.trigger.subject = 'order'), 'RECIPE_TRIGGER_SUBJECT_MISMATCH'],
    [(recipe) => (recipe.actions = []), 'RECIPE_ACTION_INVALID'],
    [(recipe) => (recipe.actions = [null]), 'RECIPE_ACTION_INVALID'],
    [(recipe) => (recipe.actions[0].onFailure = 'retry'), 'RECIPE_ACTION_INVALID'],
    [(recipe) => (recipe.actions[0].input = null), 'RECIPE_ACTION_INPUT_INVALID'],
    [(recipe) => (recipe.dependencies = 'x'), 'RECIPE_DEPENDENCY_INVALID'],
    [(recipe) => recipe.dependencies.push({ type: 'feature', feature: 'teleporte' }), 'RECIPE_DEPENDENCY_INVALID'],
    [(recipe) => (recipe.limits = null), 'RECIPE_LIMITS_INVALID'],
    [(recipe) => (recipe.dedupe = {}), 'RECIPE_DEDUPE_INVALID'],
    [(recipe) => (recipe.confirmation = null), 'RECIPE_CONFIRMATION_INVALID'],
    [(recipe) => (recipe.risk = null), 'RECIPE_RISK_MISMATCH'],
  ]
  for (const [fn, code] of header) assert.ok(codes(mutate('lead_followup_task', fn)).includes(code), code)
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.due_in_days = { literal: 500 }))).includes('literal_integer'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.titulo = { literal: '' }))).includes('literal_string'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.crm_lead_id = { trigger: 'companyId' }))).includes('trigger_field_not_mappable'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.titulo = { trigger: 'subjectId' }))).includes('subject_id_needs_uuid_field'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.titulo = 'x'))).includes('shape'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.titulo = { other: 1 }))).includes('shape'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.prioridade = { param: 'due_in_days' }))).includes('param_type'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.due_in_days = { param: 'priority' }))).includes('param_type'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.responsavel_id = { param: 'priority' }))).includes('param_type'))
  assert.ok(reasons(mutate('lead_followup_task', (recipe) => (recipe.actions[0].input.responsavel_id = { param: 'ghost' }))).includes('unknown_param'))
})
