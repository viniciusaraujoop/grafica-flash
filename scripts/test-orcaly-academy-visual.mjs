/**
 * Orçaly Academy — isolated visual / keyboard / a11y QA for components/orcaly-next/academy/**.
 * Same approach as the Foundation/Growth harnesses: esbuild bundles a client entry outside
 * Next.js (next/link shimmed), Playwright drives it. No route is added to the app.
 *
 *   ORCALY_QA_ESBUILD=<esbuild pkg> ORCALY_QA_PLAYWRIGHT=<playwright pkg> ORCALY_QA_NODE_PATH=<node_modules with react>
 *   [ORCALY_QA_AXE=<axe-core pkg>]  [ORCALY_QA_EVIDENCE=<dir>]  node scripts/test-orcaly-academy-visual.mjs
 *
 * Axe: runs only when ORCALY_QA_AXE points to axe-core. Otherwise every axe check is recorded
 * as NOT_RUN (never as PASS) and the static a11y lint below is the only automated a11y signal.
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
const out = path.join(root, '.local-qa', 'orcaly-academy')
const shots = path.join(out, 'screenshots')
mkdirSync(shots, { recursive: true })

const entry = `
import { createRoot } from 'react-dom/client'
import AcademyHome from '@/components/orcaly-next/academy/AcademyHome'
import { AcademyLibraryPage, AcademyTrackPage, AcademyReadPage, AcademyNotesPage, AcademyBookmarksPage } from '@/components/orcaly-next/academy/AcademyPages'
import { ACADEMY_DEMO_LABEL, ACADEMY_DEMO_NOW, demoState, emptyState } from '@/lib/orcaly-next/academy/demo-data'
const [view, mode] = location.hash.slice(1).split(':')
const theme = mode === 'dark' ? 'dark' : undefined
const demo = { state: demoState, now: ACADEMY_DEMO_NOW, demoLabel: ACADEMY_DEMO_LABEL, theme }
const empty = { state: emptyState, now: ACADEMY_DEMO_NOW, theme }
let node
if (view === 'home') node = <AcademyHome {...demo} />
else if (view === 'empty') node = <AcademyHome {...empty} />
else if (view === 'library') node = <AcademyLibraryPage {...demo} />
else if (view === 'library-empty') node = <AcademyLibraryPage {...empty} />
else if (view === 'search') node = <AcademyLibraryPage {...demo} initialQuery="SENHA" />
else if (view === 'noresults') node = <AcademyLibraryPage {...demo} initialQuery="astronomia quântica" />
else if (view === 'notes') node = <AcademyNotesPage {...demo} />
else if (view === 'notes-empty') node = <AcademyNotesPage {...empty} />
else if (view === 'bookmarks') node = <AcademyBookmarksPage {...demo} />
else if (view === 'bookmarks-empty') node = <AcademyBookmarksPage {...empty} />
else if (view.startsWith('track-')) node = <AcademyTrackPage trackId={view.slice(6)} {...demo} />
else if (view.startsWith('read-')) { const [contentId, trackId] = view.slice(5).split('--'); node = <AcademyReadPage contentId={contentId} trackId={trackId} {...demo} /> }
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
await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root, sourcefile: 'academy-harness.tsx' }, bundle: true, outfile: path.join(out, 'bundle.js'), format: 'esm', jsx: 'automatic', target: 'es2022', loader: { '.module.css': 'local-css' }, nodePaths: [nodePath], plugins: [aliasPlugin], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' } })
writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Orçaly Academy QA</title><link rel="stylesheet" href="/bundle.css"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>')

const server = createServer((req, res) => {
  const file = new URL(req.url, 'http://x').pathname.slice(1) || 'index.html'
  if (['index.html', 'bundle.js', 'bundle.css'].includes(file)) { res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }); res.end(readFileSync(path.join(out, file))); return }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>navigated</title><p id="navigated">ok</p>')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const widths = [320, 390, 768, 1024, 1440, 1920]
const results = { generatedAt: new Date().toISOString(), tool: `playwright+esbuild isolated harness${axeSource ? ' + axe-core' : ' (axe-core unavailable: axe checks NOT_RUN; static a11y lint only)'}`, axe: axeSource ? 'RUN' : 'NOT_RUN', checks: [] }
const record = (name, pass, detail = {}) => { results.checks.push({ name, pass, ...detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail.note ? ` — ${detail.note}` : ''}`) }
const notRun = (name, note) => { results.checks.push({ name, pass: null, status: 'NOT_RUN', note }); console.log(`NOT_RUN ${name} — ${note}`) }
const browser = await chromium.launch()

async function open(view, width, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: options.reducedMotion ?? 'no-preference', colorScheme: options.colorScheme ?? 'light' })
  const page = await context.newPage()
  // Academy must not depend on browser storage: count every write attempt.
  await page.addInitScript(() => { window.__storageWrites = 0; const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (...args) { window.__storageWrites += 1; return orig.apply(this, args) } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${base}/#${view}`)
  await page.waitForSelector('main')
  return { page, context, errors }
}

const overflow = () => {
  const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true } return false }
  return { scroll: document.documentElement.scrollWidth, viewport: window.innerWidth, offenders: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !clipped(el) && !el.closest('[class*="srOnly"]') && !el.matches('[class*="skip"]') }).slice(0, 5).map((el) => `${el.tagName}.${el.className}`) }
}
const smallTargets = () => [...document.querySelectorAll('button, input, select, textarea, summary, nav a, [class*="backLink"], [class*="sectionLink"], [class*="externalLink"], .button, a[class*="button"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44) }).map((el) => `${el.tagName}.${el.className || el.name} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
const a11yLint = () => {
  const issues = []
  const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ') || el.textContent || '').trim()
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role=img]')) if (!name(el) && !(el.id && document.querySelector(`label[for="${el.id}"]`))) issues.push(`no name: ${el.outerHTML.slice(0, 80)}`)
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) issues.push(`duplicate id ${id}`)
  let last = 0
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) { const level = Number(h.tagName[1]); if (last && level > last + 1) issues.push(`heading jump h${last}→h${level}: ${h.textContent.slice(0, 40)}`); last = level }
  if (document.querySelectorAll('h1').length !== 1) issues.push(`h1 count ${document.querySelectorAll('h1').length}`)
  for (const attr of ['aria-describedby', 'aria-labelledby']) for (const el of document.querySelectorAll(`[${attr}]`)) for (const id of el.getAttribute(attr).split(' ').filter(Boolean)) if (!document.getElementById(id)) issues.push(`${attr} missing ${id}`)
  for (const a of document.querySelectorAll('a[href^="#"]')) { const id = decodeURIComponent(a.getAttribute('href').slice(1)); if (id && !document.getElementById(id)) issues.push(`in-page link to missing #${id}`) }
  if (!document.querySelector('main')) issues.push('no main landmark')
  if (!document.querySelector('nav[aria-label]')) issues.push('no labelled nav')
  // Progress honesty: UNKNOWN/N/A progress must never read as a percentage.
  for (const el of document.querySelectorAll('[data-progress="UNKNOWN"], [data-progress="NOT_APPLICABLE"]')) if (/\d+\s*%/.test(el.textContent)) issues.push(`unknown progress rendered as %: ${el.textContent.slice(0, 50)}`)
  return issues
}
async function axe(page, label) {
  if (!axeSource) { notRun(`${label} axe WCAG 2.2 AA`, 'axe-core not installable here (registry blocked)'); return }
  await page.addScriptTag({ content: axeSource })
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => `${v.id}(${v.nodes.length})`))
  record(`${label} axe WCAG 2.2 AA`, !violations.length, { note: violations.join(', ') })
}

const views = [
  'home', 'empty', 'library', 'library-empty', 'search', 'noresults',
  'track-experimentos-fundamentos', 'track-seguranca-digital',
  'read-boa-hipotese--experimentos-fundamentos', 'read-reserva-emergencia--financas-pessoais', 'read-checklist-seguranca',
  'read-metricas-basicas', 'read-rotina-operacional', 'read-manual-indicadores', 'read-apostila-sem-origem', 'read-guia-externo-golpes',
  'notes', 'notes-empty', 'bookmarks', 'bookmarks-empty',
]
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
      await axe(page, `${view}@${width}`)
    }
    await page.screenshot({ path: path.join(shots, `${view}-${width}.png`), fullPage: true, animations: 'disabled' })
    await context.close()
  }
}

// ── Home: order, honesty, rules, demo labels ─────────────────────────────────────────────
{
  const { page, context } = await open('home', 1440)
  record('home shows DEMO / SAMPLE DATA banner', (await page.locator('[data-demo="true"]').textContent()).includes('DEMO / SAMPLE DATA'))
  const h2 = (await page.locator('main h2').allInnerTexts()).join('|')
  record('home sections in required order', h2 === 'Continuar|Trilhas em andamento|Biblioteca|Notas recentes|Descobrir', { note: h2 })
  const text = await page.locator('main').innerText()
  record('home has no vanity metrics', !/\d+\s*(h|horas?)\s*(estudad|de estudo)|\d+\s*%\s*(de\s*)?produtividade|produtividade\s*:\s*\d|streak|sequência de \d+ dias|ranking|posição no ranking/i.test(text))
  const rules = await page.locator('[data-testid="continue-learning"] [data-rule]').evaluateAll((els) => els.map((el) => el.dataset.rule))
  record('continue list: rule-based order with visible rule ids', rules.join(',') === 'CONTINUE_IN_PROGRESS,CONTINUE_IN_PROGRESS,RESUME_BOOKMARK' && (await page.locator('[data-testid="continue-learning"] code').count()) >= 3, { note: rules.join(',') })
  record('continue: first is most recent in-progress (boa hipótese)', (await page.locator('[data-testid="continue-learning"] li').first().innerText()).includes('boa hipótese'))
  record('continue: almost-finished rule surfaced with id', (await page.locator('[data-rule-extra="COMPLETE_ALMOST_FINISHED"]').count()) === 1)
  record('continue: unknown lesson progress is not a percentage', (await page.locator('[data-testid="continue-learning"] li').nth(1).innerText()).includes('Progresso desconhecido'))
  const samples = await page.locator('[data-sample="true"]').count()
  const labelled = await page.locator('[data-sample="true"] span:text-is("Exemplo")').count()
  record('home: every demo note labelled "Exemplo"', samples === 3 && labelled === samples, { note: `${labelled}/${samples}` })
  record('home: REVIEW_NOTE suggestion shows rule', (await page.locator('[data-rule="REVIEW_NOTE"] code').count()) === 1)
  await context.close()
}
{
  const { page, context } = await open('empty', 1024)
  record('empty home: empty states, no demo banner', (await page.locator('[data-state="empty"]').count()) >= 4 && (await page.locator('[data-demo="true"]').count()) === 0)
  await context.close()
}

// ── Library: states, filters, search ────────────────────────────────────────────────────
{
  const { page, context } = await open('library', 1440)
  const cards = page.locator('[data-testid="library-results"] > li')
  record('library lists every non-draft item (13)', (await cards.count()) === 13, { note: String(await cards.count()) })
  const avail = await page.locator('[data-testid="library-results"] [data-availability]').evaluateAll((els) => [...new Set(els.map((el) => el.dataset.availability))].sort().join(','))
  record('library shows all availability states as text', avail === 'AVAILABLE,BLOCKED_LICENSE,COMING_SOON,EXTERNAL_ONLY,UNAVAILABLE', { note: avail })
  await page.getByLabel('Disponibilidade').selectOption('BLOCKED_LICENSE')
  record('filter: blocked by license → 2 items', (await cards.count()) === 2, { note: String(await cards.count()) })
  record('library: blocked item with old completion is not labelled "Concluído"', !(await page.locator('[data-testid="library-results"]').innerText()).includes('\nConcluído') && (await page.getByText('Conclusão anterior · não conta').count()) === 1)
  await page.getByLabel('Tipo').selectOption('VIDEO')
  record('filters combine with AND → no results state', (await page.locator('[data-state="empty"]').count()) === 1)
  await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
  record('reset restores full list', (await cards.count()) === 13)
  await page.getByLabel('Ordenar por').selectOption('duration')
  const last = await cards.last().innerText()
  record('sort by duration puts unknown durations last (never as zero)', last.includes('Duração não informada'), { note: last.split('\n').slice(0, 2).join(' / ') })
  await page.getByLabel('Ordenar por').selectOption('title')
  const search = page.getByRole('searchbox', { name: 'Buscar na biblioteca' })
  await search.fill('orcamento')
  record('search is accent-insensitive (orcamento → Orçamento)', (await cards.first().innerText()).includes('orçamento mensal'))
  record('search announces result count', /\d+ resultados?/.test(await page.locator('form[role="search"] [role="status"]').innerText()))
  record('library interactions do not write browser storage', (await page.evaluate(() => window.__storageWrites)) === 0)
  await context.close()
}
{
  const { page, context } = await open('search', 1024)
  const first = await page.locator('[data-testid="library-results"] > li').first().innerText()
  record('search "SENHA": case-insensitive, most relevant first', first.includes('Senhas e verificação'), { note: first.split('\n')[1] })
  record('search results include a track', (await page.locator('[data-result-kind="TRACK"]').count()) >= 1)
  await context.close()
}
{
  const { page, context } = await open('noresults', 390)
  record('no results: explicit empty state with recovery action', (await page.locator('[data-state="empty"]').innerText()).includes('Nenhum resultado'))
  await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
  record('no results: recovery restores library', (await page.locator('[data-testid="library-results"] > li').count()) === 13)
  await context.close()
}

// ── Tracks ──────────────────────────────────────────────────────────────────────────────
{
  const { page, context } = await open('track-experimentos-fundamentos', 1440)
  record('track: blocked required item does not count', (await page.locator('[data-availability="BLOCKED_LICENSE"][data-countable="false"]').count()) === 1)
  record('track: blocked item explained in text', (await page.locator('[data-excluded="1"]').count()) === 1)
  record('track: not complete while a required item is blocked', (await page.locator('[data-track-complete="false"]').count()) === 1)
  record('track: locked item has no link and names its prerequisite', (await page.locator('[data-locked="true"] h3 a').count()) === 0 && (await page.locator('[data-locked="true"]').innerText()).includes('Desbloqueia após concluir'))
  const order = await page.locator('[data-testid="track-items"] h3').allInnerTexts()
  record('track: items in declared order', order[0].startsWith('O que é uma boa hipótese') && order[3].startsWith('Manual de indicadores'), { note: order.map((t) => t.slice(0, 18)).join(' | ') })
  record('track: next unit highlighted', (await page.getByText('Próxima unidade', { exact: true }).count()) === 1)
  await context.close()
}
{
  const { page, context } = await open('track-seguranca-digital', 1024)
  record('track (not enrolled): honest not-configured enrollment', (await page.locator('[data-state="not-configured"]').count()) === 1)
  await context.close()
}

// ── Reader ──────────────────────────────────────────────────────────────────────────────
{
  const { page, context } = await open('read-boa-hipotese--experimentos-fundamentos', 1440)
  const fonts = await page.evaluate(() => ({ body: getComputedStyle(document.querySelector('[data-testid="reader-content"] p')).fontFamily, nav: getComputedStyle(document.querySelector('nav a')).fontFamily, root: getComputedStyle(document.querySelector('[data-skin="academy"]')).fontFamily }))
  record('reader: serif only inside reader content', /Georgia/.test(fonts.body) && !/Georgia/.test(fonts.nav) && !/Georgia/.test(fonts.root), { note: `${fonts.body.slice(0, 20)} / ${fonts.nav.slice(0, 20)}` })
  record('reader: opening does not complete (status stays "Em andamento")', (await page.locator('[data-testid="reader-article"]').innerText()).includes('Em andamento') && (await page.getByRole('button', { name: 'Marcar como concluído' }).isDisabled()))
  record('reader: disabled completion looks disabled', Number(await page.getByRole('button', { name: 'Marcar como concluído' }).evaluate((el) => getComputedStyle(el).opacity)) < 0.7)
  record('reader: completion disabled reason is stated', (await page.locator('[data-testid="completion"]').innerText()).includes('abaixo do limiar'))
  record('reader: source and license visible', (await page.getByRole('heading', { name: 'Fonte e licença' }).count()) === 1 && (await page.locator('[data-license="ORIGINAL"]').count()) >= 1)
  record('reader: back to track link', (await page.getByRole('link', { name: /Voltar à trilha/ }).count()) === 1)
  record('reader: existing section bookmark shows pressed', (await page.getByRole('button', { name: /Seção favoritada: Limites honestos/ }).getAttribute('aria-pressed')) === 'true')
  // Typography controls (bounded)
  await page.locator('[data-testid="reading-controls"] summary').click()
  const plus = page.getByRole('button', { name: 'Aumentar texto' })
  for (let i = 0; i < 6; i += 1) if (!(await plus.isDisabled())) await plus.click()
  const maxSize = await page.locator('[data-testid="reader-content"] p').first().evaluate((el) => getComputedStyle(el).fontSize)
  record('reader: font size clamps at 24px and A+ disables', maxSize === '24px' && (await plus.isDisabled()), { note: maxSize })
  const minus = page.getByRole('button', { name: 'Diminuir texto' })
  for (let i = 0; i < 8; i += 1) if (!(await minus.isDisabled())) await minus.click()
  const minSize = await page.locator('[data-testid="reader-content"] p').first().evaluate((el) => getComputedStyle(el).fontSize)
  record('reader: font size clamps at 14px and A− disables', minSize === '14px' && (await minus.isDisabled()), { note: minSize })
  await page.getByLabel('Entrelinha').selectOption('20')
  const lh = await page.locator('[data-testid="reader-content"] p').first().evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize))
  record('reader: line-height 2,0 applied', Math.abs(lh - 2) < 0.01, { note: lh.toFixed(2) })
  await page.getByLabel('Largura da coluna').selectOption('narrow')
  const colWidth = await page.locator('[data-testid="reader-article"]').evaluate((el) => el.getBoundingClientRect().width / parseFloat(getComputedStyle(document.querySelector('[data-testid="reader-content"]')).fontSize))
  record('reader: narrow column ≈ 58ch', colWidth < 62, { note: colWidth.toFixed(1) })
  await page.getByLabel('Tema da leitura').selectOption('dark')
  const readerBg = await page.locator('[data-reader-theme="dark"] [data-theme="dark"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  record('reader: reading theme dark scoped to reader', readerBg === 'rgb(14, 22, 32)' && (await page.locator('[data-skin="academy"]').first().getAttribute('data-theme')) === null, { note: readerBg })
  await page.getByLabel('Tema da leitura').selectOption('inherit')
  record('reader: controls are inline (never cover content)', await page.locator('[data-testid="reading-controls"]').evaluate((el) => !['fixed', 'sticky'].includes(getComputedStyle(el).position)))
  // Explicit progress and completion
  await page.getByRole('button', { name: /Registrar leitura até aqui: Limites honestos/ }).click()
  record('reader: registering reading updates measured progress', (await page.locator('[data-testid="reader-article"] [data-progress="KNOWN"]').first().innerText()).includes('100%'))
  const done = page.getByRole('button', { name: 'Marcar como concluído' })
  record('reader: still not completed after reaching 100% (explicit action required)', (await page.locator('[data-testid="reader-article"]').innerText()).includes('Em andamento') && !(await done.isDisabled()))
  await done.click()
  record('reader: explicit completion records evidence', (await page.locator('[data-testid="completion"]').innerText()).includes('Concluído em 27/09/2026'))
  // Notes: compose from section, plain text, no text in URL
  await page.getByRole('button', { name: /Anotar nesta seção: Critério antes dos dados/ }).click()
  const focusTag = await page.evaluate(() => document.activeElement?.tagName)
  record('notes: "Anotar nesta seção" focuses the editor', focusTag === 'TEXTAREA', { note: focusTag })
  record('notes: editor preselects the section', (await page.getByLabel('Onde').inputValue()) === 'criterio')
  await page.getByRole('button', { name: 'Salvar nota' }).click()
  record('notes: empty note rejected with announced error', (await page.locator('[data-testid="notes-panel"] [role="alert"]').count()) === 1 && (await page.locator('[data-testid="notes-panel"] textarea[aria-invalid="true"]').count()) === 1)
  const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script> minha nota'
  await page.getByLabel('Sua nota').fill(payload)
  await page.getByRole('button', { name: 'Salvar nota' }).click()
  const own = page.locator('[data-testid="notes-panel"] li[data-sample="false"]')
  record('notes: HTML stays literal text (no element, no script run)', (await own.count()) === 1 && (await own.locator('p').last().innerText()).includes('<script>') && (await own.locator('img, script').count()) === 0 && (await page.evaluate(() => window.__xss)) === undefined)
  record('notes: note text never enters the URL', !decodeURIComponent(page.url()).includes('minha nota'))
  record('notes: own note shows "Privada", demo note "Exemplo" and is read-only', (await own.innerText()).includes('Privada') && (await page.locator('[data-testid="notes-panel"] li[data-sample="true"]').innerText()).includes('Exemplo') && (await page.locator('[data-testid="notes-panel"] li[data-sample="true"] button').count()) === 0)
  await own.getByRole('button', { name: /Editar nota/ }).click()
  await own.getByLabel('Editar sua nota').fill('nota editada')
  await own.getByRole('button', { name: 'Salvar alterações' }).click()
  record('notes: edit saves (CAS version from edit start)', (await own.innerText()).includes('nota editada'))
  // Bookmarks: toggle is idempotent and independent of progress/notes
  const favContent = page.getByRole('button', { name: /Favoritar conteúdo|Nos seus favoritos/ })
  await favContent.click()
  record('bookmark: content favourited (aria-pressed)', (await favContent.getAttribute('aria-pressed')) === 'true')
  const before = await page.locator('[data-testid="bookmarks-panel"] li').count()
  await favContent.click()
  record('bookmark: removing keeps progress and notes', (await page.locator('[data-testid="bookmarks-panel"] li').count()) === before - 1 && (await page.locator('[data-testid="completion"]').innerText()).includes('Concluído em') && (await own.count()) === 1)
  record('reader: no browser storage writes', (await page.evaluate(() => window.__storageWrites)) === 0)
  await page.screenshot({ path: path.join(shots, 'reader-interacted-1440.png'), fullPage: true, animations: 'disabled' })
  await context.close()
}
for (const width of [390, 1440]) {
  const { page, context } = await open('read-boa-hipotese--experimentos-fundamentos', width)
  const layout = await page.evaluate(() => { const a = document.querySelector('[data-testid="reader-article"]').getBoundingClientRect(); const s = document.querySelector('aside#leitura-notas').getBoundingClientRect(); return { aTop: a.top, aBottom: a.bottom, aRight: a.right, sTop: s.top, sLeft: s.left, sticky: getComputedStyle(document.querySelector('aside#leitura-notas')).position } })
  if (width < 1024) record(`reader@${width}: notes stacked below the article`, layout.sTop >= layout.aBottom, { note: JSON.stringify(layout) })
  else record(`reader@${width}: notes as side panel (sticky)`, layout.sLeft >= layout.aRight && layout.sticky === 'sticky', { note: JSON.stringify(layout) })
  const measure = await page.locator('[data-testid="reader-content"] p').first().evaluate((el) => el.getBoundingClientRect().width / parseFloat(getComputedStyle(el).fontSize))
  record(`reader@${width}: comfortable measure (≤ 40em)`, measure <= 40, { note: `${measure.toFixed(1)}em` })
  await context.close()
}
{
  const { page, context } = await open('read-reserva-emergencia--financas-pessoais', 1024)
  const text = await page.locator('[data-testid="reader-article"]').innerText()
  record('lesson: manual lesson progress reads "Não se aplica", never 0%', text.includes('Não se aplica') && !/Leitura:\s*0%/.test(text))
  record('lesson: position in track shown', (await page.getByRole('navigation', { name: 'Navegação da trilha' }).innerText()).includes('Item 2 de 2'))
  record('lesson: manual completion available', !(await page.getByRole('button', { name: 'Marcar como concluído' }).isDisabled()))
  record('lesson: resume link to saved section', (await page.getByRole('link', { name: /Retomar em “Uma primeira meta alcançável”/ }).count()) === 1)
  await context.close()
}
{
  const { page, context } = await open('read-checklist-seguranca', 1024)
  await page.getByRole('button', { name: /Retomar daqui depois: Página 3/ }).click()
  record('document: resume position saved by page', (await page.getByRole('link', { name: /Retomar em “Página 3/ }).count()) === 1)
  await context.close()
}
for (const [view, state, expectAvail] of [['read-metricas-basicas', 'AVAILABLE_METADATA_ONLY', 'AVAILABLE'], ['read-rotina-operacional', 'NOT_CONFIGURED', 'COMING_SOON']]) {
  const { page, context } = await open(view, 1024)
  record(`${view}: media placeholder ${state}`, (await page.locator(`[data-media-state="${state}"]`).count()) === 1 && (await page.locator(`[data-testid="reader-article"][data-availability="${expectAvail}"]`).count()) === 1)
  record(`${view}: no player, no autoplay, no external embed`, (await page.locator('video, audio, iframe, [autoplay]').count()) === 0)
  record(`${view}: completion disabled (playback not measured)`, await page.getByRole('button', { name: 'Marcar como concluído' }).isDisabled())
  const text = await page.locator('main').innerText()
  if (view === 'read-rotina-operacional') record('audio: unknown author and duration stated, not invented', text.includes('Autoria não informada') && text.includes('Duração não informada'))
  else record('video: transcript/caption status stated', text.includes('Transcrição') && text.includes('Legendas') && text.includes('10 min'))
  await context.close()
}
for (const [view, license] of [['read-manual-indicadores', 'LICENSED'], ['read-apostila-sem-origem', 'UNKNOWN']]) {
  const { page, context } = await open(view, 1024)
  record(`${view}: no reading progress shown for unreadable content`, (await page.locator('[data-testid="reader-article"] [data-progress]').count()) === 0)
  record(`${view}: blocked by license, no body rendered`, (await page.locator('[data-availability="BLOCKED_LICENSE"] [data-state="forbidden"]').count()) === 1 && (await page.locator('[data-testid="reader-content"]').count()) === 0)
  record(`${view}: license ${license} shown as not permitting full content`, (await page.locator(`[data-license="${license}"]`).first().innerText()).includes('Licença'))
  if (view === 'read-manual-indicadores') {
    const text = await page.locator('[data-testid="completion"]').innerText()
    record(`${view}: stale completion shown as not counting (never "Concluído em")`, (await page.locator('[data-stale-completion="true"]').count()) === 1 && !/Concluído em/.test(text) && (await page.getByRole('button', { name: 'Marcar como concluído' }).count()) === 0, { note: text.slice(0, 80) })
  } else record(`${view}: cannot be completed`, await page.getByRole('button', { name: 'Marcar como concluído' }).isDisabled())
  await context.close()
}
{
  const { page, context } = await open('read-guia-externo-golpes', 1024)
  const link = page.locator('[data-availability="EXTERNAL_ONLY"] a[target="_blank"]')
  const rel = await link.getAttribute('rel'); const href = await link.getAttribute('href')
  record('external: safe outbound link (https, noopener noreferrer, new tab announced)', href.startsWith('https://') && rel.includes('noopener') && rel.includes('noreferrer') && (await link.textContent()).includes('abre em nova aba'), { note: `${href} ${rel}` })
  record('external: content not reproduced', (await page.locator('[data-testid="reader-content"]').count()) === 0)
  await context.close()
}

// ── Notes & bookmarks pages ─────────────────────────────────────────────────────────────
{
  const { page, context } = await open('notes', 1024)
  const ids = await page.locator('[data-testid="notes-panel"] li[id^="nota-"]').evaluateAll((els) => els.map((el) => el.id))
  record('notes page: all demo notes, anchored by id only', ids.length === 3 && ids.every((id) => /^nota-[a-z0-9-]+$/.test(id)), { note: ids.join(',') })
  const hrefs = await page.locator('[data-testid="notes-panel"] a').evaluateAll((els) => els.map((el) => el.getAttribute('href')))
  record('notes page: links carry no note text', hrefs.every((h) => !/exemplo|nota:/i.test(h)), { note: hrefs.join(' ') })
  await context.close()
}
{
  const { page, context } = await open('bookmarks', 390)
  const items = page.locator('[data-testid="bookmarks-panel"] li')
  const n = await items.count()
  await page.getByRole('button', { name: /Remover favorito/ }).first().click()
  record('bookmarks: remove updates list and reassures about progress/notes', (await items.count()) === n - 1 && (await page.locator('main [role="status"]').first().innerText()).includes('progresso'))
  await context.close()
}

// ── Keyboard, focus, skip link ──────────────────────────────────────────────────────────
for (const view of ['home', 'read-boa-hipotese--experimentos-fundamentos']) {
  const { page, context } = await open(view, 1024)
  await page.keyboard.press('Tab')
  const skip = await page.evaluate(() => ({ text: document.activeElement?.textContent, top: document.activeElement?.getBoundingClientRect().top }))
  record(`${view}: first Tab reaches visible skip link`, skip.text === 'Pular para o conteúdo' && skip.top >= 0, { note: JSON.stringify(skip) })
  await page.keyboard.press('Enter')
  record(`${view}: skip link moves focus to main`, (await page.evaluate(() => document.activeElement?.id)) === 'academy-content')
  await page.keyboard.press('Tab')
  // Card links draw the ring on the card (":focus-within"), everything else on itself.
  const ring = await page.evaluate(() => { const el = document.activeElement; const own = getComputedStyle(el).boxShadow; if (own !== 'none') return own; const holder = el.closest('[class*="continueItem"], [class*="card"]'); return holder ? getComputedStyle(holder).boxShadow : 'none' })
  record(`${view}: focused element shows focus ring`, ring !== 'none', { note: ring.slice(0, 40) })
  await context.close()
}
{
  const { page, context } = await open('library', 390)
  await page.locator('nav a').last().focus()
  const reached = new Set()
  for (let i = 0; i < 60; i += 1) { await page.keyboard.press('Tab'); const href = await page.evaluate(() => document.activeElement?.closest('[data-testid="library-results"]') ? document.activeElement.getAttribute('href') : null); if (href) reached.add(href) }
  record('library@390: every card reachable by keyboard', reached.size === 13, { note: `${reached.size}/13` })
  await context.close()
}

// ── Reduced motion, reflow, dark ────────────────────────────────────────────────────────
{
  const { page, context } = await open('home', 1024, { reducedMotion: 'reduce' })
  const duration = await page.locator('[class*="progressFill"]').first().evaluate((el) => getComputedStyle(el).transitionDuration)
  record('reduced motion collapses progress transitions', parseFloat(duration) < 0.001, { note: duration })
  await context.close()
}
{
  // 400% zoom on a 1280px screen ≈ 320 CSS px; with the largest reader font.
  const { page, context } = await open('read-boa-hipotese--experimentos-fundamentos', 320)
  await page.locator('[data-testid="reading-controls"] summary').click()
  const plus = page.getByRole('button', { name: 'Aumentar texto' })
  for (let i = 0; i < 6; i += 1) if (!(await plus.isDisabled())) await plus.click()
  const o = await page.evaluate(overflow)
  record('reflow: 320px with 24px reader text has no horizontal scroll', o.scroll <= o.viewport && !o.offenders.length, { note: o.offenders.join(', ') || `${o.scroll}/${o.viewport}` })
  await page.screenshot({ path: path.join(shots, 'reflow-320-font24.png'), fullPage: true, animations: 'disabled' })
  await context.close()
}
for (const view of ['home', 'library', 'track-experimentos-fundamentos', 'read-boa-hipotese--experimentos-fundamentos', 'notes']) {
  for (const [label, options, hash] of [['OS dark', { colorScheme: 'dark' }, view], ['forced dark', {}, `${view}:dark`]]) {
    const { page, context } = await open(hash, 1440, options)
    const bg = await page.locator('[data-skin="academy"]').first().evaluate((el) => getComputedStyle(el).backgroundColor)
    record(`${view} ${label}`, bg === 'rgb(14, 22, 32)', { note: bg })
    const navBg = await page.locator('nav[aria-label="Academy"] a[aria-current="page"]').count()
      ? await page.locator('nav[aria-label="Academy"] a[aria-current="page"]').evaluate((el) => { const c = getComputedStyle(el).backgroundColor; const v = c.match(/-?[\d.]+/g).slice(0, 3).map(Number); return c.startsWith('color(') ? v.map((x) => Math.round(x * 255)) : v })
      : [0, 0, 0]
    record(`${view} ${label}: accent surfaces follow dark theme`, navBg.every((c) => c < 120), { note: navBg.join(',') })
    if (label === 'OS dark') {
      const issues = await page.evaluate(a11yLint)
      record(`${view} dark static a11y lint`, !issues.length, { note: issues.slice(0, 3).join('; ') })
      await axe(page, `${view} dark`)
      await page.screenshot({ path: path.join(shots, `${view}-dark-1440.png`), fullPage: true, animations: 'disabled' })
    }
    await context.close()
  }
}

await browser.close(); server.close()
const failed = results.checks.filter((check) => check.pass === false)
const skipped = results.checks.filter((check) => check.status === 'NOT_RUN')
results.summary = { total: results.checks.length, passed: results.checks.filter((c) => c.pass === true).length, failed: failed.length, notRun: skipped.length }
writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
console.log(`\n${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.notRun} not run (of ${results.summary.total})`)
if (process.env.ORCALY_QA_EVIDENCE) {
  const target = path.resolve(root, process.env.ORCALY_QA_EVIDENCE)
  mkdirSync(target, { recursive: true })
  writeFileSync(path.join(target, 'ACADEMY_VISUAL_QA.json'), JSON.stringify(results, null, 2))
  for (const name of ['home-390', 'home-1440', 'home-dark-1440', 'empty-1024', 'library-390', 'library-1440', 'search-1024', 'noresults-390', 'track-experimentos-fundamentos-390', 'track-experimentos-fundamentos-1440', 'read-boa-hipotese--experimentos-fundamentos-390', 'read-boa-hipotese--experimentos-fundamentos-1440', 'read-boa-hipotese--experimentos-fundamentos-dark-1440', 'reader-interacted-1440', 'reflow-320-font24', 'read-reserva-emergencia--financas-pessoais-768', 'read-metricas-basicas-1024', 'read-rotina-operacional-390', 'read-manual-indicadores-1024', 'read-guia-externo-golpes-390', 'notes-1440', 'bookmarks-390', 'notes-empty-768']) {
    const source = path.join(shots, `${name}.png`)
    if (existsSync(source)) copyFileSync(source, path.join(target, `${name}.png`))
  }
}
process.exit(failed.length ? 1 : 0)
