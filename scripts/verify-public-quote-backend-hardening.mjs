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

function loadTs(path, deps) {
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
    console, Date, TextDecoder, Number,
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
