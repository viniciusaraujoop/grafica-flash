import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const baseUrl = (process.env.ORCALY_E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const email = process.env.ORCALY_E2E_EMAIL || ''
const password = process.env.ORCALY_E2E_PASSWORD || ''
const vercelShare = process.env.ORCALY_E2E_VERCEL_SHARE || ''
const iterations = Number(process.env.ORCALY_E2E_ITERATIONS || 20)
const chromium = process.env.CHROMIUM_PATH || process.env.CHROME_PATH || 'chromium'
const mobile = process.env.ORCALY_E2E_MOBILE === '1'
const slowNetwork = process.env.ORCALY_E2E_NETWORK === 'slow'
const doubleClick = process.env.ORCALY_E2E_DOUBLE_CLICK === '1'
const timeoutMs = Number(process.env.ORCALY_E2E_TIMEOUT_MS || 30000)
const artifactRoot = process.env.ORCALY_E2E_ARTIFACT_ROOT || 'artifacts/auth'
const runOffset = Number(process.env.ORCALY_E2E_RUN_OFFSET || 0)
const runGroup = process.env.ORCALY_E2E_RUN_GROUP || 'fresh'

if (!email || !password) {
  console.error('ORCALY_E2E_EMAIL e ORCALY_E2E_PASSWORD são obrigatórios para o fresh-login E2E.')
  process.exit(2)
}

function loginUrl() {
  const url = new URL(`${baseUrl}/login`)
  if (vercelShare) url.searchParams.set('_vercel_share', vercelShare)
  return url.toString()
}

function sanitizeUrl(raw) {
  try {
    const url = new URL(raw)
    url.searchParams.delete('_vercel_share')
    return url.toString()
  } catch {
    return String(raw || '').replace(/([?&])_vercel_share=[^&]+/g, '$1_vercel_share=[REDACTED]')
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(predicate, description, deadline = Date.now() + timeoutMs) {
  let last
  while (Date.now() < deadline) {
    try {
      last = await predicate()
      if (last) return last
    } catch (error) {
      last = error
    }
    await delay(50)
  }
  throw new Error(`Timeout esperando ${description}. Último estado: ${String(last || 'sem detalhe')}`)
}

function waitForChildExit(child, maxMs) {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.off('exit', finish)
      resolve()
    }
    const timer = setTimeout(finish, maxMs)
    child.once('exit', finish)
  })
}

async function launchChromium() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'orcaly-auth-e2e-'))
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]

  const child = spawn(chromium, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  let wsUrl = ''

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    stderr += chunk
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (match) wsUrl = match[1]
  })

  await waitFor(
    () => wsUrl || (child.exitCode !== null ? Promise.reject(new Error(`Chromium encerrou (${child.exitCode}): ${stderr}`)) : false),
    'DevTools do Chromium',
  )

  return {
    child,
    userDataDir,
    browserWsUrl: wsUrl,
    async close() {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
        await waitForChildExit(child, 1500)
      }
      if (child.exitCode === null) {
        child.kill('SIGKILL')
        await waitForChildExit(child, 1500)
      }
      await rm(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      })
    },
  }
}

class Cdp {
  constructor(url) {
    this.url = url
    this.ws = null
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)))
        else pending.resolve(message.result || {})
        return
      }
      const handlers = this.listeners.get(message.method) || []
      for (const handler of handlers) handler(message.params || {}, message.sessionId)
    }
    this.ws.onclose = () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP websocket fechado.'))
      this.pending.clear()
    }
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = () => reject(new Error('Falha ao conectar no DevTools.'))
    })
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || []
    handlers.push(handler)
    this.listeners.set(method, handlers)
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify(payload))
    })
  }

  close() {
    this.ws?.close()
  }
}

async function saveScreenshot(cdp, sessionId, path) {
  try {
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
    if (capture?.data) await writeFile(path, Buffer.from(capture.data, 'base64'))
  } catch {
    // The structured result still records the failure if the page is no longer reachable.
  }
}

