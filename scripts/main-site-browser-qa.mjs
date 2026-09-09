import { chromium } from 'playwright'
import fs from 'node:fs'

const baseUrl = process.env.MAIN_SITE_QA_URL || 'http://127.0.0.1:4173'
const baselineUrl = process.env.MAIN_SITE_BASELINE_URL || 'https://orcaly.com.br'
const artifactDir = process.env.MAIN_SITE_QA_ARTIFACT_DIR || 'qa-artifacts'
const viewports = [
  [320, 800], [375, 812], [390, 844], [430, 900],
  [768, 900], [1024, 900], [1280, 900], [1440, 900], [1920, 1080],
]

fs.mkdirSync(artifactDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const failures = []
const report = []

async function revealWholePage(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const step = Math.max(320, Math.floor(window.innerHeight * 0.72))
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await wait(65)
    }
    window.scrollTo(0, document.documentElement.scrollHeight)
    await wait(180)
    window.scrollTo(0, 0)
    await wait(180)
  })
}

async function captureBaseline(width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  try {
    const response = await page.goto(baselineUrl, { waitUntil: 'networkidle', timeout: 60_000 })
    if (response?.ok()) {
      await revealWholePage(page)
      await page.screenshot({ path: `${artifactDir}/before-${width}.png`, fullPage: true })
    }
  } finally {
    await context.close()
  }
}

await captureBaseline(390, 844)
await captureBaseline(1440, 900)

for (const [width, height] of viewports) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  if (!response || response.status() !== 200) failures.push(`${width}: home status ${response?.status() ?? 'none'}`)

  const h1 = await page.locator('h1').first().textContent().catch(() => '')
  if (h1?.trim() !== 'Seu site, pedidos, clientes e operação. Tudo trabalhando junto.') failures.push(`${width}: H1 changed/missing`)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) failures.push(`${width}: horizontal overflow ${overflow}px`)

  for (const text of ['Básico', 'Intermediário', 'Premium']) {
    if (!(await page.getByText(text, { exact: true }).first().count())) failures.push(`${width}: plan missing ${text}`)
  }
  for (const text of ['R$ 49,90', 'R$ 99,90', 'R$ 149,90']) {
    if (!(await page.getByText(text, { exact: false }).first().count())) failures.push(`${width}: price missing ${text}`)
  }

  const createAccount = page.getByRole('link', { name: 'Criar minha conta', exact: true }).first()
  if (!(await createAccount.count()) || (await createAccount.getAttribute('href')) !== '/cadastro') failures.push(`${width}: primary signup CTA changed`)

  if (width <= 430) {
    const mobileMenu = page.locator('header details').last()
    await mobileMenu.locator('summary').click()
    if ((await mobileMenu.getAttribute('open')) === null) failures.push(`${width}: mobile menu did not open`)
    await mobileMenu.locator('summary').click()
  }

  const faq = page.locator('.orcaly-faq-list details').first()
  if (await faq.count()) {
    await faq.locator('summary').click()
    if ((await faq.getAttribute('open')) === null) failures.push(`${width}: FAQ did not open`)
  } else failures.push(`${width}: FAQ missing`)

  const launcher = page.getByRole('button', { name: 'Abrir assistente virtual do Orçaly' })
  if (await launcher.count()) {
    await launcher.click()
    const dialog = page.getByRole('dialog', { name: 'Assistente virtual do Orçaly' })
    if (!(await dialog.isVisible())) failures.push(`${width}: assistant did not open`)
    await page.getByRole('button', { name: 'Fechar assistente' }).click()
  } else failures.push(`${width}: assistant launcher missing`)

  await revealWholePage(page)
  const revealedSections = await page.locator('.marketing-section[data-revealed="true"]').count()
  const sectionCount = await page.locator('.marketing-section').count()
  if (revealedSections !== sectionCount) failures.push(`${width}: ${sectionCount - revealedSections} sections never revealed`)

  if (consoleErrors.length) failures.push(`${width}: console errors: ${consoleErrors.join(' | ')}`)
  if (pageErrors.length) failures.push(`${width}: page errors: ${pageErrors.join(' | ')}`)

  if (width === 390 || width === 1440) {
    await page.screenshot({ path: `${artifactDir}/after-${width}.png`, fullPage: true })
  }

  report.push({ width, height, h1, overflow, sectionCount, revealedSections, consoleErrors, pageErrors })
  await context.close()
}

const routeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const routePage = await routeContext.newPage()
for (const route of ['/cadastro', '/login', '/parceiros', '/suporte', '/solucoes/graficas']) {
  const response = await routePage.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (!response || response.status() >= 400) failures.push(`route ${route}: status ${response?.status() ?? 'none'}`)
}
await routeContext.close()
await browser.close()

fs.writeFileSync(`${artifactDir}/report.json`, JSON.stringify({ sha: process.env.GITHUB_SHA || null, baseUrl, baselineUrl, report, failures }, null, 2))
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Browser QA PASS across ${viewports.length} viewports.`)
