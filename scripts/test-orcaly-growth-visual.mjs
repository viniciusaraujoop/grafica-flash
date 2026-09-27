/**
 * Orçaly Growth — isolated visual / keyboard / a11y QA for components/orcaly-next/growth/**.
 * Same approach as scripts/orcaly-next-visual-qa.mjs: esbuild bundles a client entry outside
 * Next.js (next/link shimmed), Playwright drives it. No route is added to the app.
 *
 *   ORCALY_QA_ESBUILD=<esbuild pkg> ORCALY_QA_PLAYWRIGHT=<playwright pkg> ORCALY_QA_NODE_PATH=<node_modules with react>
 *   [ORCALY_QA_AXE=<axe-core pkg>]  [ORCALY_QA_EVIDENCE=<dir>]  node scripts/test-orcaly-growth-visual.mjs
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const need = (name) => { if (!process.env[name]) throw new Error(`Set ${name}`); return require(process.env[name]) }
const esbuild = need('ORCALY_QA_ESBUILD')
const { chromium } = need('ORCALY_QA_PLAYWRIGHT')
const axeSource = process.env.ORCALY_QA_AXE ? readFileSync(require.resolve(`${process.env.ORCALY_QA_AXE}/axe.min.js`), 'utf8') : null
const nodePath = process.env.ORCALY_QA_NODE_PATH || path.join(root, 'node_modules')
const out = path.join(root, '.local-qa', 'orcaly-growth')
const shots = path.join(out, 'screenshots')
mkdirSync(shots, { recursive: true })

const entry = `
import { createRoot } from 'react-dom/client'
import GrowthHome from '@/components/orcaly-next/growth/GrowthHome'
import ExperimentDetail from '@/components/orcaly-next/growth/ExperimentDetail'
import { GrowthExperimentsPage, GrowthLearningsPage, GrowthSourcesPage, GrowthSetupPage } from '@/components/orcaly-next/growth/GrowthPages'
import { GROWTH_DEMO_LABEL, GROWTH_DEMO_TODAY, demoExperiments, demoObservations, demoLearnings, demoReceipts, demoReceiptsByExperiment } from '@/lib/orcaly-next/growth/demo-data'
import { mvpSources } from '@/lib/orcaly-next/growth/providers'
const [view, mode] = location.hash.slice(1).split(':')
const theme = mode === 'dark' ? 'dark' : undefined
const common = { demoLabel: GROWTH_DEMO_LABEL, theme }
const workspace = { experiments: demoExperiments, observations: demoObservations, learnings: demoLearnings, receiptsByExperiment: demoReceiptsByExperiment }
let node
if (view === 'home') node = <GrowthHome workspace={workspace} sources={mvpSources()} today={GROWTH_DEMO_TODAY} {...common} />
else if (view === 'empty') node = <GrowthHome workspace={{ experiments: [], observations: [], learnings: [], receiptsByExperiment: {} }} sources={mvpSources()} today={GROWTH_DEMO_TODAY} theme={theme} />
else if (view === 'board') node = <GrowthExperimentsPage experiments={demoExperiments} observations={demoObservations} {...common} />
else if (view === 'learnings') node = <GrowthLearningsPage learnings={demoLearnings} experiments={demoExperiments} {...common} />
else if (view === 'sources') node = <GrowthSourcesPage sources={mvpSources()} {...common} />
else if (view === 'setup') node = <GrowthSetupPage now={GROWTH_DEMO_TODAY + 'T12:00:00-03:00'} {...common} />
else { const experiment = demoExperiments.find((e) => e.id === view.replace('detail-', '')); node = <ExperimentDetail experiment={experiment} observations={demoObservations} learnings={demoLearnings} receipts={demoReceipts} today={GROWTH_DEMO_TODAY} {...common} /> }
createRoot(document.getElementById('root')).render(node)
`
const aliasPlugin = {
  name: 'orcaly-alias',
  setup(build) {
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'next-link-shim', namespace: 'shim' }))
    build.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: "import { forwardRef, createElement } from 'react'; export default forwardRef(function Link({ href, prefetch, replace, scroll, ...rest }, ref) { return createElement('a', { ...rest, href: String(href), ref }) })", loader: 'js', resolveDir: nodePath }))
    build.onResolve({ filter: /^@\// }, async (args) => build.resolve(`./${args.path.slice(2)}`, { resolveDir: root, kind: args.kind }))
  },
}
await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root, sourcefile: 'growth-harness.tsx' }, bundle: true, outfile: path.join(out, 'bundle.js'), format: 'esm', jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, nodePaths: [nodePath], plugins: [aliasPlugin], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' } })
writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Orçaly Growth QA</title><link rel="stylesheet" href="/bundle.css"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>')

const server = createServer((req, res) => {
  const file = new URL(req.url, 'http://x').pathname.slice(1) || 'index.html'
  if (['index.html', 'bundle.js', 'bundle.css'].includes(file)) { res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }); res.end(readFileSync(path.join(out, file))); return }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>navigated</title><p id="navigated">ok</p>')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const widths = [320, 390, 768, 1024, 1440, 1920]
const results = { generatedAt: new Date().toISOString(), tool: `playwright+esbuild isolated harness${axeSource ? ' + axe-core' : ' (axe unavailable: static a11y lint)'}`, checks: [] }
const record = (name, pass, detail = {}) => { results.checks.push({ name, pass, ...detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail.note ? ` — ${detail.note}` : ''}`) }
const browser = await chromium.launch()

async function open(view, width, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: options.colorScheme ?? 'light' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${base}/#${view}`)
  await page.waitForSelector('main')
  return { page, context, errors }
}

const overflow = () => {
  const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true } return false }
  return { scroll: document.documentElement.scrollWidth, viewport: window.innerWidth, offenders: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !clipped(el) }).slice(0, 5).map((el) => `${el.tagName}.${el.className}`) }
}
const smallTargets = () => [...document.querySelectorAll('button, input, select, textarea, nav a, .button, a[class*="button"]')].filter((el) => { const r = el.getBoundingClientRect(); const radio = el.type === 'radio'; return r.width > 0 && !radio && (r.height < 44 || r.width < 44) }).map((el) => `${el.tagName}.${el.className || el.name} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
const a11yLint = () => {
  const issues = []
  const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ') || el.textContent || '').trim()
  for (const el of document.querySelectorAll('a[href], button, input:not([type=radio]), select, textarea, [role=img]')) if (!name(el) && !(el.id && document.querySelector(`label[for="${el.id}"]`))) issues.push(`no name: ${el.outerHTML.slice(0, 80)}`)
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) issues.push(`duplicate id ${id}`)
  let last = 0
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) { const level = Number(h.tagName[1]); if (last && level > last + 1) issues.push(`heading jump h${last}→h${level}: ${h.textContent.slice(0, 40)}`); last = level }
  if (document.querySelectorAll('h1').length !== 1) issues.push(`h1 count ${document.querySelectorAll('h1').length}`)
  for (const t of document.querySelectorAll('table')) { if (!t.querySelector('caption')) issues.push('table without caption'); if (!t.querySelector('th[scope]')) issues.push('table without scoped headers') }
  for (const el of document.querySelectorAll('[aria-describedby]')) for (const id of el.getAttribute('aria-describedby').split(' ')) if (!document.getElementById(id)) issues.push(`aria-describedby missing ${id}`)
  const zeroish = [...document.querySelectorAll('[data-provenance="UNKNOWN"] dd:first-of-type')].filter((el) => /^\s*(0|R\$ 0,00|0,00%)\s*$/.test(el.textContent))
  if (zeroish.length) issues.push('UNKNOWN metric rendered as zero')
  return issues
}
async function axe(page) {
  if (!axeSource) return null
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => `${v.id}(${v.nodes.length})`))
}

const views = ['home', 'board', 'detail-demo-landing-cta', 'detail-demo-free-shipping', 'detail-demo-referral', 'detail-demo-coupon', 'learnings', 'sources', 'setup', 'empty']
for (const view of views) {
  for (const width of widths) {
    const { page, context, errors } = await open(view, width)
    const o = await page.evaluate(overflow)
    record(`${view}@${width} no horizontal overflow`, o.scroll <= o.viewport && !o.offenders.length, { note: o.offenders.join(', ') || `${o.scroll}/${o.viewport}` })
    const small = await page.evaluate(smallTargets)
    record(`${view}@${width} touch targets ≥44px`, !small.length, { note: small.slice(0, 3).join('; ') })
    record(`${view}@${width} no runtime errors`, !errors.length, { note: errors.slice(0, 2).join(' | ') })
    if (width === 390 || width === 1440) {
      const issues = await page.evaluate(a11yLint)
      record(`${view}@${width} static a11y lint`, !issues.length, { note: issues.slice(0, 4).join('; ') })
      const violations = await axe(page)
      if (violations) record(`${view}@${width} axe WCAG 2.2 AA`, !violations.length, { note: violations.join(', ') })
    }
    await page.screenshot({ path: path.join(shots, `${view}-${width}.png`), fullPage: true, animations: 'disabled' })
    await context.close()
  }
}

// Honesty: demo banner, statuses as text, no WINNER wording, UNKNOWN never zero, chart has textual alternative
{
  const { page, context } = await open('home', 1440)
  record('home shows DEMO / SAMPLE DATA banner', (await page.locator('[data-demo="true"]').textContent()).includes('DEMO / SAMPLE DATA'))
  const text = await page.locator('main').innerText()
  record('no winner/loser language anywhere on home', !/vencedor|perdedor|winner|loser|venceu/i.test(text))
  record('home has the five sections in order', (await page.locator('main h2').allInnerTexts()).join('|') === 'Em andamento|Precisam de atenção|Resultados recentes|Aprendizados|Próximos testes', { note: (await page.locator('main h2').allInnerTexts()).join('|') })
  const rules = await page.locator('[data-rule]').evaluateAll((els) => els.map((el) => el.dataset.rule))
  record('every suggestion exposes its rule id', rules.length > 0 && (await page.locator('[data-rule] code').count()) === rules.length, { note: rules.join(',') })
  record('no vanity totals on home', !/impressões do mês|total de impressões|receita total/i.test(text))
  await context.close()
}
{
  const { page, context } = await open('empty', 1024)
  record('empty workspace renders empty states and no demo banner', (await page.locator('[data-state="empty"]').count()) >= 3 && (await page.locator('[data-demo="true"]').count()) === 0)
  await context.close()
}
{
  const { page, context } = await open('sources', 1024)
  const statuses = await page.locator('[data-source-status]').evaluateAll((els) => [...new Set(els.map((el) => el.dataset.sourceStatus))].sort().join(','))
  record('sources: only MANUAL and NOT_CONFIGURED', statuses === 'MANUAL,NOT_CONFIGURED', { note: statuses })
  record('sources: NOT_CONFIGURED state visible', (await page.locator('[data-state="not-configured"]').count()) === 1)
  await context.close()
}
{
  const { page, context } = await open('detail-demo-free-shipping', 1440)
  record('detail: chart has textual table alternative', (await page.locator('table caption').count()) >= 1 && (await page.locator('[aria-hidden="true"] [class*="barFill"]').count()) === 2)
  const barWidths = await page.locator('[class*="barFill"]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
  record('detail: comparison bars render with visible width', barWidths.length === 2 && barWidths.every((w) => w > 20), { note: barWidths.join(',') })
  const provenanceSize = await page.locator('dd[class*="provenance"]').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  record('detail: provenance line uses small text, not value style', provenanceSize <= 12.5, { note: String(provenanceSize) })
  record('detail: Decision Receipt rendered with allowed conclusion', (await page.locator('[data-receipt]').innerText()).includes('Conclusão permitida'))
  const unknown = await page.locator('[data-provenance="UNKNOWN"]').count()
  record('detail: unknown metrics say "Não disponível"', unknown === 0 || (await page.locator('[data-provenance="UNKNOWN"] dd').first().innerText()) === 'Não disponível', { note: `${unknown} unknown` })
  for (const label of ['Hipótese', 'Resultado', 'Controle e variantes', 'Observações registradas', 'Métricas por braço', 'Decisões']) record(`detail shows "${label}"`, (await page.getByRole('heading', { name: label, exact: true }).count()) === 1)
  await context.close()
}
{
  const { page, context } = await open('detail-demo-coupon', 1024)
  record('detail invalidated: INCONCLUSIVE with reason, no actions', (await page.locator('main').innerText()).includes('Inconclusivo') && (await page.locator('main').innerText()).includes('nenhuma (estado final)'))
  await context.close()
}

// Board keyboard: every card reachable by Tab, visible focus, desktop columns vs mobile list
for (const width of [390, 1440]) {
  const { page, context } = await open('board', width)
  const cards = await page.locator('[data-testid="experiment-board"] article a').count()
  const reached = new Set()
  await page.locator('nav a').last().focus()
  for (let i = 0; i < 40; i += 1) { await page.keyboard.press('Tab'); const href = await page.evaluate(() => document.activeElement?.closest('[data-testid="experiment-board"]') ? document.activeElement.getAttribute('href') : null); if (href) reached.add(href) }
  record(`board@${width} every card reachable by keyboard`, reached.size === cards && cards === 7, { note: `${reached.size}/${cards}` })
  await page.locator('[data-testid="experiment-board"] article a').first().focus()
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement.closest('article')).boxShadow)
  record(`board@${width} focused card shows focus ring`, ring !== 'none', { note: ring.slice(0, 40) })
  const layout = await page.locator('[data-testid="experiment-board"]').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  record(`board@${width} layout ${width >= 1024 ? '5 columns' : 'grouped list'}`, layout === (width >= 1024 ? 5 : 1), { note: String(layout) })
  const columns = await page.locator('[data-column]').evaluateAll((els) => els.map((el) => el.dataset.column).join(','))
  record(`board@${width} column order`, columns === 'DRAFT,READY,RUNNING,PAUSED,COMPLETED', { note: columns })
  await page.screenshot({ path: path.join(shots, `board-focus-${width}.png`), animations: 'disabled' })
  await context.close()
}

// Setup form: submit empty → focus first invalid; fill → checklist ok → honest NOT_CONFIGURED
for (const width of [390, 1440]) {
  const { page, context } = await open('setup', width)
  await page.getByRole('button', { name: 'Validar e salvar rascunho' }).click()
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('name'))
  const invalid = await page.locator('[aria-invalid="true"]').count()
  record(`setup@${width} empty submit focuses first invalid field`, focused === 'title' && invalid >= 3, { note: `focus=${focused} invalid=${invalid}` })
  record(`setup@${width} error announced`, (await page.locator('[role="status"]').innerText()).includes('Revise'))
  const fill = async (name, value) => page.locator(`[name="${name}"]`).fill(value)
  await fill('title', 'Experimento de teste'); await fill('statement', 'Mostrar o prazo de resposta aumenta a conversão.'); await fill('source', 'Entrevistas')
  await fill('thresholdPercent', '10'); await fill('minSamplePerArm', '300'); await fill('minimumDurationDays', '14')
  await fill('windowStart', '2026-10-01'); await fill('windowEnd', '2026-10-20')
  const missing = await page.locator('ul li[class*="missing"]').count()
  record(`setup@${width} checklist complete after filling`, missing === 0, { note: `${missing} missing` })
  await page.keyboard.press('Tab')
  await page.getByRole('button', { name: 'Validar e salvar rascunho' }).press('Enter')
  record(`setup@${width} submit shows honest NOT_CONFIGURED persistence`, (await page.locator('[data-state="not-configured"]').count()) === 1)
  await page.locator('[name="direction"][value="decrease"]').check()
  record(`setup@${width} decrease direction relabels threshold`, (await page.locator(`label[for$="-thresholdPercent"]`).innerText()).includes('redução'))
  await page.screenshot({ path: path.join(shots, `setup-filled-${width}.png`), fullPage: true, animations: 'disabled' })
  await context.close()
}

// Reduced motion + dark mode
{
  const { page, context } = await open('detail-demo-landing-cta', 1024, { reducedMotion: 'reduce' })
  const duration = await page.locator('[class*="barFill"]').first().evaluate((el) => getComputedStyle(el).transitionDuration)
  record('reduced motion collapses bar transitions', parseFloat(duration) < 0.001, { note: duration })
  await context.close()
}
for (const view of ['home', 'detail-demo-landing-cta', 'board', 'setup']) {
  for (const [label, options, hash] of [['OS dark', { colorScheme: 'dark' }, view], ['forced dark', {}, `${view}:dark`]]) {
    const { page, context } = await open(hash, 1440, options)
    const bg = await page.locator('[data-skin="growth"]').first().evaluate((el) => getComputedStyle(el).backgroundColor)
    record(`${view} ${label}`, bg === 'rgb(14, 22, 32)', { note: bg })
    const navBg = await page.locator('nav a[aria-current="page"]').evaluate((el) => { const c = getComputedStyle(el).backgroundColor; const v = c.match(/-?[\d.]+/g).slice(0, 3).map(Number); return c.startsWith('color(') ? v.map((x) => Math.round(x * 255)) : v })
    record(`${view} ${label}: accent surfaces follow dark theme`, navBg.every((c) => c < 120), { note: navBg.join(',') })
    if (label === 'OS dark') {
      const issues = await page.evaluate(a11yLint)
      record(`${view} dark static a11y lint`, !issues.length, { note: issues.slice(0, 3).join('; ') })
      const violations = await axe(page)
      if (violations) record(`${view} dark axe`, !violations.length, { note: violations.join(', ') })
      await page.screenshot({ path: path.join(shots, `${view}-dark-1440.png`), fullPage: true, animations: 'disabled' })
    }
    await context.close()
  }
}

await browser.close(); server.close()
const failed = results.checks.filter((check) => !check.pass)
results.summary = { total: results.checks.length, passed: results.checks.length - failed.length, failed: failed.length }
writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
console.log(`\n${results.summary.passed}/${results.summary.total} passed`)
if (process.env.ORCALY_QA_EVIDENCE) {
  const target = path.resolve(root, process.env.ORCALY_QA_EVIDENCE)
  mkdirSync(target, { recursive: true })
  writeFileSync(path.join(target, 'GROWTH_VISUAL_QA.json'), JSON.stringify(results, null, 2))
  for (const name of ['home-390', 'home-1440', 'home-dark-1440', 'board-390', 'board-1440', 'board-focus-1440', 'detail-demo-free-shipping-390', 'detail-demo-free-shipping-1440', 'detail-demo-landing-cta-dark-1440', 'detail-demo-referral-1024', 'setup-filled-390', 'sources-768', 'empty-1024', 'learnings-1440']) {
    const source = path.join(shots, `${name}.png`)
    if (existsSync(source)) copyFileSync(source, path.join(target, `${name}.png`))
  }
}
process.exit(failed.length ? 1 : 0)
