import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) { return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') }

const appsPage=read('app/apps/page.tsx')
const appsLayout=read('app/apps/layout.tsx')
const appsLoading=read('app/apps/loading.tsx')
const appsError=read('app/apps/error.tsx')
const hubHome=read('components/orcaly-next/hub/HubHome.tsx')
const hubSnapshots=read('lib/orcaly-next/runtime/hub-snapshots.ts')
const launcher=read('components/orcaly-next/launcher/UniversalLauncher.tsx')
const businessHome=read('components/painel/BusinessHome.tsx')
const panelAuthLayout=read('components/painel/PanelAuthenticatedLayout.tsx')
const panelShell=read('components/painel/PanelPremiumShell.tsx')
const panelHeader=read('components/painel/PanelPremiumHeader.tsx')
const panelSidebar=read('components/painel/PanelSidebar.tsx')

assert.match(appsPage,/HubHome/); assert.match(appsPage,/getCurrentHubSnapshots/)
assert.match(appsLayout,/UniversalLauncher/); assert.match(appsLayout,/getCurrentHubSnapshots/)
assert.match(appsLoading,/role="status"/); assert.match(appsError,/role="alert"/)
assert.match(hubSnapshots,/companies/); assert.match(hubSnapshots,/affiliate_profiles/); assert.match(hubSnapshots,/getPersonalProductAccess\('wealth'/)
assert.doesNotMatch(hubSnapshots,/insert\(|update\(|delete\(|upsert\(/)
assert.match(hubHome,/Estado atual/); assert.match(hubHome,/Prioridade/); assert.match(hubHome,/Acessos e possibilidades/); assert.match(hubHome,/não está fingindo inteligência/i)
assert.match(businessHome,/\/api\/panel\/today/); assert.match(businessHome,/Estado atual/); assert.match(businessHome,/Próxima ação/); assert.match(businessHome,/role="status"/); assert.match(businessHome,/role="alert"/); assert.match(businessHome,/Sem movimento confirmado/); assert.match(businessHome,/Vendas hoje/); assert.match(businessHome,/Clientes aguardando/); assert.doesNotMatch(businessHome,/Math\.random|faker|mock/i)
assert.match(panelShell,/href="#panel-main"/); assert.match(panelShell,/<main[^>]+id="panel-main"/); assert.match(panelHeader,/UniversalLauncher/); assert.match(panelSidebar,/Escape/); assert.match(launcher,/one\?/); assert.match(launcher,/FoundationRoot/)

// Fake-entitlement regression: Business access must come from the existing panel runtime truth.
assert.match(panelAuthLayout,/pathname !== '\/painel\/assinatura'/)
assert.match(panelAuthLayout,/businessAccessActive=\{payload\.assinatura_ativa\}/)
assert.match(panelAuthLayout,/businessSubscriptionStatus=\{payload\.company\.assinatura_status\}/)
assert.match(panelShell,/businessAccessActive=\{businessAccessActive\}/)
assert.match(panelHeader,/if \(assinaturaAtiva !== true\) return 'NOT_SUBSCRIBED'/)
assert.match(panelHeader,/=== 'trialing' \? 'TRIAL' : 'ACTIVE'/)
assert.doesNotMatch(panelHeader,/productId:\s*'business',\s*status:\s*'ACTIVE'/)
console.log('Visual Wave 1 frontend contract: PASS (36/36 assertions)')
