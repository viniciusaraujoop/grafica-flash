/**
 * Orçaly Next — isolated visual/keyboard QA for components/orcaly-next/**.
 *
 * Renders the prototypes OUTSIDE Next.js (no route is added to the app): esbuild bundles
 * a small client entry with `next/link` shimmed to <a>, and Playwright drives it.
 * Output: .local-qa/orcaly-next/ (gitignored) + a JSON summary.
 *
 * Tooling is resolved from the environment so it adds no dependency to package.json:
 *   ORCALY_QA_ESBUILD=<path to esbuild package>   ORCALY_QA_PLAYWRIGHT=<path to playwright package>
 *   ORCALY_QA_NODE_PATH=<node_modules containing react + react-dom>
 *   ORCALY_QA_EVIDENCE=<dir>  optional: copy selected screenshots + JSON there.
 * Usage: node scripts/orcaly-next-visual-qa.mjs
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const need = (envName, fallback) => {
  const target = process.env[envName] || fallback
  if (!target) throw new Error(`Set ${envName}`)
  return require(target)
}
const esbuild = need('ORCALY_QA_ESBUILD')
const { chromium } = need('ORCALY_QA_PLAYWRIGHT')
const nodePath = process.env.ORCALY_QA_NODE_PATH || path.join(root, 'node_modules')
const out = path.join(root, '.local-qa', 'orcaly-next')
const shots = path.join(out, 'screenshots')
mkdirSync(shots, { recursive: true })

// ---------- build ----------
const entry = `
import { createRoot } from 'react-dom/client'
import Hub2Prototype from '@/components/orcaly-next/hub/Hub2Prototype'
import ProductLanding from '@/components/orcaly-next/product-landing/ProductLanding'
import { productRegistry, getRegistryProduct } from '@/lib/orcaly-next/product-registry'
import { getLandingContent } from '@/lib/orcaly-next/landing-content'
import { DEMO_LABEL, demoSnapshots, demoPulse, demoActivity, demoStatusGallery } from '@/lib/orcaly-next/demo-data'
const view = location.hash.slice(1) || 'hub'
const theme = view.endsWith('-dark') ? 'dark' : undefined
let node
if (view.startsWith('hub')) node = <Hub2Prototype registry={productRegistry} snapshots={demoSnapshots} pulse={demoPulse} activity={demoActivity} demoLabel={DEMO_LABEL} statusGallery={demoStatusGallery} theme={theme} />
else {
  const id = view.replace('landing-', '').replace('-dark', '')
  const product = getRegistryProduct(id)
  node = <ProductLanding product={product} content={getLandingContent(id)} primaryHref={product.landing.path} previewNote="Protótipo de landing fora de rota real. Capturas e preços são espaços reservados." theme={theme} />
}
createRoot(document.getElementById('root')).render(node)
`
const aliasPlugin = {
  name: 'orcaly-alias',
  setup(build) {
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'next-link-shim', namespace: 'shim' }))
    build.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
      contents: "import { forwardRef, createElement } from 'react'; export default forwardRef(function Link({ href, prefetch, replace, scroll, ...rest }, ref) { return createElement('a', { ...rest, href: String(href), ref }) })",
      loader: 'js', resolveDir: nodePath,
    }))
    build.onResolve({ filter: /^@\// }, async (args) => build.resolve(`./${args.path.slice(2)}`, { resolveDir: root, kind: args.kind }))
  },
}
await esbuild.build({
  stdin: { contents: entry, loader: 'tsx', resolveDir: root, sourcefile: 'harness.tsx' },
  bundle: true, outfile: path.join(out, 'bundle.js'), format: 'esm', jsx: 'automatic', target: 'es2022',
  loader: { '.module.css': 'local-css' }, nodePaths: [nodePath], plugins: [aliasPlugin], logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"production"' },
})
writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Orçaly Next QA</title><link rel="stylesheet" href="/bundle.css"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>')

// ---------- serve ----------
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  const full = path.join(out, file)
  if (['index.html', 'bundle.js', 'bundle.css'].includes(file) && existsSync(full)) {
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' })
    res.end(readFileSync(full)); return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><title>navigated</title><p id="navigated">${url.pathname}</p>`)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

// ---------- checks ----------
const widths = [320, 390, 768, 1024, 1440, 1920]
const results = { generatedAt: new Date().toISOString(), tool: 'playwright+esbuild (isolated harness, not Next runtime)', checks: [] }
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

/** In-page static a11y lint (Axe is not installed in this environment). */
const a11yLint = () => {
  const issues = []
  const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ') || el.textContent || '').trim()
  for (const el of document.querySelectorAll('a[href], button, [role=option], [role=combobox], input, [role=img], [role=dialog], dialog')) if (!name(el) && !(el.id && document.querySelector(`label[for="${el.id}"]`))) issues.push(`no name: ${el.outerHTML.slice(0, 80)}`)
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) issues.push(`duplicate id ${id}`)
  let last = 0
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) { const level = Number(h.tagName[1]); if (last && level > last + 1 && !h.closest('dialog,[role=dialog]')) issues.push(`heading jump h${last}→h${level}: ${h.textContent.slice(0, 40)}`); last = level }
  if (document.querySelectorAll('h1').length !== 1) issues.push(`h1 count ${document.querySelectorAll('h1').length}`)
  for (const el of document.querySelectorAll('[aria-controls]')) if (el.getAttribute('aria-expanded') === 'true' && !document.getElementById(el.getAttribute('aria-controls'))) issues.push('aria-controls target missing')
  return issues
}
const overflow = () => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth, offenders: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('dialog') }).slice(0, 5).map((el) => el.className || el.tagName) })
const smallTargets = () => [...document.querySelectorAll('button, [role=option], [data-status] a, a[class]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44) && el.closest('main,header,dialog,[role=dialog]') && !el.closest('p,li[class*="activity"],span') }).map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)

for (const view of ['hub', 'landing-wealth', 'landing-growth', 'landing-business']) {
  for (const width of widths) {
    const { page, context, errors } = await open(view, width)
    const o = await page.evaluate(overflow)
    record(`${view}@${width} no horizontal overflow`, o.scroll <= o.viewport && o.offenders.length === 0, { note: o.offenders.join(', ') || `${o.scroll}/${o.viewport}` })
    const small = await page.evaluate(smallTargets)
    record(`${view}@${width} touch targets ≥44px`, small.length === 0, { note: small.slice(0, 4).join('; ') })
    record(`${view}@${width} no runtime errors`, errors.length === 0, { note: errors.slice(0, 2).join(' | ') })
    if (width === 390 || width === 1440) {
      const issues = await page.evaluate(a11yLint)
      record(`${view}@${width} static a11y lint`, issues.length === 0, { note: issues.slice(0, 4).join('; ') })
    }
    await page.screenshot({ path: path.join(shots, `${view}-${width}.png`), fullPage: true, animations: 'disabled' })
    await context.close()
  }
}

// Demo honesty
{
  const { page, context } = await open('hub', 1440)
  const banner = await page.locator('[data-demo="true"]').count()
  record('hub shows demonstration banner', banner === 1)
  const gallery = await page.locator('[data-testid="status-gallery"] [data-status]').evaluateAll((els) => els.map((el) => el.getAttribute('data-status')))
  record('status gallery renders all 8 statuses', gallery.join() === 'ACTIVE,TRIAL,AVAILABLE,NOT_SUBSCRIBED,PAYMENT_PENDING,SUSPENDED,COMING_SOON,BLOCKED_EXTERNAL', { note: gallery.join() })
  const cards = await page.locator('article[data-status]').evaluateAll((els) => els.map((el) => `${el.querySelector('p').firstChild.textContent}:${el.dataset.status}:${el.querySelector('a').getAttribute('href')}`))
  record('hub cards route subscribed→app, unsubscribed→landing', cards.includes('Business:ACTIVE:/painel/inicio') && cards.includes('Wealth:TRIAL:/apps/wealth') && cards.includes('Partners:NOT_SUBSCRIBED:/parceiros') && cards.includes('Growth:COMING_SOON:/produtos/growth'), { note: cards.join(' ') })
  await context.close()
}

// Launcher keyboard, focus, escape, outside click, columns
for (const width of [390, 1024]) {
  const { page, context } = await open('hub', width)
  const trigger = page.locator('button[aria-haspopup="dialog"][aria-controls]')
  await trigger.focus(); await page.keyboard.press('Enter')
  const expanded = await trigger.getAttribute('aria-expanded')
  const tiles = page.locator('[role=dialog][aria-modal="false"] a[data-status]')
  const count = await tiles.count()
  const focusedFirst = await page.evaluate(() => document.activeElement?.getAttribute('href'))
  const firstHref = await tiles.nth(0).getAttribute('href')
  const columns = await page.locator('[role=dialog][aria-modal="false"] ul').evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(' ').length)
  record(`launcher@${width} opens with focus on first tile`, expanded === 'true' && focusedFirst === firstHref && count === 7, { note: `expanded=${expanded} focus=${focusedFirst} tiles=${count}` })
  await page.waitForTimeout(400)
  const panel = await page.locator('[role=dialog][aria-modal="false"]').evaluate((el) => { const st = getComputedStyle(el); return `${st.opacity}|${st.backgroundColor}` })
  record(`launcher@${width} panel opaque once settled`, panel === '1|rgb(255, 255, 255)', { note: panel })
  record(`launcher@${width} grid columns`, columns === (width < 768 ? 2 : 3), { note: `${columns}` })
  await page.keyboard.press('ArrowRight')
  const second = await page.evaluate(() => document.activeElement?.getAttribute('href'))
  await page.keyboard.press('ArrowDown')
  const down = await page.evaluate(() => [...document.querySelectorAll('[role=dialog][aria-modal="false"] a[data-status]')].indexOf(document.activeElement))
  await page.keyboard.press('End')
  const end = await page.evaluate(() => [...document.querySelectorAll('[role=dialog][aria-modal="false"] a[data-status]')].indexOf(document.activeElement))
  record(`launcher@${width} arrow/home/end navigation`, second === (await tiles.nth(1).getAttribute('href')) && down === 1 + columns && end === count - 1, { note: `down=${down} end=${end}` })
  await page.screenshot({ path: path.join(shots, `launcher-open-${width}.png`), animations: 'disabled' })
  await page.keyboard.press('Escape')
  const afterEsc = await page.evaluate(() => ({ expanded: document.querySelector('button[aria-controls][aria-haspopup="dialog"]').getAttribute('aria-expanded'), focusIsTrigger: document.activeElement === document.querySelector('button[aria-controls][aria-haspopup="dialog"]') }))
  record(`launcher@${width} Esc closes and restores focus`, afterEsc.expanded === 'false' && afterEsc.focusIsTrigger)
  await trigger.click(); await page.mouse.click(5, 880)
  record(`launcher@${width} outside click closes`, (await trigger.getAttribute('aria-expanded')) === 'false')
  await context.close()
}

// Command palette
for (const width of [390, 1440]) {
  const { page, context } = await open('hub', width)
  await page.keyboard.press('Control+k')
  const dialogOpen = await page.evaluate(() => document.querySelector('dialog')?.open === true)
  const inputFocused = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox')
  record(`palette@${width} Ctrl+K opens with input focused`, dialogOpen && inputFocused)
  await page.keyboard.type('calendario')
  const first = await page.locator('[role=option]').first().getAttribute('data-command')
  const active = await page.evaluate(() => document.activeElement?.getAttribute('aria-activedescendant'))
  const selected = await page.locator('[role=option][aria-selected="true"]').getAttribute('id')
  record(`palette@${width} accent-insensitive ranking + activedescendant`, first === 'nav.wealth.calendario' && active === selected, { note: `first=${first}` })
  await page.waitForTimeout(400)
  const surface = await page.locator('dialog').evaluate((el) => { const st = getComputedStyle(el); return `${st.opacity}|${st.backgroundColor}` })
  record(`palette@${width} dialog opaque once settled`, surface === '1|rgb(255, 255, 255)', { note: surface })
  await page.keyboard.press('Control+a'); await page.keyboard.type('pedidos')
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp')
  await page.screenshot({ path: path.join(shots, `palette-${width}.png`), animations: 'disabled' })
  const leak = await page.locator('[role=option]').evaluateAll((els) => els.map((el) => el.dataset.command))
  record(`palette@${width} never exposes routes of non-entitled products`, !leak.some((id) => id.startsWith('nav.partners.')), { note: leak.join(',') })
  await page.keyboard.press('Control+a'); await page.keyboard.type('zzzz')
  const empty = await page.locator('dialog').getByText('Nenhum resultado').count()
  const status = await page.locator('dialog [role=status]').textContent()
  record(`palette@${width} empty state + live count`, empty === 1 && status.startsWith('0 resultados'))
  await page.keyboard.press('Escape')
  // dialog.open flips synchronously; focus moves in the async `close` event, so wait for both.
  await page.waitForFunction(() => document.querySelector('dialog')?.open === false && document.activeElement?.getAttribute('aria-haspopup') === 'dialog', null, { timeout: 2000 }).catch(() => {})
  const closed = await page.evaluate(() => ({ open: document.querySelector('dialog').open, focus: document.activeElement?.getAttribute('aria-haspopup') }))
  record(`palette@${width} Esc closes and focus returns to trigger`, closed.open === false && closed.focus === 'dialog')
  await page.keyboard.press('Control+k')
  await page.waitForFunction(() => document.querySelector('dialog')?.open === true, null, { timeout: 2000 })
  await page.keyboard.type('calendario'); await page.keyboard.press('Enter')
  await page.waitForSelector('#navigated')
  record(`palette@${width} Enter navigates to the ranked route`, new URL(page.url()).pathname === '/apps/wealth/calendario', { note: page.url() })
  await context.close()
}

// Reduced motion + dark mode
{
  const { page, context } = await open('hub', 1024, { reducedMotion: 'reduce' })
  await page.locator('button[aria-controls][aria-haspopup="dialog"]').click()
  const duration = await page.locator('[role=dialog][aria-modal="false"]').evaluate((el) => getComputedStyle(el).animationDuration)
  record('reduced motion collapses launcher animation', parseFloat(duration) < 0.001, { note: duration })
  await context.close()
}
for (const view of ['hub', 'landing-wealth']) {
  const { page, context } = await open(view, 1440, { colorScheme: 'dark' })
  const bg = await page.locator('[data-theme], [class*="root"]').first().evaluate((el) => getComputedStyle(el).backgroundColor)
  record(`${view} follows OS dark mode`, bg === 'rgb(14, 22, 32)', { note: bg })
  await page.screenshot({ path: path.join(shots, `${view}-dark-1440.png`), fullPage: true, animations: 'disabled' })
  await context.close()
}

await browser.close(); server.close()
const failed = results.checks.filter((check) => !check.pass)
results.summary = { total: results.checks.length, passed: results.checks.length - failed.length, failed: failed.length }
writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
console.log(`\n${results.summary.passed}/${results.summary.total} passed`)
if (process.env.ORCALY_QA_EVIDENCE) {
  const target = path.resolve(root, process.env.ORCALY_QA_EVIDENCE)
  mkdirSync(target, { recursive: true })
  writeFileSync(path.join(target, 'ORCALY_NEXT_VISUAL_QA.json'), JSON.stringify(results, null, 2))
  for (const name of ['hub-320', 'hub-768', 'hub-1440', 'hub-dark-1440', 'launcher-open-390', 'launcher-open-1024', 'palette-390', 'palette-1440', 'landing-wealth-390', 'landing-wealth-1440', 'landing-growth-1024', 'landing-business-1920']) {
    const source = path.join(shots, `${name}.png`)
    if (existsSync(source)) copyFileSync(source, path.join(target, `${name}.png`))
  }
}
process.exit(failed.length ? 1 : 0)
