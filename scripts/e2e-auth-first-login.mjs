import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
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

if (!email || !password) {
  console.error('ORCALY_E2E_EMAIL e ORCALY_E2E_PASSWORD são obrigatórios para o fresh-login E2E.')
  process.exit(2)
}

function loginUrl() {
  const url = new URL(`${baseUrl}/login`)
  if (vercelShare) url.searchParams.set('_vercel_share', vercelShare)
  return url.toString()
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
      for (const handler of handlers) handler(message.params || {})
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

async function runFreshLogin(index) {
  const browser = await launchChromium()
  const cdp = new Cdp(browser.browserWsUrl)
  const consoleErrors = []
  const badResponses = []
  let loginPosts = 0

  try {
    await cdp.connect()
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })

    cdp.on('Runtime.exceptionThrown', (params) => {
      if (params.exceptionDetails?.text) consoleErrors.push(params.exceptionDetails.text)
    })
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        consoleErrors.push(params.args?.map((arg) => arg.value || arg.description || '').join(' ') || 'console.error')
      }
    })
    cdp.on('Network.requestWillBeSent', (params) => {
      const request = params.request
      if (request?.method === 'POST' && request.url?.startsWith(`${baseUrl}/login`)) loginPosts += 1
    })
    cdp.on('Network.responseReceived', (params) => {
      const response = params.response
      if (!response?.url?.startsWith(baseUrl)) return
      if (response.status >= 400) {
        badResponses.push({ status: response.status, url: response.url })
      }
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

    await cdp.send('Page.navigate', { url: loginUrl() }, sessionId)
    await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `document.readyState === 'complete' && !!document.querySelector('input[type="email"]') && !!document.querySelector('input[type="password"]')`,
        returnByValue: true,
      }, sessionId)
      return result.result?.value === true
    }, 'formulário de login')

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

    await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const text = document.body?.innerText || ''
          if (text.includes("This page couldn’t load") || text.includes("This page couldn't load")) return 'next-error'
          if (location.pathname.startsWith('/painel') && document.querySelector('[data-orcaly-panel="operations-v2"]')) return 'ready'
          return location.pathname
        })()`,
        returnByValue: true,
      }, sessionId)
      const value = result.result?.value
      if (value === 'next-error') throw new Error('Next.js exibiu a tela fatal de navegação.')
      return value === 'ready'
    }, 'painel autenticado pronto')

    const finalState = await cdp.send('Runtime.evaluate', {
      expression: `({
        href: location.href,
        panelReady: !!document.querySelector('[data-orcaly-panel="operations-v2"]'),
        genericError: /This page couldn[’']t load/i.test(document.body?.innerText || ''),
        bodyText: (document.body?.innerText || '').slice(0, 1000)
      })`,
      returnByValue: true,
    }, sessionId)

    assert.equal(finalState.result?.value?.panelReady, true, 'Painel não atingiu estado ready.')
    assert.equal(finalState.result?.value?.genericError, false, 'Tela fatal do Next apareceu após login.')
    assert.match(finalState.result?.value?.href || '', /\/painel(?:\/|$)/, 'URL final não está no painel.')
    assert.equal(loginPosts, 1, `Esperado 1 request de login; recebido ${loginPosts}.`)

    const unexpected = badResponses.filter(({ status, url }) => {
      if (status < 400) return false
      if (/manifest\.webmanifest/.test(url)) return false
      return true
    })

    assert.deepEqual(unexpected, [], `HTTP inesperado após login: ${JSON.stringify(unexpected)}`)
    assert.deepEqual(consoleErrors, [], `Erros de console: ${JSON.stringify(consoleErrors)}`)

    return {
      iteration: index,
      url: finalState.result?.value?.href,
      loginPosts,
      consoleErrors: consoleErrors.length,
      badResponses: unexpected.length,
    }
  } finally {
    cdp.close()
    await browser.close()
  }
}

const results = []
for (let index = 1; index <= iterations; index += 1) {
  const result = await runFreshLogin(index)
  results.push(result)
  console.log(`[auth-e2e] ${index}/${iterations} PASS ${result.url}`)
}

console.log(JSON.stringify({
  event: 'auth_first_login_e2e_complete',
  baseUrl,
  vercelProtection: Boolean(vercelShare),
  iterations,
  mobile,
  slowNetwork,
  doubleClick,
  passed: results.length,
}, null, 2))
