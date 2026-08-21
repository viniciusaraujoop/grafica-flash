import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

const [
  loginPage,
  loginAction,
  panelLayout,
  companyCurrent,
  currentCompanyClient,
  serverClient,
  proxy,
] = await Promise.all([
  source('app/login/page.tsx'),
  source('app/login/actions.ts'),
  source('app/painel/layout.tsx'),
  source('app/api/company/current/route.ts'),
  source('lib/current-company-client.ts'),
  source('lib/supabase-server.ts'),
  source('proxy.ts'),
])

assert.match(loginPage, /signInWithPasswordAction/, 'Login precisa concluir autenticação pela Server Action SSR.')
assert.equal(loginPage.includes('supabase.auth.signInWithPassword'), false, 'Login client-side não pode reassumir o contrato de sessão.')
assert.equal(loginPage.includes('supabase.auth.setSession'), false, 'Login não pode duplicar a sessão depois do signIn.')
assert.equal(loginPage.includes("Authorization: `Bearer ${accessToken}`"), false, 'Login não pode validar empresa por Bearer antes de navegar para o SSR.')
assert.equal(loginPage.includes('router.replace(getSafeNextPath())'), false, 'Login não pode navegar client-side depois de mudar a identidade.')

assert.match(loginAction, /^'use server'/, 'Login precisa ser mutação server-side.')
assert.match(loginAction, /createSupabaseServerClient/, 'Server Action precisa usar o cliente Supabase SSR request-scoped.')
assert.match(loginAction, /auth\.signInWithPassword/, 'Server Action precisa executar o signIn canônico.')
assert.match(loginAction, /revalidatePath\('\/', 'layout'\)/, 'Mudança de identidade precisa invalidar o Router Cache antes do redirect.')
assert.match(loginAction, /redirect\(destination, RedirectType\.replace\)/, 'Login precisa concluir com redirect server-side replace.')
assert.equal(loginAction.includes('setTimeout('), false, 'Login não pode depender de delay arbitrário.')
assert.equal(loginAction.includes('access_token'), false, 'Server Action não deve manipular access token manualmente.')
assert.equal(loginAction.includes('refresh_token'), false, 'Server Action não deve manipular refresh token manualmente.')

assert.match(serverClient, /createServerClient/, 'Servidor precisa usar @supabase/ssr.')
assert.match(serverClient, /await cookies\(\)/, 'Servidor precisa usar cookies da request atual.')
assert.match(serverClient, /getAll\(\)/, 'Cliente SSR precisa ler cookies da request.')
assert.match(serverClient, /cookieStore\.set/, 'Cliente SSR precisa persistir cookies emitidos pelo Supabase.')

assert.match(companyCurrent, /getClaims\(\)/, 'company/current precisa validar a sessão SSR por cookie.')
assert.equal(companyCurrent.includes('getRequesterWithSingleRetry'), false, 'company/current não pode reintroduzir retry por tempo.')
assert.equal(companyCurrent.includes('setTimeout('), false, 'company/current não pode esperar para o mesmo token “ficar válido”.')
assert.match(companyCurrent, /auth_source: source/, 'company/current precisa registrar a origem de auth sem logar segredo.')
assert.match(companyCurrent, /company_load_success/, 'company/current precisa manter observabilidade estruturada.')
assert.match(companyCurrent, /company_load_failure/, 'Falhas de company/current precisam ser observáveis.')

assert.match(currentCompanyClient, /credentials: 'same-origin'/, 'Cliente de empresa precisa usar o cookie SSR da mesma origem.')
const currentCompanyFunction = currentCompanyClient.slice(
  currentCompanyClient.indexOf('export async function getCurrentCompanyClient'),
  currentCompanyClient.indexOf('// APIs legadas'),
)
assert.equal(currentCompanyFunction.includes('getSession()'), false, 'Current company não pode depender de getSession client-side.')
assert.equal(currentCompanyFunction.includes('Authorization'), false, 'Current company não pode exigir Bearer manual.')

assert.equal(panelLayout.includes('obterTokenComRetry'), false, 'Layout protegido não pode fazer polling de token.')
assert.equal(panelLayout.includes('refreshSession()'), false, 'Primeiro carregamento do painel não deve disparar refresh concorrente.')
assert.equal(panelLayout.includes('setTimeout('), false, 'Layout protegido não pode resolver auth por cronômetro.')
assert.match(panelLayout, /credentials: 'same-origin'/, 'Layout protegido precisa consultar company/current com a mesma sessão SSR.')
assert.match(panelLayout, /panel_auth_resolved/, 'Layout precisa registrar quando AUTHENTICATED foi resolvido.')
assert.match(panelLayout, /setRetryKey/, 'Erro recuperável do backend deve permitir retry explícito sem reload da página.')

assert.match(proxy, /const protectedPanel = pathname === '\/painel'/, 'Proxy precisa tratar /painel como conteúdo privado.')
assert.match(proxy, /Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate'/, 'Painel protegido não pode ser servido por cache público.')
assert.match(proxy, /auth\.getClaims\(\)/, 'Proxy precisa validar/renovar sessão conforme o padrão SSR atual.')
assert.equal(proxy.includes('auth.getSession()'), false, 'Proxy não pode confiar em getSession para autorização.')

for (const sourceText of [loginPage, loginAction, companyCurrent, serverClient, proxy]) {
  assert.equal(/service_role/i.test(sourceText), false, 'Fluxo de login/browser não pode expor service_role.')
  assert.equal(/localStorage\.setItem\([^\n]*(access|refresh)[_-]?token/i.test(sourceText), false, 'Fluxo de auth não pode persistir token manualmente no localStorage.')
}

console.log('Auth first-login race invariants: PASS')
