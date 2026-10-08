// Offline contract tests for Agent 9's public quote route.
// Run from the repository root: node scripts/verify-public-quote-backend-hardening.mjs
// No Supabase, production data or network access.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const routeFile = 'app/api/public/orcamento/[slug]/route.ts'
const validCompany = {
  id: 'company-1', slug: 'my-shop', subdomain_slug: 'my-shop',
  ativo: true, site_publico_ativo: true, site_status: 'publicado',
}
const validGrant = {
  product_id: 'business', user_id: null, company_id: 'company-1',
  status: 'active', starts_at: '2020-01-01T00:00:00.000Z',
  expires_at: null, permissions: ['business.write'],
}
const validBody = {
  nome: 'Cliente', telefone: '(82) 99999-9999',
  produto: 'Cartão', quantidade: '1', observacoes: '',
}

const NextResponse = {
  json(body, options = {}) {
    return { status: options.status || 200, body, headers: options.headers || {} }
  },
}

function loadTs(path, deps, context = {}) {
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  })
  const errors = (compiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, 'TypeScript transpilation must succeed: ' + path)
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    require(id) {
      if (!Object.hasOwn(deps, id)) throw new Error('Unexpected dependency: ' + id)
      return deps[id]
    },
    console, Date, TextDecoder, Number, ...context,
  }, { filename: path })
  return module.exports
}

const requestHelpers = loadTs('lib/security/request.ts', {
  'next/server': { NextResponse },
})
const grantHelpers = loadTs('lib/ecosystem/access.ts', {})

function harness(options = {}) {
  const inserts = []
  const rateCalls = []
  const database = {
    from(table) {
      if (table === 'companies') return {
        select() {
          return {
            or() {
              return {
                async limit() {
                  return {
                    data: options.companies === undefined ? [validCompany] : options.companies,
                    error: options.companyError || null,
                  }
                },
              }
            },
          }
        },
      }
      if (table === 'ecosystem_product_entitlements') return {
        select() {
          return {
            eq() {
              return this
            },
            async is() {
              return {
                data: options.grants === undefined ? [validGrant] : options.grants,
                error: options.grantsError || null,
              }
            },
          }
        },
      }
      if (table === 'orders') return {
        insert(payload) {
          inserts.push(payload)
          return {
            select() {
              return {
                async single() {
                  return {
                    data: options.orderError ? null : { id: 'order-1' },
                    error: options.orderError || null,
                  }
                },
              }
            },
          }
        },
      }
      throw new Error('Unexpected database table: ' + table)
    },
  }

  const { POST } = loadTs(routeFile, {
    'next/server': { NextResponse },
    '@/lib/company-access': { getSupabaseAdmin: () => database },
    '@/lib/ecosystem/access': grantHelpers,
    '@/lib/security/request': requestHelpers,
    '@/lib/security/rate-limit': {
      async enforceRateLimit(_request, settings) {
        rateCalls.push(settings)
        return options.rateDown ? NextResponse.json({ error: 'Proteção temporariamente indisponível.' }, { status: 503 }) : null
      },
    },
  })

  async function send(body = validBody) {
    const raw = typeof options.rawBody === 'string' ? options.rawBody : JSON.stringify(body)
    const bytes = new TextEncoder().encode(raw)
    const request = {
      headers: {
        get(name) {
          if (name === 'content-type') return options.contentType === undefined ? 'application/json' : options.contentType
          if (name === 'content-length') return options.claimedLength === undefined ? String(bytes.byteLength) : options.claimedLength
          if (name === 'x-forwarded-for') return '203.0.113.10'
          return null
        },
      },
      async arrayBuffer() { return bytes.buffer },
    }
    return POST(request, { params: Promise.resolve({ slug: options.slug || 'my-shop' }) })
  }
  return { send, inserts, rateCalls }
}

let total = 0
async function check(name, options, expectedStatus, expectedWrites, input = validBody) {
  const h = harness(options)
  const response = await h.send(input)
  assert.equal(response.status, expectedStatus, name + ' HTTP')
  assert.equal(h.inserts.length, expectedWrites, name + ' INSERT count')
  if (expectedStatus >= 500) {
    assert.equal(JSON.stringify(response.body).includes('database-credential'), false)
    assert.equal(JSON.stringify(response.body).includes('SQL'), false)
  }
  total++
  console.log('PASS ' + name)
  return { response, h }
}

