import assert from 'node:assert/strict'
import { isPersonalEcosystemDestination, safeNextPath } from '../lib/auth-navigation.ts'

const fallback = '/painel/inicio'
const noCompanyDestination = (rawNext) => {
  const nextPath = safeNextPath(rawNext)
  return isPersonalEcosystemDestination(nextPath) ? nextPath : '/cadastro'
}

const safeCases = new Map([
  ['/apps', '/apps'],
  ['/apps/', '/apps/'],
  ['/apps?from=login', '/apps?from=login'],
  ['/apps#hub', '/apps#hub'],
  ['/apps/products?tab=one', '/apps/products?tab=one'],
])

for (const [candidate, expected] of safeCases) {
  assert.equal(safeNextPath(candidate), expected, candidate)
  assert.equal(isPersonalEcosystemDestination(safeNextPath(candidate)), true, `personal: ${candidate}`)
}

for (const candidate of [
  '/apps/%2e%2e/login',
  '/apps/%2e%2e/mfa',
  '/apps/%2e%2e/cadastro',
]) {
  assert.equal(safeNextPath(candidate), fallback, candidate)
}

for (const candidate of [
  '/login',
  '/login/reset',
  '/mfa',
  '/mfa/challenge',
  '/cadastro',
  '/cadastro/empresa',
]) {
  assert.equal(safeNextPath(candidate), fallback, candidate)
}

assert.equal(safeNextPath('/apps/%2e%2e/painel'), '/painel')
assert.equal(isPersonalEcosystemDestination(safeNextPath('/apps/%2e%2e/painel')), false)
assert.equal(noCompanyDestination('/apps/%2e%2e/painel'), '/cadastro')

assert.equal(safeNextPath('/apps/foo/%2e%2e/%2e%2e/painel'), '/painel')
assert.equal(isPersonalEcosystemDestination(safeNextPath('/apps/foo/%2e%2e/%2e%2e/painel')), false)
assert.equal(noCompanyDestination('/apps/foo/%2e%2e/%2e%2e/painel'), '/cadastro')

for (const candidate of [
  '//evil.example',
  '/%2f%2fevil.example',
  '/%252f%252fevil.example',
  'https://evil.example',
  'javascript:alert(1)',
  'data:text/html,test',
  '\\\\evil.example',
  '/%5cevil.example',
  '/apps/%00escape',
  '/apps/\u0000escape',
  '/apps/\nescape',
  '/apps/\tescape',
]) {
  assert.equal(safeNextPath(candidate), fallback, JSON.stringify(candidate))
}

assert.equal(noCompanyDestination('/apps'), '/apps')
assert.equal(noCompanyDestination('/apps/products?tab=one'), '/apps/products?tab=one')
assert.equal(noCompanyDestination('/painel'), '/cadastro')

console.log('Auth navigation normalization security regression: PASS')
