import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  COMPANY_ACCESS_COLUMNS,
  DEPRECATED_COMPANY_SECRET_FIELDS,
  hasDeprecatedCompanySecretWrite,
  toClientCompany,
} from '../lib/security/company-client.ts'
import { verifyWhatsAppSignatureWithSecret } from '../lib/whatsapp.ts'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('company DTO strips legacy provider secrets for every company role', () => {
  const company = {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Empresa',
    whatsapp_access_token: 'must-not-leak',
    whatsapp_verify_token: 'must-not-leak',
  }
  for (const role of ['dono', 'gerente', 'funcionario']) {
    const payload = { company: toClientCompany(company), role }
    assert.equal(payload.company?.id, company.id)
    assert.equal(payload.company?.nome, company.nome)
    assert.equal(Object.hasOwn(payload.company || {}, 'whatsapp_access_token'), false)
    assert.equal(Object.hasOwn(payload.company || {}, 'whatsapp_verify_token'), false)
  }
})

test('company access allowlist and current endpoint cannot serialize legacy WhatsApp secret keys', () => {
  assert.equal(COMPANY_ACCESS_COLUMNS.includes('whatsapp_access_token'), false)
  assert.equal(COMPANY_ACCESS_COLUMNS.includes('whatsapp_verify_token'), false)
  assert.deepEqual([...DEPRECATED_COMPANY_SECRET_FIELDS], ['whatsapp_access_token', 'whatsapp_verify_token'])
  assert.equal(hasDeprecatedCompanySecretWrite({ whatsapp_access_token: 'x' }), true)
  assert.equal(hasDeprecatedCompanySecretWrite({ whatsapp_verify_token: 'x' }), true)
  assert.equal(hasDeprecatedCompanySecretWrite({ nome: 'ok' }), false)

  const access = read('lib/company-access.ts')
  assert.doesNotMatch(access, /\.from\('companies'\)\s*\.select\('\*'\)/)
  assert.match(access, /COMPANY_ACCESS_COLUMNS/)

  const route = read('app/api/company/current/route.ts')
  assert.match(route, /company: toClientCompany\(access\.company\)/)
  assert.doesNotMatch(route, /company: access\.company/)
})

test('legacy WhatsApp credential fields reject new company settings writes', () => {
  const source = read('app/api/company/settings/route.ts')
  assert.match(source, /hasDeprecatedCompanySecretWrite\(body\)/)
  assert.match(source, /não aceitam novas gravações/)
})

test('WhatsApp signature verification fails closed and accepts only a valid HMAC', () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account' })
  const secret = 'phase-b1-test-secret'
  const valid = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`

  assert.equal(verifyWhatsAppSignatureWithSecret(body, valid, secret), true)
  assert.equal(verifyWhatsAppSignatureWithSecret(body, 'sha256=00', secret), false)
  assert.equal(verifyWhatsAppSignatureWithSecret(body, valid, ''), false)
  assert.equal(verifyWhatsAppSignatureWithSecret(body, null, secret), false)
})

test('WhatsApp webhook bounds bodies and sanitizes public server errors', () => {
  const source = read('app/api/whatsapp/webhook/route.ts')
  assert.match(source, /MAX_WEBHOOK_BODY_BYTES = 1_000_000/)
  assert.match(source, /content-length/)
  assert.match(source, /Buffer\.byteLength\(rawBody, 'utf8'\)/)
  assert.match(source, /Falha ao processar webhook WhatsApp\./)
  assert.doesNotMatch(source, /error instanceof Error \? error\.message : 'Erro no webhook WhatsApp\.'/)
})

test('Google disconnect revokes provider credential before local deletion and preserves it on failure', () => {
  const adapter = read('lib/integrations/adapters.ts')
  const stop = adapter.indexOf('await stopGoogleCalendarWatches(context)')
  const load = adapter.indexOf('const credentials = await context.loadCredentials()')
  const revoke = adapter.indexOf('await revokeGoogleCredential(credentials)')
  assert.ok(stop >= 0 && load > stop && revoke > load)
  assert.match(adapter, /setConnectionStatus\?\.\('ERROR', 'google_revoke_failed'\)/)
  assert.match(adapter, /throw normalized/)

  const oauth = read('lib/integrations/google/oauth.ts')
  assert.match(oauth, /if \(!response\.ok\)/)
  assert.match(oauth, /Google não confirmou a revogação da credencial\./)
  assert.doesNotMatch(oauth, /Local disconnect must remain possible even if the provider is unavailable/)

  const route = read('app/api/integrations/[provider]/route.ts')
  const disconnect = route.indexOf('await adapter.disconnect')
  const deleteLocal = route.indexOf('await deleteIntegrationCredentials')
  assert.ok(disconnect >= 0 && deleteLocal > disconnect)
  assert.match(route, /credential_preserved: true/)
})