await check('published active Business write grant', {}, 201, 1)
await check('site unpublished', { companies: [{ ...validCompany, site_publico_ativo: false }] }, 404, 0)
await check('site status unknown', { companies: [{ ...validCompany, site_status: null }] }, 404, 0)
await check('site status incompatible', { companies: [{ ...validCompany, site_status: 'rascunho' }] }, 404, 0)
await check('company inactive', { companies: [{ ...validCompany, ativo: false }] }, 404, 0)
await check('company not found', { companies: [] }, 404, 0)
await check('ambiguous slug', { companies: [validCompany, { ...validCompany, id: 'company-2' }] }, 404, 0)
await check('read-only grant', { grants: [{ ...validGrant, permissions: ['business.read'] }] }, 403, 0)
await check('revoked grant', { grants: [{ ...validGrant, status: 'revoked' }] }, 403, 0)
await check('expired grant', { grants: [{ ...validGrant, expires_at: '2020-02-01T00:00:00.000Z' }] }, 403, 0)
await check('no Business grant', { grants: [] }, 403, 0)
await check('rate limiter down', { rateDown: true }, 503, 0)
await check('invalid JSON', { rawBody: '{' }, 400, 0)
await check('array JSON', {}, 400, 0, [])
await check('quantity zero', {}, 400, 0, { ...validBody, quantidade: 0 })
await check('quantity negative', {}, 400, 0, { ...validBody, quantidade: -1 })
await check('quantity over limit', {}, 400, 0, { ...validBody, quantidade: 100001 })
await check('quantity wrong type', {}, 400, 0, { ...validBody, quantidade: {} })
await check('name wrong type', {}, 400, 0, { ...validBody, nome: ['invalid'] })
await check('phone letters', {}, 400, 0, { ...validBody, telefone: 'abc11999999999' })
await check('payload too large', {}, 413, 0, { ...validBody, observacoes: 'x'.repeat(9000) })
await check('schema failure sanitized', { companyError: { message: 'SQL database-credential exposed' } }, 503, 0)
await check('entitlement query failure sanitized', { grantsError: { message: 'SQL database-credential exposed' } }, 503, 0)
await check('order failure sanitized', { orderError: { message: 'SQL database-credential exposed' } }, 503, 1)

const h = harness()
assert.equal((await h.send()).status, 201)
assert.equal((await h.send()).status, 201)
assert.equal(h.inserts.length, 2, 'no DB idempotency contract yet')
assert.equal(h.rateCalls[0].failOpen, false)
assert.equal(h.rateCalls[0].identity, 'my-shop', 'rate limit must not trust a spoofed IP')
total++
console.log('PASS duplicate behavior documented: TWO INSERTs, NOT beta-safe')
console.log('PASS ' + total + ' offline checks. Remaining blocker: database-backed idempotency and atomic publication guarantee.')


// BE01_PUBLICATION_PARTIAL_PATCH_HOTFIX: authenticated PATCH, mocked DB only.
// Real route code is transpiled in the same VM harness; no network or database.
const settingsCompanyId = '22222222-2222-4222-8222-222222222222'
const settingsUserId = '11111111-1111-4111-8111-111111111111'

