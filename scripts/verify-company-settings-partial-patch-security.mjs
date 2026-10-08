// SEC_COMPANY_SETTINGS_PARTIAL_PATCH
// Offline, in-memory regression checks. No Supabase connections or network requests.
// Run from repo root: node scripts/verify-company-settings-partial-patch-security.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadTs(path, deps, context = {}) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  })
  assert.deepEqual((output.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error), [], 'TypeScript transpilation: ' + path)
  const module = { exports: {} }
  vm.runInNewContext(output.outputText, {
    module,
    exports: module.exports,
    require(id) {
      if (!Object.hasOwn(deps, id)) throw new Error('Unexpected dependency: ' + id)
      return deps[id]
    },
    console, Date, Math, process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'offline-dummy-key',
    } }, ...context,
  }, { filename: path, timeout: 2000 })
  return module.exports
}

const uuidOwner = '11111111-1111-4111-8111-111111111111'
const uuidCompany = '22222222-2222-4222-8222-222222222222'
const uuidOther = '33333333-3333-4333-8333-333333333333'
const financial = [
  'pix_key', 'pix_tipo', 'pix_nome', 'pix_cidade',
  'aceita_pix', 'aceita_cartao', 'cobrar_sinal', 'percentual_sinal',
]
const controlled = [
  'nome', 'subdomain_slug', 'whatsapp', 'cidade', 'estado', 'instagram',
  'atendimento_horario', 'atendimento_observacao',
  'site_status', 'site_publico_ativo', 'site_primary_color', 'site_accent_color',
  'site_background_color', 'site_show_store', 'site_show_about',
  'site_show_contact', ...financial, 'business_type',
]
const baseline = {
  id: uuidCompany, owner_id: uuidOwner, slug: 'empresa-original', nome: 'Empresa Original',
  site_status: 'rascunho', site_publico_ativo: false,
  pix_key: 'pix-antigo@empresa.test', pix_tipo: 'email', pix_nome: 'Empresa',
  pix_cidade: 'Maceió', aceita_pix: true, aceita_cartao: true,
  cobrar_sinal: true, percentual_sinal: 35,
  whatsapp: '82999999999', cidade: 'Maceió', estado: 'AL',
  instagram: '@empresa', site_show_store: false, site_show_about: false,
  site_show_contact: false, business_type: 'services',
}
const financialValues = {
  pix_key: 'nova-chave@empresa.test', pix_tipo: 'aleatoria',
  pix_nome: 'Novo Beneficiário', pix_cidade: 'Recife',
  aceita_pix: false, aceita_cartao: false, cobrar_sinal: false,
  percentual_sinal: 20,
}
const NextResponse = {
  json(body, options = {}) { return { status: options.status || 200, body } },
}
const privilegedActions = loadTs('lib/security/privileged-actions.ts', {})
assert.deepEqual(
  financial.slice().sort(),
  financial.filter((key) => privilegedActions.getSensitiveSettingsFields({ [key]: null }).includes(key)).sort(),
  'every financial setting must be tracked as MFA-sensitive',
)

