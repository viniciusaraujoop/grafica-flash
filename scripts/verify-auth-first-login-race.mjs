import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

const [loginPage, loginAction, panelLayout, panelClientShell, panelAction, panelHeader, companyCurrent, currentCompanyClient, serverClient, proxy] = await Promise.all([
  source('app/login/page.tsx'),
  source('app/login/actions.ts'),
  source('app/painel/layout.tsx'),
  source('components/painel/PanelAuthenticatedLayout.tsx'),
  source('app/painel/actions.ts'),
  source('components/painel/PanelPremiumHeader.tsx'),
  source('app/api/company/current/route.ts'),
  source('lib/current-company-client.ts'),
  source('lib/supabase-server.ts'),
  source('proxy.ts'),
])

assert.match(loginPage, /signInWithPasswordAction/, 'Login precisa concluir autenticação pela Server Action SSR.')
assert.equal(loginPage.includes('supabase.auth.signInWithPassword'), false, 'Login client-side não pode reassumir o contrato de sessão.')
assert.equal(loginPage.includes('supabase.auth.setSession'), false, 'Login não pode duplicar a sessão depois do signIn.')
assert.equal(loginPage.includes('Authorization:'), false, 'Login não pode validar empresa por Bearer antes de navegar para o SSR.')
assert.equal(loginPage.includes('router.replace(getSafeNextPath())'), false, 'Login não pode navegar client-side depois de mudar a identidade.')

assert.match(loginAction, /^'use server'/, 'Login precisa ser mutação server-side.')
assert.match(loginAction, /auth\.signInWithPassword/, 'Server Action precisa executar o signIn canônico.')
assert.match(loginAction, /revalidatePath\('\/', 'layout'\)/, 'Mudança de identidade precisa invalidar o Router Cache.')
assert.match(loginAction, /redirect\(destination, RedirectType\.replace\)/, 'Login precisa concluir com redirect server-side replace.')
assert.equal(loginAction.includes('setTimeout('), false, 'Login não pode depender de delay arbitrário.')
assert.equal(loginAction.includes('access_token'), false, 'Server Action não deve manipular access token manualmente.')
assert.equal(loginAction.includes('refresh_token'), false, 'Server Action não deve manipular refresh token manualmente.')

assert.match(panelLayout, /export const dynamic = 'force-dynamic'/, 'Layout protegido precisa ser dinâmico.')
assert.match(panelLayout, /auth\.getClaims\(\)/, 'Layout protegido precisa validar identidade por claims.')
assert.match(panelLayout, /getCompanyAccess/, 'Layout protegido precisa resolver empresa antes de renderizar.')
assert.equal(panelLayout.includes("'use client'"), false, 'Contrato inicial do painel não pode voltar a client-only.')
for (const forbidden of ['/api/company/current', 'getSession()', 'refreshSession()', 'setTimeout(', 'Authorization']) {
  assert.equal(panelLayout.includes(forbidden), false, `Layout protegido não pode conter ${forbidden}.`)
}

assert.match(panelClientShell, /^'use client'/, 'Somente a casca visual deve permanecer client-side.')
assert.equal(panelClientShell.includes('/api/company/current'), false, 'Casca visual não pode refazer autorização inicial.')
assert.equal(panelClientShell.includes('getSession()'), false, 'Casca visual não pode iniciar nova corrida de sessão.')
assert.equal(panelClientShell.includes('window.location.reload'), false, 'Casca visual não pode depender de reload documental.')
assert.match(panelClientShell, /router\.refresh\(\)/, 'Revalidação pós-pagamento deve usar refresh do App Router.')

assert.match(panelAction, /^'use server'/, 'Logout precisa ser mutação server-side.')
assert.match(panelAction, /auth\.signOut\(\)/, 'Logout precisa encerrar a sessão pelo cliente SSR.')
assert.match(panelAction, /redirect\('\/login', RedirectType\.replace\)/, 'Logout precisa terminar em redirect server-side.')
assert.match(panelHeader, /signOutAction/, 'Cabeçalho precisa chamar logout SSR.')
assert.equal(panelHeader.includes('supabase.auth.signOut'), false, 'Cabeçalho não pode manter logout client-side paralelo.')

assert.match(serverClient, /createServerClient/, 'Servidor precisa usar @supabase/ssr.')
assert.match(serverClient, /await cookies\(\)/, 'Servidor precisa usar cookies da request atual.')
assert.match(serverClient, /getAll\(\)/, 'Cliente SSR precisa ler cookies da request.')
assert.match(serverClient, /cookieStore\.set/, 'Cliente SSR precisa persistir cookies emitidos pelo Supabase.')

assert.match(companyCurrent, /getClaims\(\)/, 'company/current precisa validar a sessão SSR por cookie.')
assert.equal(companyCurrent.includes('setTimeout('), false, 'company/current não pode esperar token por cronômetro.')
assert.match(companyCurrent, /auth_source: source/, 'company/current precisa observar a origem de auth sem segredo.')

assert.match(currentCompanyClient, /credentials: 'same-origin'/, 'Current company deve usar cookie SSR da mesma origem.')
const currentCompanyFunction = currentCompanyClient.slice(currentCompanyClient.indexOf('export async function getCurrentCompanyClient'), currentCompanyClient.indexOf('// APIs legadas'))
assert.equal(currentCompanyFunction.includes('getSession()'), false, 'Current company principal não pode depender de getSession client-side.')
assert.equal(currentCompanyFunction.includes('Authorization'), false, 'Current company principal não pode exigir Bearer manual.')

assert.match(proxy, /const protectedPanel = pathname === '\/painel'/, 'Proxy precisa tratar /painel como privado.')
assert.match(proxy, /auth\.getClaims\(\)/, 'Proxy precisa validar/renovar sessão pelo padrão SSR atual.')
assert.equal(proxy.includes('auth.getSession()'), false, 'Proxy não pode confiar em getSession para autorização.')
assert.match(proxy, /setAll\(cookies, headers\)/, 'Proxy precisa receber os cache headers emitidos pelo @supabase/ssr atual.')
assert.match(proxy, /Object\.assign\(authHeaders, headers \|\| \{\}\)/, 'Proxy precisa preservar os headers anti-cache emitidos no refresh.')
assert.match(proxy, /applyResponseHeaders/, 'Headers do refresh precisam chegar à resposta final.')
assert.match(proxy, /private, no-store, no-cache/, 'Conteúdo protegido precisa ser explicitamente privado e no-store.')

for (const sourceText of [loginPage, loginAction, panelLayout, panelAction, panelHeader, companyCurrent, serverClient, proxy]) {
  assert.equal(/service_role/i.test(sourceText), false, 'Fluxo de auth/browser não pode expor service_role.')
  assert.equal(/localStorage\.setItem\([^\n]*(access|refresh)[_-]?token/i.test(sourceText), false, 'Auth não pode persistir token manualmente no localStorage.')
}

console.log('Auth first-login race invariants: PASS')
