import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const page = read('app/page.tsx')
const main = read('components/marketing/MainSiteV2.tsx')
const productDemo = read('components/marketing/ProductDemoTabs.tsx')
const selector = read('components/marketing/PlanSelector.tsx')
const referral = read('components/marketing/ReferralBridge.tsx')
const marketing = read('lib/marketing/main-site.ts')
const solutionPage = read('app/solucoes/[slug]/page.tsx')
const sitemap = read('app/sitemap.ts')
const robots = read('app/robots.ts')

assert(!page.includes("'use client'") && !page.includes('"use client"'), 'Homepage must stay server-rendered by default')
assert(page.includes('export const metadata'), 'Homepage metadata missing')
assert(page.includes('SoftwareApplication'), 'Homepage product structured data missing')
assert(page.includes("replace(/</g"), 'JSON-LD must escape < characters')

for (const phrase of ['Seu site, pedidos, clientes e operação', 'Veja o Orçaly funcionando', 'Continue usando o WhatsApp']) {
  assert(main.includes(phrase), `Product-led homepage copy missing: ${phrase}`)
}
for (const weakMetric of ['6 segmentos', '1 painel central', '24h', '99,9%', 'Mais de 100']) {
  assert(!main.includes(weakMetric), `Unverified/weak marketing metric found: ${weakMetric}`)
}
for (const route of ['/cadastro', '/login', '/parceiros', '/suporte']) assert(main.includes(route), `Required public route missing from homepage: ${route}`)
assert(!main.includes('javascript:void') && !main.includes('href="#"'), 'Dead marketing link found')
assert(main.includes('prefers-reduced-motion'), 'Reduced-motion support missing')
assert(main.includes('Mercado Pago'), 'Existing Mercado Pago trust disclosure missing')
assert(main.includes('orcalybr@gmail.com'), 'Verified public contact channel missing')

for (const plan of [
  ['essencial', '49.9'],
  ['profissional', '99.9'],
  ['premium', '149.9'],
]) {
  assert(marketing.includes(`id: '${plan[0]}'`) && marketing.includes(`price: ${plan[1]}`), `Plan contract missing: ${plan[0]}`)
}
for (const slug of ['graficas','restaurantes','assistencia-tecnica','lojas','barbearias','servicos','eventos']) {
  assert(marketing.includes(`slug: '${slug}'`), `Solution config missing: ${slug}`)
}
assert(solutionPage.includes('generateStaticParams') && solutionPage.includes('generateMetadata'), 'Solution SEO contract missing')
assert(solutionPage.includes('notFound()'), 'Invalid solution routes must 404')

assert(referral.includes('orcaly_affiliate_referral_v1'), 'Referral persistence contract missing')
assert(referral.includes('/api/parceiros/track'), 'Referral tracking endpoint missing')
assert(productDemo.includes('role="tablist"') && productDemo.includes('aria-selected'), 'Segment demo accessibility semantics missing')
assert(selector.includes('aria-pressed') && selector.includes('marketingPlanSignupHref'), 'Plan selector accessibility/CTA contract missing')

for (const privateRoute of ['/admin/', '/api/', '/checkout/', '/painel/', '/cliente/', '/pedido/', '/proposta/', '/arte/']) {
  assert(robots.includes(`'${privateRoute}'`), `robots private-route protection missing: ${privateRoute}`)
}
assert(sitemap.includes('marketingSolutions') && sitemap.includes('/cadastro') && sitemap.includes('/parceiros'), 'Public sitemap entries missing')

for (const file of [
  'components/marketing/MainSiteV2.tsx',
  'components/marketing/ProductDemoTabs.tsx',
  'components/marketing/PlanSelector.tsx',
  'components/marketing/ReferralBridge.tsx',
]) {
  const source = read(file)
  assert(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), `Service role reference leaked to marketing UI: ${file}`)
  assert(!source.includes('OPENAI_API_KEY'), `Private AI key reference leaked to marketing UI: ${file}`)
}

console.log('Main Site v2 invariants: PASS')
