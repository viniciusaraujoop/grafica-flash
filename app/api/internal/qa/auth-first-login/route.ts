import { randomBytes } from 'node:crypto'
import { Sandbox } from '@vercel/sandbox'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const QA_COMPANY_ID = 'f5cd0793-f016-4e64-9b5f-3e650b1795ce'
const PRODUCTION_ORIGIN = 'https://orcaly.com.br'

const SYSTEM_DEPS = [
  'nss',
  'nspr',
  'libxkbcommon',
  'atk',
  'at-spi2-atk',
  'at-spi2-core',
  'libXcomposite',
  'libXdamage',
  'libXrandr',
  'libXfixes',
  'libXcursor',
  'libXi',
  'libXtst',
  'libXScrnSaver',
  'libXext',
  'mesa-libgbm',
  'libdrm',
  'mesa-libGL',
  'mesa-libEGL',
  'cups-libs',
  'alsa-lib',
  'pango',
  'cairo',
  'gtk3',
  'dbus-libs',
]

function safeTarget(request: NextRequest) {
  const currentOrigin = request.nextUrl.origin
  const raw = request.nextUrl.searchParams.get('target') || currentOrigin

  let origin: string
  try {
    origin = new URL(raw).origin
  } catch {
    throw new Error('QA target inválido.')
  }

  if (origin !== currentOrigin && origin !== PRODUCTION_ORIGIN) {
    throw new Error('QA target não permitido.')
  }

  return origin
}

