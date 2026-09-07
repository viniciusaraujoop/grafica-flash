import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

const [
  ordersRoute,
  siteSettingsRoute,
  publicOrderRoute,
  publicOrderPage,
  publicOrderRoot,
  companyCurrentRoute,
  marketingSite,
  storageMigration,
] = await Promise.all([
  source('app/api/orders/route.ts'),
  source('app/api/site/settings/route.ts'),
  source('app/api/public/orcamento/[slug]/route.ts'),
  source('app/orcamento/[slug]/page.tsx'),
  source('app/orcamento/page.tsx'),
  source('app/api/company/current/route.ts'),
  source('components/marketing/MainSiteV2.tsx'),
  source('supabase/migrations/20260820230000_fix_logo_storage_schema_usage.sql'),
])

assert.equal(ordersRoute.includes('file_url'), false, 'Orders API voltou a consultar a coluna inexistente file_url.')
assert.match(ordersRoute, /arquivo_url/, 'Orders API precisa manter arquivo_url, a coluna canônica existente.')

assert.match(siteSettingsRoute, /const urlFields = new Set\(\['logo_url'\]\)/, 'logo_url precisa usar tratamento próprio de URL.')
assert.match(siteSettingsRoute, /function safeUrl\(/, 'Tratamento de logo precisa preservar URLs válidas sem truncamento curto.')
assert.match(siteSettingsRoute, /text\.length > 2048/, 'URLs precisam ter limite defensivo sem truncar nomes normais do Storage.')

assert.match(publicOrderRoute, /\.from\('companies'\)/, 'Endpoint público precisa resolver a empresa no servidor.')
assert.match(publicOrderRoute, /company_id: company\.id/, 'Pedido público precisa usar company_id resolvido no servidor.')
assert.equal(publicOrderRoute.includes('body.company_id'), false, 'Endpoint público não pode confiar em company_id enviado pelo cliente.')
assert.match(publicOrderRoute, /canal_origem: 'formulario_publico'/, 'Pedido público precisa registrar sua origem.')

assert.match(publicOrderPage, /PublicOrderRequestForm/, 'Rota pública por slug precisa renderizar o formulário dedicado.')
assert.equal(publicOrderPage.includes('redirect(`/site/${slug}`)'), false, 'Rota de orçamento não pode voltar a redirecionar para a vitrine.')
assert.match(publicOrderRoot, /getCurrentCompanyClient/, 'CTA interno /orcamento precisa resolver a empresa autenticada.')
assert.match(publicOrderRoot, /\/orcamento\/\$\{encodeURIComponent\(slug\)\}/, 'CTA interno precisa encaminhar para o formulário público da própria empresa.')

assert.match(companyCurrentRoute, /getClaims\(\)/, 'Validação inicial da empresa precisa usar a sessão SSR por cookie.')
assert.equal(companyCurrentRoute.includes('getRequesterWithSingleRetry'), false, 'Retry temporal legado não pode reaparecer no company/current.')
assert.equal(companyCurrentRoute.includes('setTimeout('), false, 'Validação de autenticação não pode depender de cronômetro.')
assert.match(companyCurrentRoute, /getCookieRequester/, 'company/current precisa priorizar a identidade resolvida no servidor.')

assert.match(marketingSite, /Fale com a gente/, 'Home precisa manter a copy comercial corrigida.')
assert.equal(marketingSite.includes('O canal público confirmado hoje'), false, 'Copy técnica antiga não pode reaparecer na home.')

const normalizedMigration = storageMigration.replace(/\s+/g, ' ').trim()
assert.match(normalizedMigration, /GRANT USAGE ON SCHEMA orcaly_private TO authenticated;/i, 'Migration precisa liberar apenas USAGE do schema privado para resolver os helpers de Storage.')
assert.equal(/GRANT\s+ALL/i.test(normalizedMigration), false, 'Migration do hotfix não pode conceder GRANT ALL.')
assert.equal(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(normalizedMigration), false, 'Migration do hotfix não pode desabilitar RLS.')

console.log('Critical login/logo/orders hotfix invariants: PASS')