function setup(options = {}) {
  const company = { ...baseline, ...(options.company || {}) }
  const other = { ...baseline, id: uuidOther, nome: 'Outra Empresa', pix_key: 'outra-chave' }
  const originalOther = JSON.stringify(other)
  const calls = { updates: [], mfa: [], audit: [], lookup: [] }
  const database = {
    auth: {
      async getUser(token) {
        return { data: { user: !options.noAuth && token === 'valid-token'
          ? { id: uuidOwner, email: 'owner@example.com' } : null }, error: null }
      },
    },
    from(table) {
      if (table === 'company_members') {
        return {
          select() {
            return {
              eq() { return this },
              async maybeSingle() {
                return { data: options.role === 'funcionario'
                  ? { company_id: uuidCompany, cargo: 'funcionario', status: 'ativo' }
                  : null, error: null }
              },
            }
          },
        }
      }
      assert.equal(table, 'companies', 'unexpected table')
      return {
        select() {
          return {
            or() {
              return {
                async maybeSingle() {
                  return { data: options.role === 'funcionario' ? null : company, error: null }
                },
              }
            },
            eq(field, value) {
              assert.equal(field, 'id')
              assert.equal(value, uuidCompany)
              return { async maybeSingle() { return { data: company, error: null } } }
            },
          }
        },
        update(changes) {
          return {
            eq(field, value) {
              calls.lookup.push({ field, value })
              return {
                select() {
                  return {
                    async single() {
                      assert.equal(field, 'id')
                      assert.equal(value, uuidCompany, 'never mutate a different tenant')
                      const payload = JSON.parse(JSON.stringify(changes))
                      calls.updates.push(payload)
                      Object.assign(company, payload)
                      return { data: company, error: null }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
  const mfaState = { currentLevel: 'aal1' }
  const { PATCH } = loadTs('app/api/company/settings/route.ts', {
    'next/server': { NextResponse },
    '@supabase/supabase-js': { createClient: () => database },
    '@/lib/business-types': { normalizeBusinessType: (kind) => kind },
    '@/lib/company-url': { getCompanyPublicUrl: (slug) => '/site/' + slug },
    '@/lib/security/mfa': {
      async requireMfaStepUpForRequest(_request, action) {
        calls.mfa.push(action)
        return options.denyMfa
          ? { allowed: false, status: 403, error: 'MFA obrigatório', reason: 'mfa_step_up_required', state: mfaState }
          : { allowed: true, state: { currentLevel: 'aal2' } }
      },
    },
    '@/lib/security/privileged-actions': privilegedActions,
    '@/lib/security/privileged-audit': {
      async recordPrivilegedAudit(_db, _req, details) { calls.audit.push(details) },
    },
  })

  async function patch(body) {
    const request = {
      headers: { get(name) { return name === 'authorization' && !options.noAuth ? 'Bearer valid-token' : null } },
      async json() { return body },
    }
    return PATCH(request)
  }
  return { patch, company, other, originalOther, calls }
}

let passed = 0
async function check(name, input, options = {}, expectedStatus = 200, expected = {}) {
  const test = setup(options)
  const prior = { ...test.company }
  const result = await test.patch(input)
  assert.equal(result.status, expectedStatus, name + ': HTTP')
  assert.equal(test.calls.updates.length, expectedStatus === 200 ? 1 : 0, name + ': update count')
  for (const key of controlled) {
    const inPayload = input && typeof input === 'object' && !Array.isArray(input) && Object.hasOwn(input, key)
    if (!inPayload || expectedStatus !== 200) {
      assert.equal(test.company[key], prior[key], name + ': preserve ' + key)
      if (test.calls.updates.length) assert.equal(Object.hasOwn(test.calls.updates[0], key), false, name + ': omitted update ' + key)
    } else if (Object.hasOwn(expected, key)) {
      assert.equal(test.company[key], expected[key], name + ': explicitly set ' + key)
    }
  }
  assert.equal(JSON.stringify(test.other), test.originalOther, name + ': tenant isolation')
  if (expectedStatus === 200) {
    assert.equal(test.calls.lookup.length, 1)
    assert.equal(test.calls.lookup[0].value, uuidCompany)
  }
  passed++
  console.log('PASS ' + name)
  return { ...test, result }
}

await check('name-only PATCH preserves all financial and publication settings', { nome: 'Novo nome' }, {}, 200, { nome: 'Novo nome' })
await check('address-only PATCH keeps PIX enabled, key and financial settings', { cidade: 'Recife', estado: 'PE' }, {}, 200, { cidade: 'Recife', estado: 'PE' })
await check('unrelated PATCH preserves published, disabled site', { instagram: '@novo' }, { company: { site_status: 'publicado', site_publico_ativo: false } })
await check('empty PATCH does not materialize settings defaults', {})
await check('extra unknown fields cannot be persisted', { desconhecido: 'x' })
await check('explicit publication on', { site_status: 'publicado', site_publico_ativo: true }, {}, 200, { site_status: 'publicado', site_publico_ativo: true })
await check('explicit publication off', { site_status: 'rascunho', site_publico_ativo: false }, { company: { site_status: 'publicado', site_publico_ativo: true } }, 200, { site_status: 'rascunho', site_publico_ativo: false })
await check('explicit publication alone preserves inactive flag', { site_status: 'publicado' }, {}, 200, { site_status: 'publicado' })
await check('explicit activation alone preserves draft', { site_publico_ativo: true }, {}, 200, { site_publico_ativo: true })
await check('nonfinancial normalization remains scoped', { whatsapp: ' 123 ', estado: ' pe ', site_show_store: true }, {}, 200, { whatsapp: '123', estado: 'PE', site_show_store: true })
await check('invalid JSON null', null, {}, 400)
await check('invalid JSON array', [], {}, 400)
await check('invalid JSON string', 'invalid', {}, 400)

for (const [description, body] of [
  ['status null', { site_status: null }],
  ['status boolean', { site_status: true }],
  ['status unknown', { site_status: 'inactive' }],
  ['status uppercase', { site_status: 'PUBLICADO' }],
  ['status with spaces', { site_status: ' publicado ' }],
  ['activation null', { site_publico_ativo: null }],
  ['activation as string true', { site_publico_ativo: 'true' }],
  ['activation as string false', { site_publico_ativo: 'false' }],
  ['activation as number', { site_publico_ativo: 1 }],
  ['activation as object', { site_publico_ativo: {} }],
  ['status valid but activation malformed', { site_status: 'publicado', site_publico_ativo: 'true' }],
  ['activation valid but status malformed', { site_status: null, site_publico_ativo: true }],
]) {
  await check('reject malformed ' + description, body, {}, 400)
}

for (const field of financial) {
  const body = { [field]: financialValues[field] }
  const denied = await check('MFA denied for ' + field, body, { denyMfa: true }, 403)
  assert.deepEqual(denied.calls.mfa, ['pix.update'])
  assert.equal(denied.calls.audit.length, 1)
  assert.equal(denied.calls.audit[0].result, 'denied')
  assert.equal(denied.calls.audit[0].details.fields.includes(field), true)
  const accepted = await check('MFA permitted and audited for ' + field, body, {}, 200, body)
  assert.deepEqual(accepted.calls.mfa, ['pix.update'])
  assert.equal(accepted.calls.audit.length, 1)
  assert.equal(accepted.calls.audit[0].result, 'success')
  assert.equal(accepted.calls.audit[0].details.fields.includes(field), true)
  assert.equal(Object.hasOwn(accepted.calls.updates[0], field), true)
}

const multiple = await check('MFA handles combined financial and publication writes',
  { pix_key: financialValues.pix_key, site_status: 'publicado' },
  {}, 200, { pix_key: financialValues.pix_key, site_status: 'publicado' })
assert.deepEqual(multiple.calls.mfa, ['pix.update'])
assert.equal(multiple.calls.audit.length, 1)

await check('unauthenticated PATCH denied', { nome: 'Intruso', pix_key: 'exfiltrada' }, { noAuth: true }, 401)
await check('nonowner member denied even for explicit publication', { site_status: 'publicado' }, { role: 'funcionario' }, 403)
await check('nonowner member denied for explicit PIX change', { pix_key: 'exfiltrada' }, { role: 'funcionario' }, 403)


// FIN-01 — explicit booleans, no Boolean(value) coercion.
for (const field of ['aceita_pix', 'aceita_cartao', 'cobrar_sinal']) {
  for (const value of [true, false]) {
    const accepted = await check('FIN-01 accept ' + field + ' ' + value,
      { [field]: value }, {}, 200, { [field]: value })
    assert.equal(accepted.calls.updates[0][field], value)
    assert.deepEqual(accepted.calls.mfa, ['pix.update'])
    assert.equal(accepted.calls.audit[0].result, 'success')
  }
  for (const [kind, value] of [
    ['string true', 'true'], ['string false', 'false'], ['string zero', '0'],
    ['number one', 1], ['number zero', 0], ['null', null],
    ['array', []], ['object', {}],
  ]) {
    const denied = await check('FIN-01 reject ' + field + ': ' + kind,
      { nome: 'Should not update', [field]: value }, {}, 400)
    assert.equal(denied.calls.mfa.length, 0)
    assert.equal(denied.calls.audit.length, 0)
  }
}

// FIN-02 — exact canonical PIX type, no fallback.
for (const value of ['telefone', 'email', 'cpf', 'cnpj', 'aleatoria']) {
  const accepted = await check('FIN-02 accept ' + value,
    { pix_tipo: value }, {}, 200, { pix_tipo: value })
  assert.deepEqual(accepted.calls.mfa, ['pix.update'])
  assert.equal(accepted.calls.audit[0].result, 'success')
}
for (const [kind, value] of [
  ['empty', ''], ['uppercase', 'CPF'], ['whitespace', ' cpf '],
  ['unknown', 'chave'], ['null', null], ['number', 1],
  ['boolean', true], ['array', []], ['object', {}],
]) {
  const denied = await check('FIN-02 reject ' + kind,
    { cidade: 'Should not update', pix_tipo: value }, {}, 400)
  assert.equal(denied.calls.mfa.length, 0)
}

// FIN-03 — JSON number, finite, 0..100, at most two decimal places.
// Provenance: orders.percentual_sinal numeric(5,2) in the 20260706 migration.
// Confirm companies.percentual_sinal schema precision before beta certification.
for (const value of [0, 100, 1, 12.34, 0.01, 99.99, 10.5, 0.29]) {
  const accepted = await check('FIN-03 accept ' + value,
    { percentual_sinal: value }, {}, 200, { percentual_sinal: value })
  assert.equal(accepted.calls.updates[0].percentual_sinal, value)
  assert.deepEqual(accepted.calls.mfa, ['pix.update'])
  assert.equal(accepted.calls.audit[0].result, 'success')
}
for (const [kind, value] of [
  ['below minimum', -0.01], ['above maximum', 100.01], ['over max', 101],
  ['negative', -1], ['string', '50'], ['string zero', '0'],
  ['null', null], ['false', false], ['array', []], ['object', {}],
  ['three decimals', 12.345], ['tiny fraction', 0.001],
  ['near max', 99.999], ['sub-cent', 0.00000001],
  ['NaN mock', Number.NaN], ['Infinity mock', Infinity],
]) {
  const denied = await check('FIN-03 reject ' + kind,
    { nome: 'Should not update', percentual_sinal: value }, {}, 400)
  assert.equal(denied.calls.mfa.length, 0)
  assert.equal(denied.calls.audit.length, 0)
}

// One malformed financial field aborts the entire PATCH (not just that field).
for (const [name, payload] of [
  ['invalid percentage, valid PIX/publication', { percentual_sinal: 101, pix_key: 'new@pix', site_status: 'publicado' }],
  ['invalid boolean, valid percentage', { cobrar_sinal: 'false', percentual_sinal: 25, nome: 'Should not update' }],
  ['invalid type, valid boolean/publication', { pix_tipo: 'invalid', aceita_pix: true, site_publico_ativo: true }],
]) {
  const denied = await check('FIN atomic abort ' + name, payload, {}, 400)
  assert.equal(denied.calls.updates.length, 0)
}

// Explicit authorized values still require step-up, even false / zero.
for (const [name, payload] of [
  ['false flag', { aceita_pix: false }],
  ['zero percent', { percentual_sinal: 0 }],
  ['valid type', { pix_tipo: 'cpf' }],
]) {
  const denied = await check('FIN MFA still required ' + name, payload, { denyMfa: true }, 403)
  assert.deepEqual(denied.calls.mfa, ['pix.update'])
  assert.equal(denied.calls.audit[0].result, 'denied')
}

console.log('PASS ' + passed + ' offline company-settings security regression checks. No real database or network.');