function settingsHarness(options = {}) {
  const company = {
    id: settingsCompanyId,
    nome: 'Empresa Original',
    site_status: 'rascunho',
    site_publico_ativo: false,
    ...(options.company || {}),
  }
  const writes = []
  const mfaCalls = []
  const audits = []

  const db = {
    auth: {
      async getUser(token) {
        return {
          data: { user: options.authenticated === false || token !== 'valid-token'
            ? null
            : { id: settingsUserId, email: 'owner@example.com' } },
          error: null,
        }
      },
    },
    from(table) {
      if (table === 'companies') {
        return {
          select() {
            return {
              or() {
                return { async maybeSingle() { return { data: options.member ? null : company, error: null } } }
              },
              eq() {
                return { async maybeSingle() { return { data: company, error: null } } }
              },
            }
          },
          update(payload) {
            writes.push({ ...payload })
            return {
              eq() {
                return {
                  select() {
                    return {
                      async single() {
                        Object.assign(company, payload)
                        return { data: { ...company }, error: null }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }
      if (table === 'company_members') {
        return {
          select() {
            return {
              eq() { return this },
              async maybeSingle() {
                return { data: options.member ? {
                  company_id: settingsCompanyId, cargo: 'funcionario', status: 'ativo',
                } : null, error: null }
              },
            }
          },
        }
      }
      throw new Error('Unexpected settings table: ' + table)
    },
  }

  const { PATCH } = loadTs('app/api/company/settings/route.ts', {
    'next/server': { NextResponse },
    '@supabase/supabase-js': { createClient: () => db },
    '@/lib/business-types': { normalizeBusinessType: (value) => value },
    '@/lib/company-url': { getCompanyPublicUrl: (slug) => '/site/' + slug },
    '@/lib/security/mfa': {
      async requireMfaStepUpForRequest(_request, purpose) {
        mfaCalls.push(purpose)
        return options.mfaDenied
          ? { allowed: false, error: 'MFA obrigatório.', reason: 'mfa_step_up_required', status: 403, state: { currentLevel: 'aal1' } }
          : { allowed: true }
      },
    },
    '@/lib/security/privileged-actions': {
      getSensitiveSettingsFields(body) {
        if (!body || typeof body !== 'object') return []
        return Object.keys(body).filter((key) => ['pix_key', 'pix_tipo', 'aceita_pix'].includes(key))
      },
    },
    '@/lib/security/privileged-audit': {
      async recordPrivilegedAudit(_db, _request, entry) { audits.push(entry) },
    },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://invalid.local', SUPABASE_SERVICE_ROLE_KEY: 'test-only' } } })

  async function patch(body) {
    return PATCH({
      headers: {
        get(name) { return name === 'authorization' && options.authenticated !== false ? 'Bearer valid-token' : null },
      },
      async json() { return body },
    })
  }
  return { patch, company, writes, mfaCalls, audits }
}

async function checkSettings(name, options, payload, expectedStatus, expectedPublication = {}) {
  const h = settingsHarness(options)
  const before = { site_status: h.company.site_status, site_publico_ativo: h.company.site_publico_ativo }
  const response = await h.patch(payload)
  assert.equal(response.status, expectedStatus, name + ' HTTP')
  if (expectedStatus === 200) {
    assert.equal(h.writes.length, 1, name + ' single update')
    for (const field of ['site_status', 'site_publico_ativo']) {
      if (!Object.hasOwn(payload, field)) {
        assert.equal(Object.hasOwn(h.writes[0], field), false, name + ' omitted ' + field)
        assert.equal(h.company[field], before[field], name + ' preserved ' + field)
      } else {
        assert.equal(h.company[field], expectedPublication[field], name + ' explicit ' + field)
      }
    }
  } else {
    assert.equal(h.writes.length, 0, name + ' must not update')
    assert.equal(h.company.site_status, before.site_status, name + ' status unchanged')
    assert.equal(h.company.site_publico_ativo, before.site_publico_ativo, name + ' activation unchanged')
  }
  total++
  console.log('PASS ' + name)
  return h
}

await checkSettings('name PATCH preserves draft', {}, { nome: 'Empresa Nova' }, 200)
await checkSettings('unrelated PATCH preserves disabled site', { company: { site_status: 'publicado' } }, { nome: 'Empresa Nova' }, 200)
await checkSettings('omitted flags never included in update', {}, { instagram: 'social' }, 200)
await checkSettings('explicit publication both fields', {}, { site_status: 'publicado', site_publico_ativo: true }, 200, { site_status: 'publicado', site_publico_ativo: true })
await checkSettings('explicit unpublish and disable', { company: { site_status: 'publicado', site_publico_ativo: true } }, { site_status: 'rascunho', site_publico_ativo: false }, 200, { site_status: 'rascunho', site_publico_ativo: false })
await checkSettings('explicit publication status only preserves activation', {}, { site_status: 'publicado' }, 200, { site_status: 'publicado' })
await checkSettings('explicit activation only preserves draft', {}, { site_publico_ativo: true }, 200, { site_publico_ativo: true })

for (const [name, payload] of [
  ['null status', { site_status: null }],
  ['uppercase status', { site_status: 'PUBLICADO' }],
  ['status with whitespace', { site_status: ' publicado ' }],
  ['status boolean', { site_status: true }],
  ['unknown status', { site_status: 'archived' }],
  ['null activation', { site_publico_ativo: null }],
  ['activation as string false', { site_publico_ativo: 'false' }],
  ['activation as string true', { site_publico_ativo: 'true' }],
  ['activation as number', { site_publico_ativo: 1 }],
  ['activation as object', { site_publico_ativo: {} }],
  ['valid status and invalid activation', { site_status: 'publicado', site_publico_ativo: 'true' }],
  ['invalid status and valid activation', { site_status: 'unknown', site_publico_ativo: true }],
]) {
  await checkSettings('reject malformed ' + name, {}, payload, 400)
}

await checkSettings('unauthenticated PATCH denied', { authenticated: false }, { site_status: 'publicado' }, 401)
await checkSettings('member without owner rights denied', { member: true }, { site_status: 'publicado' }, 403)
const deniedMfa = await checkSettings('sensitive settings still require MFA', { mfaDenied: true }, { site_status: 'publicado', pix_key: 'sample' }, 403)
assert.deepEqual(deniedMfa.mfaCalls, ['pix.update'])
assert.equal(deniedMfa.audits.length, 1)
const successfulMfa = await checkSettings('sensitive settings still accept authorized MFA', {}, { site_status: 'publicado', pix_key: 'sample' }, 200, { site_status: 'publicado' })
assert.deepEqual(successfulMfa.mfaCalls, ['pix.update'])
assert.equal(successfulMfa.audits.length, 1)

console.log('PASS ' + total + ' total offline checks (public quote + settings publication hotfix).')