async function readPageState(cdp, sessionId) {
  try {
    const response = await cdp.send('Runtime.evaluate', {
      expression: `({
        href: location.href,
        pathname: location.pathname,
        readyState: document.readyState,
        panelReady: !!document.querySelector('[data-orcaly-panel="operations-v2"]'),
        genericError: /This page couldn[’']t load/i.test(document.body?.innerText || ''),
        loginForm: !!document.querySelector('form'),
        submitDisabled: !!document.querySelector('button[type="submit"]')?.disabled,
        bodyText: (document.body?.innerText || '').slice(0, 4000)
      })`,
      returnByValue: true,
    }, sessionId)
    return response.result?.value || null
  } catch (error) {
    return { evaluationError: error instanceof Error ? error.message : String(error) }
  }
}

async function runFreshLogin(index) {
  const runNumber = runOffset + index
  const runDir = join(artifactRoot, `run-${String(runNumber).padStart(3, '0')}`)
  await mkdir(runDir, { recursive: true })

  const startedAt = new Date()
  const result = {
    run: runNumber,
    group: runGroup,
    startedAt: startedAt.toISOString(),
    browserStarted: false,
    loginSubmitted: false,
    authSucceeded: false,
    redirectOccurred: false,
    finalUrl: null,
    panelReady: false,
    unexpected401: 0,
    unexpected403: 0,
    unexpected500: 0,
    consoleErrors: [],
    duration: null,
    failureStage: null,
    failureMessage: null,
  }

  const consoleLines = []
  const network = []
  let browser
  let cdp
  let sessionId
  let loginPosts = 0
  let stage = 'browser_start'
  let finalState = null

  try {
    browser = await launchChromium()
    result.browserStarted = true

    cdp = new Cdp(browser.browserWsUrl)
    await cdp.connect()
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
    sessionId = attached.sessionId

    cdp.on('Runtime.exceptionThrown', (params) => {
      const message = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'runtime exception'
      result.consoleErrors.push(String(message))
      consoleLines.push(`[exception] ${String(message)}`)
    })
    cdp.on('Runtime.consoleAPICalled', (params) => {
      const message = params.args?.map((arg) => arg.value || arg.description || '').join(' ') || `console.${params.type}`
      consoleLines.push(`[${params.type}] ${message}`)
      if (params.type === 'error') result.consoleErrors.push(message)
    })
    cdp.on('Network.requestWillBeSent', (params) => {
      const request = params.request || {}
      network.push({
        type: 'request',
        requestId: params.requestId,
        method: request.method,
        url: sanitizeUrl(request.url),
        timestamp: params.timestamp,
      })
      if (request.method === 'POST' && request.url?.startsWith(`${baseUrl}/login`)) loginPosts += 1
    })
    cdp.on('Network.responseReceived', (params) => {
      const response = params.response || {}
      if (!response.url?.startsWith(baseUrl)) return
      const status = Number(response.status || 0)
      network.push({
        type: 'response',
        requestId: params.requestId,
        status,
        url: sanitizeUrl(response.url),
        mimeType: response.mimeType || null,
        timestamp: params.timestamp,
      })
      if (status === 401) result.unexpected401 += 1
      if (status === 403) result.unexpected403 += 1
      if (status >= 500) result.unexpected500 += 1
    })

    await cdp.send('Runtime.enable', {}, sessionId)
    await cdp.send('Network.enable', {}, sessionId)
    await cdp.send('Page.enable', {}, sessionId)

    if (mobile) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true,
      }, sessionId)
    }

    if (slowNetwork) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 400,
        downloadThroughput: 400 * 1024 / 8,
        uploadThroughput: 128 * 1024 / 8,
        connectionType: 'cellular3g',
      }, sessionId)
    }

    stage = 'login_load'
    await cdp.send('Page.navigate', { url: loginUrl() }, sessionId)
    await waitFor(async () => {
      const response = await cdp.send('Runtime.evaluate', {
        expression: `document.readyState === 'complete' && !!document.querySelector('input[type="email"]') && !!document.querySelector('input[type="password"]') && !!document.querySelector('button[type="submit"]')`,
        returnByValue: true,
      }, sessionId)
      return response.result?.value === true
    }, 'formulário de login')

    await saveScreenshot(cdp, sessionId, join(runDir, 'screenshot-before.png'))

    stage = 'login_submit'
    const fill = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const set = (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(el, value)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
        const email = document.querySelector('input[type="email"]')
        const password = document.querySelector('input[type="password"]')
        const button = document.querySelector('button[type="submit"]')
        if (!email || !password || !button) return false
        set(email, ${JSON.stringify(email)})
        set(password, ${JSON.stringify(password)})
        button.click()
        ${doubleClick ? 'button.click()' : ''}
        return true
      })()`,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId)
    assert.equal(fill.result?.value, true, 'Formulário de login não pôde ser preenchido.')
    result.loginSubmitted = true

    stage = 'panel_wait'
    await waitFor(async () => {
      const state = await readPageState(cdp, sessionId)
      if (state?.genericError) throw new Error('Next.js exibiu a tela fatal de navegação.')
      if (state?.pathname?.startsWith('/painel')) result.redirectOccurred = true
      return state?.panelReady === true
    }, 'painel autenticado pronto')

    stage = 'panel_verify'
    finalState = await readPageState(cdp, sessionId)
    result.finalUrl = finalState?.href ? sanitizeUrl(finalState.href) : null
    result.panelReady = finalState?.panelReady === true
    result.authSucceeded = loginPosts > 0 && result.panelReady

    assert.equal(result.panelReady, true, 'Painel não atingiu estado ready.')
    assert.equal(finalState?.genericError, false, 'Tela fatal do Next apareceu após login.')
    assert.match(result.finalUrl || '', /\/painel(?:\/|$)/, 'URL final não está no painel.')
    assert.equal(loginPosts, 1, `Esperado 1 request de login; recebido ${loginPosts}.`)

    const unexpected = network.filter((entry) => {
      if (entry.type !== 'response' || entry.status < 400) return false
      if (/manifest\.webmanifest/.test(entry.url)) return false
      return true
    })

    assert.deepEqual(unexpected, [], `HTTP inesperado após login: ${JSON.stringify(unexpected)}`)
    assert.deepEqual(result.consoleErrors, [], `Erros de console: ${JSON.stringify(result.consoleErrors)}`)
    stage = 'complete'
  } catch (error) {
    result.failureStage = stage
    result.failureMessage = error instanceof Error ? error.message : String(error)
    if (cdp && sessionId) {
      finalState = await readPageState(cdp, sessionId)
      result.finalUrl = finalState?.href ? sanitizeUrl(finalState.href) : result.finalUrl
      result.panelReady = finalState?.panelReady === true
      result.redirectOccurred = Boolean(finalState?.pathname?.startsWith('/painel'))
      result.authSucceeded = loginPosts > 0 && result.redirectOccurred
      await writeFile(join(runDir, 'page-state.json'), JSON.stringify(finalState, null, 2))
    }
    throw error
  } finally {
    result.duration = Date.now() - startedAt.getTime()
    if (cdp && sessionId) await saveScreenshot(cdp, sessionId, join(runDir, 'screenshot-after.png'))
    if (finalState?.href && !result.finalUrl) result.finalUrl = sanitizeUrl(finalState.href)

    await writeFile(join(runDir, 'final-url.txt'), `${result.finalUrl || 'unknown'}\n`)
    await writeFile(join(runDir, 'console.log'), `${consoleLines.join('\n')}${consoleLines.length ? '\n' : ''}`)
    await writeFile(join(runDir, 'network.json'), JSON.stringify(network, null, 2))
    await writeFile(join(runDir, 'result.json'), JSON.stringify({ ...result, loginPosts }, null, 2))

    cdp?.close()
    if (browser) {
      try {
        await browser.close()
      } catch (cleanupError) {
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        await writeFile(join(runDir, 'cleanup-error.txt'), `${message}\n`)
        if (!result.failureMessage) throw cleanupError
      }
    }
  }

  return {
    iteration: index,
    run: runNumber,
    url: result.finalUrl,
    loginPosts,
    consoleErrors: result.consoleErrors.length,
    badResponses: result.unexpected401 + result.unexpected403 + result.unexpected500,
  }
}

await mkdir(artifactRoot, { recursive: true })
const results = []
for (let index = 1; index <= iterations; index += 1) {
  try {
    const result = await runFreshLogin(index)
    results.push(result)
    console.log(`[auth-e2e] ${index}/${iterations} PASS ${result.url}`)
  } catch (error) {
    console.error(`[auth-e2e] ${index}/${iterations} FAIL ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

console.log(JSON.stringify({
  event: 'auth_first_login_e2e_complete',
  baseUrl: sanitizeUrl(baseUrl),
  vercelProtection: Boolean(vercelShare),
  iterations,
  runOffset,
  runGroup,
  mobile,
  slowNetwork,
  doubleClick,
  passed: results.length,
}, null, 2))