function buildRunner() {
  return String.raw`
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const baseUrl = process.env.QA_BASE_URL.replace(/\/$/, '')
const email = process.env.QA_EMAIL
const password = process.env.QA_PASSWORD
const share = process.env.QA_VERCEL_SHARE || ''
const AB = process.env.AGENT_BROWSER_BIN || 'agent-browser'
let sequence = 0

function run(args, { json = false, allowFailure = false } = {}) {
  try {
    const output = execFileSync(AB, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 45000,
      env: process.env,
    }).trim()
    if (!json) return output
    if (!output) return null
    return JSON.parse(output)
  } catch (error) {
    if (allowFailure) {
      return {
        failed: true,
        status: error.status ?? null,
        stdout: String(error.stdout || ''),
        stderr: String(error.stderr || ''),
      }
    }
    throw new Error(
      'agent-browser falhou: ' + args.join(' ') + '\n' +
      String(error.stderr || error.stdout || error.message || error),
    )
  }
}

function session(prefix) {
  sequence += 1
  return 'orcaly-' + prefix + '-' + sequence + '-' + Date.now()
}

function cmd(s, ...args) {
  return run(['--session', s, ...args])
}

function cmdJson(s, ...args) {
  return run(['--session', s, ...args, '--json'], { json: true })
}

function loginUrl() {
  const url = new URL(baseUrl + '/login')
  if (share) url.searchParams.set('_vercel_share', share)
  return url.toString()
}

function bodyText(s) {
  return cmd(s, 'get', 'text', 'body')
}

function currentUrl(s) {
  return cmd(s, 'get', 'url').trim()
}

function assertNoFatalPage(s) {
  const text = bodyText(s)
  assert.equal(/This page couldn[’']t load/i.test(text), false, 'Tela fatal do Next apareceu.')
}

function parseHar(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function sameOriginBadResponses(har) {
  const origin = new URL(baseUrl).origin
  return (har.log?.entries || [])
    .map((entry) => ({
      method: entry.request?.method,
      url: entry.request?.url,
      status: entry.response?.status,
    }))
    .filter((item) => {
      if (!item.url || !Number.isFinite(item.status)) return false
      if (new URL(item.url).origin !== origin) return false
      return item.status === 401 || item.status === 403 || item.status >= 500
    })
}

function loginPosts(har) {
  const origin = new URL(baseUrl).origin
  return (har.log?.entries || []).filter((entry) => {
    if (entry.request?.method !== 'POST') return false
    const url = new URL(entry.request.url)
    return url.origin === origin && url.pathname === '/login'
  }).length
}

function pageErrors(s) {
  const raw = cmdJson(s, 'errors')
  if (!raw) return []
  const data = raw.data ?? raw
  if (Array.isArray(data)) return data
  if (Array.isArray(data.errors)) return data.errors
  return []
}

function consoleErrors(s) {
  const raw = cmdJson(s, 'console')
  if (!raw) return []
  const data = raw.data ?? raw
  const items = Array.isArray(data) ? data : Array.isArray(data.messages) ? data.messages : []
  return items.filter((item) => String(item.type || item.level || '').toLowerCase() === 'error')
}

function waitPanel(s) {
  cmd(s, 'wait', '--url', '**/painel/**')
  cmd(s, 'wait', '--fn', '!!document.querySelector(\'[data-orcaly-panel="operations-v2"]\')')
  assertNoFatalPage(s)
  assert.match(currentUrl(s), /\/painel(?:\/|$)/)
}

function fillCredentials(s, pwd = password) {
  cmd(s, 'fill', 'input[type="email"]', email)
  cmd(s, 'fill', 'input[type="password"]', pwd)
}

function cleanup(s) {
  run(['--session', s, 'close'], { allowFailure: true })
}

function freshLogin(label, options = {}) {
  const s = session(label)
  const harPath = '/tmp/' + s + '.har'
  try {
    cmd(s, 'open', 'about:blank')
    if (options.mobile) cmd(s, 'set', 'viewport', '390', '844', '3')
    if (options.slow) {
      const cdp = cmdJson(s, 'get', 'cdp-url')
      const ws = cdp?.data?.url || cdp?.data?.cdpUrl || cdp?.url || cdp?.cdpUrl
      assert.ok(ws, 'CDP URL ausente para teste de rede lenta.')
      const encoded = Buffer.from(String.raw\`
        const ws = new WebSocket(\${JSON.stringify(ws)});
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        let nextId = 1;
        const pending = new Map();
        ws.onmessage = (event) => {
          const msg = JSON.parse(String(event.data));
          if (!msg.id) return;
          const fn = pending.get(msg.id);
          if (fn) { pending.delete(msg.id); fn(msg); }
        };
        const send = (method, params = {}, sessionId) => new Promise((resolve) => {
          const id = nextId++;
          pending.set(id, resolve);
          ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
        const targets = await send('Target.getTargets');
        const target = targets.result.targetInfos.find((item) => item.type === 'page');
        const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
        const sid = attached.result.sessionId;
        await send('Network.enable', {}, sid);
        await send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 400,
          downloadThroughput: 400 * 1024 / 8,
          uploadThroughput: 128 * 1024 / 8,
          connectionType: 'cellular3g'
        }, sid);
        ws.close();
        'ok';
      \`).toString('base64')
      cmd(s, 'eval', '-b', encoded)
    }

    cmd(s, 'network', 'har', 'start', '--content', 'none')
    cmd(s, 'navigate', loginUrl())
    cmd(s, 'wait', 'input[type="email"]')

    const cookiesBefore = cmdJson(s, 'cookies')
    const cookieText = JSON.stringify(cookiesBefore || {})
    assert.equal(/sb-[^" ]*-auth-token/i.test(cookieText), false, 'Sessão Supabase já existia antes do fresh login.')

    fillCredentials(s)
    if (options.doubleClick) cmd(s, 'dblclick', 'button[type="submit"]')
    else cmd(s, 'click', 'button[type="submit"]')

    waitPanel(s)
    cmd(s, 'network', 'har', 'stop', harPath)

    const har = parseHar(harPath)
    const bad = sameOriginBadResponses(har)
    assert.deepEqual(bad, [], 'HTTP auth/server inesperado: ' + JSON.stringify(bad))
    assert.equal(loginPosts(har), 1, 'Login disparou quantidade incorreta de POSTs.')
    assert.deepEqual(pageErrors(s), [], 'Page errors: ' + JSON.stringify(pageErrors(s)))
    assert.deepEqual(consoleErrors(s), [], 'Console errors: ' + JSON.stringify(consoleErrors(s)))

    return { ok: true, url: currentUrl(s), loginPosts: 1, badResponses: 0 }
  } finally {
    cleanup(s)
  }
}

function wrongPassword() {
  const s = session('wrong-password')
  try {
    cmd(s, 'open', loginUrl())
    cmd(s, 'wait', 'input[type="email"]')
    fillCredentials(s, password + '-errada')
    cmd(s, 'click', 'button[type="submit"]')
    cmd(s, 'wait', '--text', 'E-mail ou senha incorretos')
    assert.match(new URL(currentUrl(s)).pathname, /^\/login$/)
    assertNoFatalPage(s)
    return { ok: true }
  } finally {
    cleanup(s)
  }
}

function unauthenticatedPanel() {
  const s = session('unauth-panel')
  try {
    const url = new URL(baseUrl + '/painel/inicio')
    if (share) url.searchParams.set('_vercel_share', share)
    cmd(s, 'open', url.toString())
    cmd(s, 'wait', '--url', '**/login**')
    assert.match(new URL(currentUrl(s)).pathname, /^\/login$/)
    assertNoFatalPage(s)
    return { ok: true }
  } finally {
    cleanup(s)
  }
}

function authenticatedJourney() {
  const s = session('journey')
  try {
    cmd(s, 'open', loginUrl())
    cmd(s, 'wait', 'input[type="email"]')
    fillCredentials(s)
    cmd(s, 'click', 'button[type="submit"]')
    waitPanel(s)

    cmd(s, 'navigate', baseUrl + '/painel/pedidos')
    waitPanel(s)
    cmd(s, 'navigate', baseUrl + '/painel/site')
    waitPanel(s)
    cmd(s, 'reload')
    waitPanel(s)

    cmd(s, 'tab', 'new', '--label', 'segunda', baseUrl + '/painel/pedidos')
    cmd(s, 'tab', 'segunda')
    waitPanel(s)
    cmd(s, 'tab', 'close', 'segunda')

    cmd(s, 'tab', 'new', '--label', 'reaberta', baseUrl + '/painel/inicio')
    cmd(s, 'tab', 'reaberta')
    waitPanel(s)

    cmd(s, 'click', 'button[title="Sair da conta"]')
    cmd(s, 'wait', '--url', '**/login**')
    assert.match(new URL(currentUrl(s)).pathname, /^\/login$/)

    fillCredentials(s)
    cmd(s, 'click', 'button[type="submit"]')
    waitPanel(s)
    return { ok: true }
  } finally {
    cleanup(s)
  }
}

const result = {
  freshLocalGate: [],
  previewGate: [],
  mobile: [],
  slowNetwork: [],
  doubleClick: [],
  wrongPassword: null,
  unauthenticatedPanel: null,
  authenticatedJourney: null,
}

for (let i = 0; i < 20; i += 1) result.freshLocalGate.push(freshLogin('fresh-' + (i + 1)))
for (let i = 0; i < 10; i += 1) result.previewGate.push(freshLogin('preview-' + (i + 1)))
for (let i = 0; i < 3; i += 1) result.mobile.push(freshLogin('mobile-' + (i + 1), { mobile: true }))
for (let i = 0; i < 3; i += 1) result.slowNetwork.push(freshLogin('slow-' + (i + 1), { slow: true }))
for (let i = 0; i < 3; i += 1) result.doubleClick.push(freshLogin('double-' + (i + 1), { doubleClick: true }))
result.wrongPassword = wrongPassword()
result.unauthenticatedPanel = unauthenticatedPanel()
result.authenticatedJourney = authenticatedJourney()

console.log(JSON.stringify({
  event: 'orcaly_auth_browser_qa_complete',
  counts: {
    freshLocalGate: result.freshLocalGate.length,
    previewGate: result.previewGate.length,
    mobile: result.mobile.length,
    slowNetwork: result.slowNetwork.length,
    doubleClick: result.doubleClick.length,
  },
  wrongPassword: result.wrongPassword?.ok === true,
  unauthenticatedPanel: result.unauthenticatedPanel?.ok === true,
  authenticatedJourney: result.authenticatedJourney?.ok === true,
}, null, 2))
`
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Preview QA only.' }, { status: 404 })
  }

  const trigger = request.nextUrl.searchParams.get('run')
  if (trigger !== 'auth-first-login-v1') {
    return NextResponse.json({ error: 'QA run inválido.' }, { status: 400 })
  }

  let target: string
  try {
    target = safeTarget(request)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Target inválido.' },
      { status: 400 },
    )
  }

  const share = String(request.nextUrl.searchParams.get('share') || '')
  const random = randomBytes(12).toString('hex')
  const email = `qa-auth-${random}@orcaly.test`
  const password = `Qa!${randomBytes(24).toString('base64url')}`
  const supabaseAdmin = getSupabaseAdmin()
  let userId: string | null = null
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null

  console.info(JSON.stringify({ event: 'qa_auth_preview_started', target }))

  try {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { qa_disposable: true },
    })

    if (createError || !created.user?.id) {
      throw new Error(`Falha ao criar usuário QA: ${createError?.message || 'id ausente'}`)
    }

    userId = created.user.id

    const { error: memberError } = await supabaseAdmin
      .from('company_members')
      .insert({
        company_id: QA_COMPANY_ID,
        user_id: userId,
        nome: 'QA Auth Disposable',
        email,
        cargo: 'gerente',
        status: 'ativo',
        permissions: {},
      })

    if (memberError) {
      throw new Error(`Falha ao vincular usuário QA: ${memberError.message}`)
    }

    sandbox = await Sandbox.create({
      runtime: 'node24',
      timeout: 280_000,
      env: {
        QA_BASE_URL: target,
        QA_EMAIL: email,
        QA_PASSWORD: password,
        QA_VERCEL_SHARE: share,
      },
    })

    const deps = await sandbox.runCommand('sh', [
      '-c',
      `sudo dnf clean all >/dev/null 2>&1 && sudo dnf install -y --skip-broken ${SYSTEM_DEPS.join(' ')} >/dev/null 2>&1 && sudo ldconfig >/dev/null 2>&1`,
    ])
    if (deps.exitCode !== 0) {
      throw new Error(`Falha nas dependências do Chromium: ${(await deps.stderr()).slice(-2000)}`)
    }

    const install = await sandbox.runCommand('sh', [
      '-c',
      'npm install -g agent-browser >/dev/null 2>&1 && agent-browser install >/dev/null 2>&1',
    ])
    if (install.exitCode !== 0) {
      throw new Error(`Falha ao instalar navegador QA: ${(await install.stderr()).slice(-2000)}`)
    }

    const runner = buildRunner()
    const encodedRunner = Buffer.from(runner, 'utf8').toString('base64')
    const write = await sandbox.runCommand('sh', [
      '-c',
      `printf '%s' '${encodedRunner}' | base64 -d > /home/vercel-sandbox/auth-qa-runner.mjs`,
    ])
    if (write.exitCode !== 0) {
      throw new Error(`Falha ao preparar runner QA: ${(await write.stderr()).slice(-2000)}`)
    }

    const execution = await sandbox.runCommand('node', [
      '/home/vercel-sandbox/auth-qa-runner.mjs',
    ])
    const stdout = (await execution.stdout()).trim()
    const stderr = (await execution.stderr()).trim()

    if (execution.exitCode !== 0) {
      throw new Error(`QA browser falhou (${execution.exitCode}): ${stderr.slice(-5000) || stdout.slice(-5000)}`)
    }

    const jsonStart = stdout.lastIndexOf('{\n  "event": "orcaly_auth_browser_qa_complete"')
    if (jsonStart < 0) {
      throw new Error(`Runner QA terminou sem resumo estruturado: ${stdout.slice(-3000)}`)
    }

    const summary = JSON.parse(stdout.slice(jsonStart)) as Record<string, unknown>

    console.info(JSON.stringify({ event: 'qa_auth_preview_completed', target }))
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'qa_auth_preview_failed',
      target,
      error_name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message.slice(0, 4000) : 'unknown',
    }))

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'QA browser desconhecido.',
      },
      { status: 500 },
    )
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop()
      } catch {
        // Sandbox é efêmero; a limpeza do usuário continua sendo prioritária.
      }
    }

    if (userId) {
      try {
        await supabaseAdmin.from('company_members').delete().eq('user_id', userId)
      } catch {
        // deleteUser abaixo remove a identidade descartável mesmo se a relação já sumiu.
      }

      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch {
        console.error(JSON.stringify({ event: 'qa_auth_cleanup_failure' }))
      }
    }
  }
}
