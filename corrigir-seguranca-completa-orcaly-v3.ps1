param(
  [string]$ExpectedBranch = "feature/vitrine-marketplace",
  [string]$SupabaseProjectRef = "ozrasuktfthsvbqprtel",
  [switch]$SkipDatabase,
  [switch]$SkipBuild,
  [switch]$SkipAuthHardening
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host ("=" * 68) -ForegroundColor DarkCyan
  Write-Host $Text -ForegroundColor Cyan
  Write-Host ("=" * 68) -ForegroundColor DarkCyan
}

function Write-Ok([string]$Text) {
  Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
  Write-Host "[AVISO] $Text" -ForegroundColor Yellow
}

function Write-Fail([string]$Text) {
  Write-Host "[ERRO] $Text" -ForegroundColor Red
}

function Get-RelativePath([string]$Path) {
  $root = (Get-Location).Path.TrimEnd('\')
  $full = [System.IO.Path]::GetFullPath($Path)
  if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $full.Substring($root.Length).TrimStart('\')
  }
  return $Path
}

function Backup-File([string]$Path, [string]$BackupRoot, [System.Collections.Generic.HashSet[string]]$CreatedFiles) {
  $relative = Get-RelativePath $Path
  if (Test-Path -LiteralPath $Path) {
    $destination = Join-Path $BackupRoot $relative
    $parent = Split-Path -Parent $destination
    if ($parent) {
      New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Copy-Item -LiteralPath $Path -Destination $destination -Force
  }
  else {
    [void]$CreatedFiles.Add($relative)
  }
}

function Restore-Backup([string]$BackupRoot, [System.Collections.Generic.HashSet[string]]$CreatedFiles) {
  Write-Warn "Restaurando arquivos locais alterados..."
  foreach ($relative in $CreatedFiles) {
    $target = Join-Path (Get-Location).Path $relative
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Force
    }
  }

  if (Test-Path -LiteralPath $BackupRoot) {
    Get-ChildItem -LiteralPath $BackupRoot -Recurse -File | ForEach-Object {
      $relative = $_.FullName.Substring($BackupRoot.Length).TrimStart('\')
      $target = Join-Path (Get-Location).Path $relative
      $parent = Split-Path -Parent $target
      if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
      }
      Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($Path), $Content, $utf8)
}

Write-Section "ORCALY - CORRECAO COMPLETA DE SEGURANCA V3"

if (-not (Test-Path -LiteralPath ".git")) {
  throw "Execute este script na raiz do projeto, onde existe a pasta .git."
}

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel identificar a branch atual."
}

if ($branch -ne $ExpectedBranch) {
  throw "Branch incorreta. Atual: '$branch'. Esperada: '$ExpectedBranch'."
}

$unmerged = & git diff --name-only --diff-filter=U
if ($unmerged) {
  throw "Existem conflitos de merge. Resolva antes de aplicar a correcao."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nao encontrado."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao encontrado."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path (Get-Location).Path ".orcaly-backups\security-hardening-$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$createdFiles = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

$knownFiles = @(
  "package.json",
  "package-lock.json",
  "proxy.ts",
  "lib\supabase.ts",
  "lib\orcaly-security.ts",
  "lib\admin-auth.ts",
  "lib\company-access.ts",
  "lib\mercado-pago.ts",
  "lib\payments\checkout-service.ts",
  "app\api\marketplace\payments\webhook\mercado-pago\route.ts",
  "app\api\assinatura\checkout\webhook\route.ts",
  "app\api\checkout\[slug]\route.ts",
  "app\api\checkout\[slug]\prepare\route.ts",
  "app\api\checkout\[slug]\status\route.ts",
  "app\api\marketplace\coupon\route.ts",
  "app\api\security\report\route.ts",
  "app\api\public-site\[slug]\route.ts",
  "app\site\[slug]\page.tsx",
  "app\api\system\health\route.ts",
  "lib\security\rate-limit.ts",
  "lib\security\request.ts",
  "lib\payments\checkout-validation.ts",
  "app\api\public\uploads\art\route.ts",
  "scripts\security-check.mjs",
  "supabase\migrations\20260729133000_orcaly_security_hardening.sql"
)

$dynamicFiles = @()
if (Test-Path -LiteralPath "app\api") {
  $dynamicFiles += Get-ChildItem -LiteralPath "app\api" -Recurse -Filter "route.ts" -File |
    Where-Object {
      $content = Get-Content -LiteralPath $_.FullName -Raw
      $content -match "art_approval_requests" -or
      $content -match "Transforme o pedido bagunçado" -or
      $content -match "assistente interno do Orçaly"
    } |
    ForEach-Object { Get-RelativePath $_.FullName }
}

$allBackupFiles = @($knownFiles + $dynamicFiles) | Select-Object -Unique
foreach ($file in $allBackupFiles) {
  Backup-File -Path $file -BackupRoot $backupRoot -CreatedFiles $createdFiles
}

$patcherPath = Join-Path (Get-Location).Path ".orcaly-security-patch.mjs"
$patcher = @'
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const MARKER = "ORCALY_SECURITY_HARDENING_V1";

function full(relative) {
  return path.join(root, relative);
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function read(relative) {
  return fs.readFileSync(full(relative), "utf8");
}

function write(relative, content) {
  const file = full(relative);
  ensureDir(file);
  fs.writeFileSync(file, content.replace(/\r?\n/g, "\n").replace(/\n?$/, "\n"), "utf8");
  console.log(`[PATCH] ${relative}`);
}

function replaceRequired(relative, before, after) {
  const current = read(relative);
  if (!current.includes(before)) {
    throw new Error(`Trecho esperado nao encontrado em ${relative}`);
  }
  write(relative, current.replace(before, after));
}

function walk(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(target));
    else result.push(target);
  }
  return result;
}

const packageJson = JSON.parse(read("package.json"));
packageJson.dependencies ||= {};
packageJson.dependencies["@supabase/ssr"] = "0.12.3";
packageJson.scripts ||= {};
packageJson.scripts["security:check"] = "node scripts/security-check.mjs";
write("package.json", JSON.stringify(packageJson, null, 2));

write("lib/supabase.ts", `import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
`);

write("lib/orcaly-security.ts", `import { NextRequest, NextResponse } from 'next/server'

export const ORCALY_SECURITY_HARDENING_V1 = true

const RESERVED = new Set([
  'admin',
  'api',
  'www',
  'login',
  'painel',
  'cadastro',
  'checkout',
  'orcamento',
  'proposta',
  'static',
  'assets',
  'suporte',
  'security',
  'seguranca',
])

export function normalizeSlug(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function isReservedSlug(value: string) {
  return RESERVED.has(normalizeSlug(value))
}

export function isReservedSubdomain(value: string) {
  return RESERVED.has(normalizeSlug(value))
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export function getSafeUserAgent(request: NextRequest) {
  return String(request.headers.get('user-agent') || '').slice(0, 500)
}

export function isLikelyDangerousInput(value: string) {
  const input = String(value || '').toLowerCase()
  const patterns = [
    '<script',
    'javascript:',
    'onerror=',
    'onload=',
    'union select',
    'drop table',
    '../',
    '..\\\\',
    '\${',
    '{{',
  ]

  return patterns.some((pattern) => input.includes(pattern))
}

export function securityHeaders(pathname = '') {
  const isSensitive =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/painel') ||
    pathname.startsWith('/api/admin')
  const production = process.env.NODE_ENV === 'production'

  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(production ? [] : ["'unsafe-eval'"]),
    'https://*.mercadopago.com',
    'https://*.mercadolibre.com',
  ]

  const csp = [
    "default-src 'self'",
    \`script-src \${scriptSources.join(' ')}\`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.mercadopago.com https://servicodados.ibge.gov.br",
    "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
    'report-uri /api/security/report',
  ].join('; ')

  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
    'X-DNS-Prefetch-Control': 'on',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Content-Security-Policy': csp,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
  }

  if (isSensitive) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    headers.Pragma = 'no-cache'
    headers.Expires = '0'
  }

  return headers
}

export function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  const headers = securityHeaders(request.nextUrl.pathname)

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export function isMutatingMethod(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

export function sameOriginAllowed(request: NextRequest) {
  if (!isMutatingMethod(request.method)) return true

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  if (origin && host) {
    try {
      return new URL(origin).host.toLowerCase() === host.toLowerCase()
    } catch {
      return false
    }
  }

  const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase()
  return fetchSite === 'same-origin' || fetchSite === 'same-site'
}

export function requireSameOrigin(request: NextRequest) {
  if (!sameOriginAllowed(request)) {
    return NextResponse.json({ error: 'Origem invalida.' }, { status: 403 })
  }

  return null
}

export function rejectOversizedRequest(request: NextRequest, maxBytes: number) {
  const raw = request.headers.get('content-length')
  if (!raw) return null

  const length = Number(raw)
  if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
    return NextResponse.json({ error: 'Requisicao muito grande.' }, { status: 413 })
  }

  return null
}
`);

write("lib/security/request.ts", `import { NextRequest, NextResponse } from 'next/server'

export class RequestBodyError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: NextRequest,
  maxBytes: number,
): Promise<T> {
  const declared = Number(request.headers.get('content-length') || 0)

  if (declared > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  const buffer = await request.arrayBuffer()

  if (buffer.byteLength > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  try {
    return JSON.parse(new TextDecoder().decode(buffer) || '{}') as T
  } catch {
    throw new RequestBodyError('JSON invalido.', 400)
  }
}

export function requestBodyErrorResponse(error: unknown) {
  if (error instanceof RequestBodyError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return null
}
`);

write("lib/security/rate-limit.ts", `import 'server-only'

import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/orcaly-security'

type RateLimitOptions = {
  scope: string
  limit: number
  windowSeconds: number
  identity?: string
  failOpen?: boolean
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Rate limit sem configuracao segura do Supabase.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function keyFor(scope: string, identity: string) {
  return createHash('sha256')
    .update(\`orcaly-rate-limit:v1:\${scope}:\${identity}\`)
    .digest('hex')
}

export async function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
) {
  const identity = String(options.identity || getClientIp(request) || 'unknown')
  const key = keyFor(options.scope, identity)

  try {
    const { data, error } = await adminClient().rpc('orcaly_consume_rate_limit', {
      p_key: key,
      p_limit: Math.max(1, Math.floor(options.limit)),
      p_window_seconds: Math.max(1, Math.floor(options.windowSeconds)),
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    const allowed = row?.allowed === true
    const remaining = Math.max(0, Number(row?.remaining || 0))
    const resetAt = row?.reset_at ? new Date(row.reset_at) : null
    const retryAfter = resetAt
      ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
      : options.windowSeconds

    if (!allowed) {
      const response = NextResponse.json(
        { error: 'Muitas tentativas. Aguarde e tente novamente.' },
        { status: 429 },
      )
      response.headers.set('Retry-After', String(retryAfter))
      response.headers.set('X-RateLimit-Remaining', '0')
      return response
    }

    return null
  } catch (error) {
    console.error(
      'orcaly_rate_limit_error',
      error instanceof Error ? error.message : error,
    )

    if (options.failOpen) return null

    return NextResponse.json(
      { error: 'Protecao temporariamente indisponivel.' },
      { status: 503 },
    )
  }
}
`);

write("lib/payments/checkout-validation.ts", `import 'server-only'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function text(value: unknown, max: number) {
  const result = String(value || '').trim()
  if (result.length > max) {
    throw Object.assign(new Error('Um campo do checkout excedeu o tamanho permitido.'), {
      status: 400,
    })
  }
  return result
}

function number(value: unknown, min: number, max: number, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error(\`\${label} invalida.\`), { status: 400 })
  }
  return parsed
}

export function validateCheckoutPayload(
  value: unknown,
  options: { requireCustomer: boolean },
) {
  const body = record(value)
  const items = Array.isArray(body.items) ? body.items : []

  if (!items.length || items.length > 50) {
    throw Object.assign(
      new Error('O carrinho deve ter entre 1 e 50 itens.'),
      { status: 400 },
    )
  }

  for (const raw of items) {
    const item = record(raw)
    text(item.productId, 100)
    const quantity = number(item.quantity ?? 1, 1, 100, 'Quantidade')

    if (!Number.isInteger(quantity)) {
      throw Object.assign(new Error('A quantidade deve ser inteira.'), {
        status: 400,
      })
    }

    text(item.variationId, 160)
    text(item.observation, 1000)

    if (Array.isArray(item.addonIds) && item.addonIds.length > 50) {
      throw Object.assign(new Error('Muitos adicionais no mesmo item.'), {
        status: 400,
      })
    }

    const selections = record(item.optionSelections)
    if (Object.keys(selections).length > 30) {
      throw Object.assign(new Error('Muitas opcoes no mesmo item.'), {
        status: 400,
      })
    }
  }

  text(body.couponCode, 64)

  const delivery = record(body.delivery)
  const deliveryType = String(delivery.type || 'pickup')

  if (!['pickup', 'delivery'].includes(deliveryType)) {
    throw Object.assign(new Error('Tipo de entrega invalido.'), { status: 400 })
  }

  text(delivery.zoneId, 100)
  text(delivery.address, 500)
  text(delivery.complement, 300)
  text(delivery.reference, 300)

  if (!options.requireCustomer) return

  const customer = record(body.customer)
  const name = text(customer.name, 140)
  const email = text(customer.email, 254).toLowerCase()
  text(customer.phone, 40)
  const document = String(customer.cpfCnpj || '').replace(/\\D/g, '')

  if (name.length < 2) {
    throw Object.assign(new Error('Informe o nome do cliente.'), { status: 400 })
  }

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    throw Object.assign(new Error('Informe um e-mail valido.'), { status: 400 })
  }

  if (![11, 14].includes(document.length)) {
    throw Object.assign(new Error('Informe um CPF ou CNPJ valido.'), { status: 400 })
  }

  text(customer.postalCode, 20)
  text(customer.addressNumber, 30)
  text(customer.addressComplement, 300)
}
`);

write("proxy.ts", `import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, isReservedSubdomain } from './lib/orcaly-security'
import { getRootDomain } from './lib/company-url'

type CookieToSet = {
  name: string
  value: string
  options?: any
}

function cleanHost(host: string) {
  return host.split(':')[0].toLowerCase()
}

function getSubdomain(hostname: string, rootDomain: string) {
  const host = cleanHost(hostname)

  if (host === rootDomain) return null
  if (host === \`www.\${rootDomain}\`) return null

  if (host.endsWith(\`.\${rootDomain}\`)) {
    return host.replace(\`.\${rootDomain}\`, '').split('.').pop() || null
  }

  return null
}

function applyCookies(response: NextResponse, cookies: CookieToSet[]) {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }
  return response
}

function secureResponse(
  response: NextResponse,
  request: NextRequest,
  cookies: CookieToSet[],
) {
  return applySecurityHeaders(applyCookies(response, cookies), request)
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const host = request.headers.get('host') || ''
  const rootDomain = getRootDomain()
  const subdomain = getSubdomain(host, rootDomain)
  const sensitivePage =
    pathname === '/painel' ||
    pathname.startsWith('/painel/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  const cookiesToSet: CookieToSet[] = []

  if (sensitivePage) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return secureResponse(
        NextResponse.json(
          { error: 'Autenticacao indisponivel.' },
          { status: 503 },
        ),
        request,
        cookiesToSet,
      )
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          for (const cookie of cookies) {
            request.cookies.set(cookie.name, cookie.value)
            cookiesToSet.push(cookie)
          }
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.searchParams.set('next', \`\${pathname}\${request.nextUrl.search}\`)
      return secureResponse(
        NextResponse.redirect(login),
        request,
        cookiesToSet,
      )
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const email = String(user.email || '').toLowerCase()
      const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('ativo', true)
        .ilike('email', email)
        .maybeSingle()

      if (!admin?.id) {
        const panel = request.nextUrl.clone()
        panel.pathname = '/painel/inicio'
        panel.search = ''
        return secureResponse(
          NextResponse.redirect(panel),
          request,
          cookiesToSet,
        )
      }
    }
  }

  const shouldRewriteSubdomain =
    subdomain &&
    !isReservedSubdomain(subdomain) &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')

  if (shouldRewriteSubdomain) {
    url.pathname = \`/site/\${subdomain}\`
    return secureResponse(
      NextResponse.rewrite(url),
      request,
      cookiesToSet,
    )
  }

  return secureResponse(
    NextResponse.next({ request }),
    request,
    cookiesToSet,
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)',
  ],
}
`);

write("lib/admin-auth.ts", `import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'invalid-service-role'

export const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type AdminSession = {
  id: string
  email: string
  nome: string
  role: 'super_admin' | 'admin' | 'suporte'
  permissions: Record<string, unknown>
}

export type RequireAdminOk = AdminSession & {
  ok: true
  supabaseAdmin: typeof supabaseAdmin
}

export type RequireAdminError = {
  ok: false
  error: string
  status: number
}

export async function getCurrentAdmin(
  request: NextRequest,
): Promise<AdminSession | null> {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\\s+/i, '')
    .trim()

  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user?.email) return null

  const email = data.user.email.toLowerCase()
  const { data: admin, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('email,nome,role,ativo,permissions')
    .eq('ativo', true)
    .ilike('email', email)
    .maybeSingle()

  if (adminError || !admin) return null

  return {
    id: data.user.id,
    email,
    nome: admin.nome || 'Admin',
    role: admin.role,
    permissions:
      admin.permissions &&
      typeof admin.permissions === 'object' &&
      !Array.isArray(admin.permissions)
        ? admin.permissions
        : {},
  }
}

export function can(admin: AdminSession, permission: string) {
  if (admin.role === 'super_admin') return true
  if (admin.permissions?.all === true) return true
  return admin.permissions?.[permission] === true
}

export async function requireAdmin(
  request: NextRequest,
  permission?: string,
): Promise<RequireAdminOk | RequireAdminError> {
  const admin = await getCurrentAdmin(request)

  if (!admin) {
    return { ok: false, error: 'Acesso negado.', status: 403 }
  }

  if (permission && !can(admin, permission)) {
    return { ok: false, error: 'Sem permissao para esta acao.', status: 403 }
  }

  return { ...admin, ok: true, supabaseAdmin }
}

export async function auditLog(
  adminEmail: string,
  action: string,
  targetType?: string,
  targetId?: string,
  targetLabel?: string,
  payload?: unknown,
) {
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: adminEmail,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    target_label: targetLabel || null,
    payload:
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : {},
  })
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}
`);

write("lib/company-access.ts", `import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export type CurrentRole =
  | 'dono'
  | 'gerente'
  | 'atendente'
  | 'producao'
  | 'super_admin'
  | 'funcionario'

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variaveis do Supabase nao configuradas no servidor.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function isUuid(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

export async function getRequester(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\\s+/i, '')
    .trim()

  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) return null
  return data.user
}

export function assinaturaEstaAtiva(company: Record<string, unknown> | null) {
  if (!company) return false
  if (company.assinatura_status !== 'ativa') return false
  if (!company.assinatura_expira_em) return true
  return new Date(String(company.assinatura_expira_em)) > new Date()
}

export function permissionsByRole(
  role: CurrentRole | null,
  isAdminMaster = false,
) {
  const value = String(role || '').toLowerCase()
  const isOwner = value === 'dono'
  const isManager = value === 'gerente'
  const isAttendant = value === 'atendente'
  const isProduction = value === 'producao'

  return {
    isOwner,
    isAdminMaster,
    canManage: isAdminMaster || isOwner || isManager,
    canFinance: isAdminMaster || isOwner || isManager,
    canConfig: isAdminMaster || isOwner,
    canProducts: isAdminMaster || isOwner || isManager || isProduction,
    canProposal: isAdminMaster || isOwner || isManager || isAttendant,
    canSubscription: isAdminMaster || isOwner || isManager,
    canProduction: isAdminMaster || isOwner || isManager || isProduction,
  }
}

async function getAdminRole(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email?: string | null,
) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('role,ativo')
    .eq('ativo', true)
    .ilike('email', normalized)
    .maybeSingle()

  if (error) throw error
  return data?.role || null
}

export async function getCompanyAccess(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email?: string | null,
) {
  const adminRole = await getAdminRole(supabaseAdmin, email)
  const isAdminMaster = adminRole === 'super_admin'

  if (!isUuid(userId)) {
    return {
      company: null,
      role: null,
      ...permissionsByRole(null, isAdminMaster),
    }
  }

  const { data: ownerCompany, error: ownerError } = await supabaseAdmin
    .from('companies')
    .select('*')
    .or(\`owner_id.eq.\${userId},tester_id.eq.\${userId}\`)
    .limit(1)
    .maybeSingle()

  if (ownerError) throw ownerError

  if (ownerCompany?.id) {
    const role: CurrentRole = isAdminMaster ? 'super_admin' : 'dono'
    return {
      company: ownerCompany,
      role,
      ...permissionsByRole(role, isAdminMaster),
    }
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('company_members')
    .select('company_id,cargo,status')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle()

  if (memberError) throw memberError

  if (member?.company_id && isUuid(member.company_id)) {
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError

    const role = (member.cargo || 'funcionario') as CurrentRole
    return {
      company,
      role: isAdminMaster ? 'super_admin' : role,
      ...permissionsByRole(role, isAdminMaster),
    }
  }

  if (isAdminMaster) {
    const { data: adminCompany, error: adminCompanyError } =
      await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('slug', 'grafica-flash')
        .maybeSingle()

    if (adminCompanyError) throw adminCompanyError

    if (adminCompany?.id) {
      return {
        company: adminCompany,
        role: 'super_admin' as CurrentRole,
        ...permissionsByRole('dono', true),
      }
    }
  }

  return {
    company: null,
    role: null,
    ...permissionsByRole(null, isAdminMaster),
  }
}
`);

{
  const relative = "lib/mercado-pago.ts";
  let current = read(relative);
  const start = current.indexOf("export function verifyMercadoPagoWebhookSignature");
  const end = current.indexOf("export function mapMercadoPagoStatus", start);

  if (start < 0 || end < 0) {
    throw new Error(`Funcao de webhook nao encontrada em ${relative}`);
  }

  const hardened = `export function verifyMercadoPagoWebhookSignature(options: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string | undefined;
  toleranceSeconds?: number;
}) {
  const {
    xSignature,
    xRequestId,
    dataId,
    secret,
    toleranceSeconds = 600,
  } = options;

  if (!secret || !xSignature || !xRequestId || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const ts = String(parts.ts || "");
  const v1 = String(parts.v1 || "");

  if (!/^\\d{10,13}$/.test(ts) || !/^[a-f0-9]{64}$/i.test(v1)) {
    return false;
  }

  const timestamp = Number(ts);
  const timestampMs = ts.length >= 13 ? timestamp : timestamp * 1000;

  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > toleranceSeconds * 1000
  ) {
    return false;
  }

  const manifest =
    \`id:\${dataId};request-id:\${xRequestId};ts:\${ts};\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(v1, "hex"),
    );
  } catch {
    return false;
  }
}

`;

  current = current.slice(0, start) + hardened + current.slice(end);
  if (!current.includes(MARKER)) {
    current = current.replace(
      'import "server-only";',
      `import "server-only";\n// ${MARKER}`,
    );
  }
  write(relative, current);
}

{
  const relative = "lib/payments/checkout-service.ts";
  let current = read(relative);

  if (!current.includes("@/lib/payments/checkout-validation")) {
    current = current.replace(
      'import "server-only";',
      `import "server-only";\nimport { validateCheckoutPayload } from "@/lib/payments/checkout-validation";`,
    );
  }

  if (!current.includes("ORCALY_CHECKOUT_VALIDATION_V1")) {
    current = current.replace(
      /async function calculateCheckout\(\s*slug: string,\s*body: CheckoutBody,\s*\): Promise<CheckoutCalculation> \{/m,
      (match) =>
        `${match}\n  // ORCALY_CHECKOUT_VALIDATION_V1\n  validateCheckoutPayload(body, { requireCustomer: false });`,
    );

    current = current.replace(
      /export async function createCheckoutPayment\(\s*slug: string,\s*body: CheckoutBody,\s*request: NextRequest,\s*\) \{/m,
      (match) =>
        `${match}\n  validateCheckoutPayload(body, { requireCustomer: true });`,
    );
  }

  write(relative, current);
}

write("app/api/checkout/[slug]/route.ts", `import { NextRequest, NextResponse } from 'next/server'
import {
  createCheckoutPayment,
  getCheckoutCatalog,
} from '@/lib/payments/checkout-service'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

type Context = {
  params: Promise<{ slug: string }>
}

function errorStatus(error: unknown) {
  return Number(
    error && typeof error === 'object' && 'status' in error
      ? (error as { status?: number }).status || 500
      : 500,
  )
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: \`checkout-catalog:\${slug}\`,
      limit: 120,
      windowSeconds: 60,
      failOpen: true,
    })
    if (blocked) return blocked

    return NextResponse.json(await getCheckoutCatalog(slug))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel carregar o checkout.',
      },
      { status: errorStatus(error) },
    )
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: \`checkout-create:\${slug}\`,
      limit: 8,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const idempotencyKey = String(
      request.headers.get('idempotency-key') || '',
    ).trim()

    if (
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      return NextResponse.json(
        { error: 'Chave de idempotencia invalida.' },
        { status: 400 },
      )
    }

    const body = await readJsonBody(request, 160 * 1024)
    return NextResponse.json(
      await createCheckoutPayment(slug, body as never, request),
    )
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel criar o pagamento.',
      },
      { status: errorStatus(error) },
    )
  }
}
`);

write("app/api/checkout/[slug]/prepare/route.ts", `import { NextRequest, NextResponse } from 'next/server'
import { prepareCheckoutPayment } from '@/lib/payments/checkout-service'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

type Context = {
  params: Promise<{ slug: string }>
}

function statusFor(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status?: number }).status || 500)
  }

  return 500
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: \`checkout-prepare:\${slug}\`,
      limit: 35,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const body = await readJsonBody(request, 128 * 1024)
    return NextResponse.json(
      await prepareCheckoutPayment(slug, body as never),
    )
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel calcular o checkout.',
      },
      { status: statusFor(error) },
    )
  }
}
`);

write("app/api/checkout/[slug]/status/route.ts", `import { NextRequest, NextResponse } from 'next/server'
import { getCheckoutPaymentStatus } from '@/lib/payments/checkout-service'
import { enforceRateLimit } from '@/lib/security/rate-limit'

type Context = {
  params: Promise<{ slug: string }>
}

function statusFor(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status?: number }).status || 500)
  }

  return 500
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params
    const blocked = await enforceRateLimit(request, {
      scope: \`checkout-status:\${slug}\`,
      limit: 90,
      windowSeconds: 60,
      failOpen: true,
    })
    if (blocked) return blocked

    const paymentId = String(
      request.nextUrl.searchParams.get('paymentId') || '',
    ).trim()

    if (!/^\\d{1,32}$/.test(paymentId)) {
      return NextResponse.json(
        { error: 'Pagamento invalido.' },
        { status: 400 },
      )
    }

    return NextResponse.json(
      await getCheckoutPaymentStatus(slug, paymentId),
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel consultar o pagamento.',
      },
      { status: statusFor(error) },
    )
  }
}
`);

{
  const relative = "app/api/marketplace/coupon/route.ts";
  let current = read(relative);

  if (!current.includes("ORCALY_COUPON_SECURITY_V1")) {
    current = current.replace(
      "import { createClient } from '@supabase/supabase-js'",
      `import { createClient } from '@supabase/supabase-js'\nimport { requireSameOrigin } from '@/lib/orcaly-security'\nimport { enforceRateLimit } from '@/lib/security/rate-limit'\nimport { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'\n\n// ORCALY_COUPON_SECURITY_V1`,
    );

    current = current.replace(
      "    const body = await request.json()",
      `    const originError = requireSameOrigin(request)\n    if (originError) return originError\n\n    const blocked = await enforceRateLimit(request, {\n      scope: 'marketplace-coupon',\n      limit: 30,\n      windowSeconds: 60,\n    })\n    if (blocked) return blocked\n\n    const body = await readJsonBody<any>(request, 64 * 1024)`,
    );

    current = current.replace(
      "  } catch (error) {\n    const message = error instanceof Error ? error.message : 'Erro ao validar cupom.'",
      `  } catch (error) {\n    const bodyError = requestBodyErrorResponse(error)\n    if (bodyError) return bodyError\n\n    const message = error instanceof Error ? error.message : 'Erro ao validar cupom.'`,
    );
  }

  write(relative, current);
}

write("app/api/security/report/route.ts", `import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getClientIp,
  getSafeUserAgent,
} from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'

const text = (value: unknown) => String(value || '').slice(0, 2000)

function trimDeep(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[limite]'

  if (typeof value === 'string') return value.slice(0, 2000)
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => trimDeep(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [
          key.slice(0, 100),
          trimDeep(item, depth + 1),
        ]),
    )
  }

  return value
}

function allowedDocumentUri(value: string, request: NextRequest) {
  if (!value) return false

  try {
    const documentUrl = new URL(value)
    const requestHost = String(request.headers.get('host') || '').split(':')[0]
    const root = String(
      process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br',
    ).toLowerCase()
    const host = documentUrl.hostname.toLowerCase()

    return (
      documentUrl.protocol === 'https:' &&
      (host === requestHost ||
        host === root ||
        host.endsWith(\`.\${root}\`))
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new NextResponse(null, { status: 204 })
    }

    const blocked = await enforceRateLimit(request, {
      scope: 'csp-report',
      limit: 15,
      windowSeconds: 300,
    })
    if (blocked) return blocked

    const contentType = String(
      request.headers.get('content-type') || '',
    ).toLowerCase()

    if (
      !contentType.includes('application/csp-report') &&
      !contentType.includes('application/reports+json') &&
      !contentType.includes('application/json')
    ) {
      return new NextResponse(null, { status: 415 })
    }

    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > 64 * 1024) {
      return new NextResponse(null, { status: 413 })
    }

    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > 64 * 1024) {
      return new NextResponse(null, { status: 413 })
    }

    const body = JSON.parse(raw || '{}')
    const first = Array.isArray(body) ? body[0] || {} : body
    const report =
      first['csp-report'] ||
      first.body ||
      first

    const blockedUri = text(
      report['blocked-uri'] || report.blockedURI,
    )
    const documentUri = text(
      report['document-uri'] ||
        report.documentURI ||
        report.url,
    )
    const violatedDirective = text(
      report['violated-directive'] ||
        report.violatedDirective ||
        report.effectiveDirective,
    )

    if (!allowedDocumentUri(documentUri, request)) {
      return new NextResponse(null, { status: 202 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    await supabaseAdmin.from('security_events').insert({
      event_type: 'csp_violation',
      severity:
        violatedDirective.includes('script') ? 'media' : 'baixa',
      source: 'browser',
      path: documentUri.slice(0, 1000),
      method: request.method,
      ip: getClientIp(request),
      user_agent: getSafeUserAgent(request),
      description: \`CSP report: \${violatedDirective || 'diretiva nao informada'}\`,
      metadata: trimDeep({
        blocked_uri: blockedUri,
        document_uri: documentUri,
        violated_directive: violatedDirective,
      }),
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 202 })
  }
}
`);

write("app/api/public-site/[slug]/route.ts", `import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getDefaultSiteSettingsForBusiness,
  getSiteTemplateByBusinessType,
  normalizeSectionList,
} from '@/lib/site-templates'
import { enforceRateLimit } from '@/lib/security/rate-limit'

type RouteContext = {
  params: Promise<{ slug: string }>
}

type PublicCompanyRow = Record<string, unknown> & {
  id: string
  ativo?: boolean | null
  site_publico_ativo?: boolean | null
  business_type?: string | null
  site_template?: string | null
  modelo_negocio?: string | null
  site_theme?: string | null
  site_primary_color?: string | null
  site_accent_color?: string | null
  site_headline?: string | null
  site_subheadline?: string | null
  site_cta_label?: string | null
  site_cta_text?: string | null
  site_about_title?: string | null
  site_about_text?: string | null
  site_sections?: unknown
  site_benefits?: unknown
  site_faq?: unknown
  site_features?: unknown
  site_payment_methods?: unknown
  site_delivery_options?: unknown
}

type PublicProductRow = Record<string, unknown>

function arr(value: unknown) {
  return Array.isArray(value) ? value : []
}

function productImages(product: Record<string, unknown>) {
  const images = Array.isArray(product.image_urls)
    ? product.image_urls.filter(Boolean).slice(0, 4)
    : []
  const legacy =
    typeof product.imagem_url === 'string' && product.imagem_url
      ? [product.imagem_url]
      : []

  return images.length ? images : legacy
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const cleanSlug = String(slug || '').trim().slice(0, 80)

    if (!cleanSlug) {
      return NextResponse.json(
        { error: 'Empresa nao informada.' },
        { status: 400 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: \`public-site:\${cleanSlug}\`,
      limit: 180,
      windowSeconds: 60,
      failOpen: true,
    })
    if (blocked) return blocked

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const companyFields = [
      'id',
      'nome',
      'slug',
      'subdomain_slug',
      'logo_url',
      'whatsapp',
      'instagram',
      'cidade',
      'estado',
      'segmento',
      'modelo_negocio',
      'modelo_nome',
      'atendimento_horario',
      'atendimento_observacao',
      'marketplace_ativo',
      'marketplace_titulo',
      'marketplace_subtitulo',
      'marketplace_banner_url',
      'marketplace_texto_botao',
      'marketplace_sobre',
      'marketplace_endereco',
      'marketplace_mapa_url',
      'site_publico_ativo',
      'site_template',
      'site_theme',
      'site_layout',
      'site_art_style',
      'site_font_style',
      'site_button_style',
      'site_hero_alignment',
      'site_primary_color',
      'site_accent_color',
      'site_background_color',
      'site_text_color',
      'site_card_color',
      'site_badge_text',
      'site_headline',
      'site_subheadline',
      'site_cta_text',
      'site_cta_label',
      'site_secondary_cta_text',
      'site_banner_url',
      'site_whatsapp_message',
      'site_about_title',
      'site_about_text',
      'site_services_title',
      'site_contact_title',
      'site_show_store',
      'site_show_about',
      'site_show_contact',
      'site_show_featured',
      'site_show_faq',
      'site_show_testimonials',
      'site_show_gallery',
      'site_show_benefits',
      'site_features',
      'site_faq',
      'site_testimonials',
      'site_gallery',
      'site_benefits',
      'site_custom_sections',
      'site_promo_title',
      'site_promo_text',
      'site_promo_active',
      'site_promo_button_text',
      'site_business_hours',
      'site_payment_methods',
      'site_delivery_options',
      'site_sections',
      'business_type',
      'ativo',
    ].join(',')

    const { data: rawCompany, error: companyError } =
      await supabaseAdmin
        .from('companies')
        .select(companyFields)
        .or(\`slug.eq.\${cleanSlug},subdomain_slug.eq.\${cleanSlug}\`)
        .maybeSingle()

    if (companyError) throw companyError

    const company =
      rawCompany as unknown as PublicCompanyRow | null

    if (
      !company ||
      company.ativo === false ||
      company.site_publico_ativo === false
    ) {
      return NextResponse.json(
        { error: 'Site nao encontrado.' },
        { status: 404 },
      )
    }

    const template = getSiteTemplateByBusinessType(
      company.business_type ||
        company.site_template ||
        company.modelo_negocio,
    )
    const defaults = getDefaultSiteSettingsForBusiness(
      template.businessType,
    )

    const productFields = [
      'id',
      'nome',
      'descricao',
      'descricao_curta',
      'descricao_detalhada',
      'categoria',
      'subcategoria',
      'tipo',
      'unidade',
      'unidade_label',
      'preco',
      'preco_promocional',
      'promocao_ativa',
      'preco_sob_consulta',
      'imagem_url',
      'image_urls',
      'video_url',
      'destaque',
      'ativo',
      'available',
      'is_active',
      'estoque',
      'extras',
      'configuracoes',
      'variacoes',
      'variations',
      'adicionais',
      'addons',
      'created_at',
    ].join(',')

    const { data: rawProducts, error: productError } =
      await supabaseAdmin
        .from('products')
        .select(productFields)
        .eq('company_id', company.id)
        .or('ativo.is.null,ativo.eq.true')
        .order('destaque', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

    if (productError) throw productError

    const products =
      (rawProducts || []) as unknown as PublicProductRow[]

    const [
      zonesResult,
      paymentMethodsResult,
      businessHoursResult,
      paymentSettingsResult,
      couponsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('delivery_zones')
        .select(
          'id,name,fee,minimum_order,estimated_time_min,estimated_time_max,is_active,notes',
        )
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('payment_methods')
        .select(
          'id,name,type,is_active,requires_change,allow_delivery_payment,allow_online_payment,instructions',
        )
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('business_hours')
        .select(
          'weekday,is_open,open_time,close_time,break_start,break_end,closed_message',
        )
        .eq('company_id', company.id)
        .order('weekday', { ascending: true }),
      supabaseAdmin
        .from('marketplace_payment_settings')
        .select(
          'onboarding_status,account_status,is_active,charges_enabled,pix_enabled,card_enabled,public_key,last_error',
        )
        .eq('company_id', company.id)
        .eq('provider', 'mercado_pago')
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_coupons')
        .select(
          'id,codigo,descricao,tipo,coupon_type,free_delivery,valor,valor_minimo_pedido,valor_maximo_desconto,starts_at,ends_at,usage_limit,used_count,created_at',
        )
        .eq('company_id', company.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const now = Date.now()
    const publicCoupons = (
      couponsResult.error ? [] : couponsResult.data || []
    )
      .filter((coupon) => {
        const starts = coupon.starts_at
          ? new Date(coupon.starts_at).getTime()
          : 0
        const ends = coupon.ends_at
          ? new Date(coupon.ends_at).getTime()
          : 0
        const used = Number(coupon.used_count || 0)
        const limit =
          coupon.usage_limit == null
            ? null
            : Number(coupon.usage_limit)

        return !(
          (starts && starts > now) ||
          (ends && ends < now) ||
          (limit !== null && used >= limit)
        )
      })
      .slice(0, 8)

    const setting = paymentSettingsResult.error
      ? null
      : paymentSettingsResult.data
    const connected = Boolean(
      setting?.is_active === true &&
        setting?.onboarding_status === 'connected' &&
        setting?.public_key,
    )

    const normalizedCompany = {
      ...company,
      business_type: company.business_type || template.businessType,
      site_template: company.site_template || template.templateId,
      site_theme: company.site_theme || defaults.site_theme,
      site_primary_color:
        company.site_primary_color || defaults.site_primary_color,
      site_accent_color:
        company.site_accent_color || defaults.site_accent_color,
      site_headline:
        company.site_headline || defaults.site_headline,
      site_subheadline:
        company.site_subheadline || defaults.site_subheadline,
      site_cta_label:
        company.site_cta_label ||
        company.site_cta_text ||
        defaults.site_cta_label,
      site_about_title:
        company.site_about_title || defaults.site_about_title,
      site_about_text:
        company.site_about_text || defaults.site_about_text,
      site_sections: normalizeSectionList(
        company.site_sections,
        template.sections,
      ),
      site_benefits: arr(company.site_benefits).length
        ? company.site_benefits
        : defaults.site_benefits,
      site_faq: arr(company.site_faq).length
        ? company.site_faq
        : defaults.site_faq,
      site_features: arr(company.site_features).length
        ? company.site_features
        : defaults.site_features,
      site_payment_methods: arr(company.site_payment_methods).length
        ? company.site_payment_methods
        : defaults.site_payment_methods,
      site_delivery_options: arr(company.site_delivery_options).length
        ? company.site_delivery_options
        : defaults.site_delivery_options,
      marketplace_coupons: publicCoupons,
      marketplace_payment_provider: connected
        ? 'mercado_pago'
        : null,
      marketplace_payment_online_enabled: connected,
      marketplace_payment_pix_enabled:
        connected && setting?.pix_enabled !== false,
      marketplace_payment_card_enabled:
        connected && setting?.card_enabled !== false,
      unified_checkout_enabled: connected,
    }

    return NextResponse.json({
      company: normalizedCompany,
      products: products.map((product) => {
        const images = productImages(product)

        return {
          ...product,
          imagem_url:
            typeof product.imagem_url === 'string'
              ? product.imagem_url
              : images[0] || null,
          image_urls: images,
          available: product.available !== false,
          addons: arr(product.addons),
          variations: arr(product.variations),
          extras:
            product.extras &&
            typeof product.extras === 'object' &&
            !Array.isArray(product.extras)
              ? product.extras
              : {},
        }
      }),
      delivery_zones: zonesResult.error
        ? []
        : zonesResult.data || [],
      payment_methods: paymentMethodsResult.error
        ? []
        : paymentMethodsResult.data || [],
      business_hours: businessHoursResult.error
        ? []
        : businessHoursResult.data || [],
      template,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao carregar site.',
      },
      { status: 500 },
    )
  }
}
`);

{
  const relative = "app/site/[slug]/page.tsx";
  let current = read(relative);
  current = current.replace(
    ".from('companies')\n      .select('*')",
    `.from('companies')\n      .select('nome,slug,subdomain_slug,logo_url,marketplace_banner_url,site_banner_url,banner_url,site_subheadline,site_about_text')`,
  );
  write(relative, current);
}

write("app/api/public/uploads/art/route.ts", `import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'

const BUCKET = 'artes'
const MAX_SIZE = 10 * 1024 * 1024

const ALLOWED = {
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': {
    extension: 'png',
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
} as const

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte)
}

function validMagic(bytes: Uint8Array, type: keyof typeof ALLOWED) {
  if (!ALLOWED[type].signatures.some((signature) => startsWith(bytes, signature))) {
    return false
  }

  if (type === 'image/webp') {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const blocked = await enforceRateLimit(request, {
      scope: 'public-art-upload',
      limit: 5,
      windowSeconds: 600,
    })
    if (blocked) return blocked

    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > MAX_SIZE + 128 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande.' },
        { status: 413 },
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    const slug = String(form.get('slug') || '').trim().slice(0, 80)

    if (!(file instanceof File) || !slug) {
      return NextResponse.json(
        { error: 'Arquivo ou empresa nao informado.' },
        { status: 400 },
      )
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Envie um arquivo de ate 10 MB.' },
        { status: 400 },
      )
    }

    if (!(file.type in ALLOWED)) {
      return NextResponse.json(
        { error: 'Use JPG, PNG, WEBP ou PDF.' },
        { status: 400 },
      )
    }

    const type = file.type as keyof typeof ALLOWED
    const bytes = new Uint8Array(await file.arrayBuffer())

    if (!validMagic(bytes, type)) {
      return NextResponse.json(
        { error: 'O conteudo do arquivo nao corresponde ao formato informado.' },
        { status: 400 },
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id,ativo')
      .or(\`slug.eq.\${slug},subdomain_slug.eq.\${slug}\`)
      .eq('ativo', true)
      .maybeSingle()

    if (companyError) throw companyError
    if (!company?.id) {
      return NextResponse.json(
        { error: 'Empresa nao encontrada.' },
        { status: 404 },
      )
    }

    const extension = ALLOWED[type].extension
    const now = new Date()
    const path = [
      String(company.id),
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      \`\${randomUUID()}.\${extension}\`,
    ].join('/')

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), {
        contentType: type,
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path)

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      path,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao enviar arquivo.',
      },
      { status: 500 },
    )
  }
}
`);

const apiRoutes = walk(full("app/api")).filter((file) => file.endsWith("route.ts"));
const artRoutes = apiRoutes.filter((file) => {
  const content = fs.readFileSync(file, "utf8");
  return (
    content.includes("art_approval_requests") &&
    content.includes(".eq('token', token)")
  );
});

for (const file of artRoutes) {
  const relative = path.relative(root, file).replaceAll("\\\\", "/");
  write(relative, `import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

type Context = {
  params: Promise<{ token: string }>
}

type ArtApprovalPublicRow = {
  id: string
  company_id: string
  order_id: string | null
  title?: string | null
  produto_nome?: string | null
  cliente_nome?: string | null
  artwork_url?: string | null
  preview_url?: string | null
  instructions?: string | null
  status: string
  comentario_cliente?: string | null
  approved_at?: string | null
  requested_changes_at?: string | null
  responded_at?: string | null
  expires_at: string
  created_at: string
  companies?: {
    nome?: string | null
    logo_url?: string | null
    whatsapp?: string | null
    cor_principal?: string | null
  } | null
}

function cleanToken(value: unknown) {
  const token = String(value || '').trim()
  return /^[a-f0-9]{24,128}$/i.test(token) ? token : ''
}

const publicFields = [
  'id',
  'company_id',
  'order_id',
  'title',
  'produto_nome',
  'cliente_nome',
  'artwork_url',
  'preview_url',
  'instructions',
  'status',
  'comentario_cliente',
  'approved_at',
  'requested_changes_at',
  'responded_at',
  'expires_at',
  'created_at',
  'companies(nome,logo_url,whatsapp,cor_principal)',
].join(',')

export async function GET(request: NextRequest, context: Context) {
  try {
    const { token: rawToken } = await context.params
    const token = cleanToken(rawToken)

    if (!token) {
      return NextResponse.json(
        { error: 'Link invalido.' },
        { status: 404 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: \`art-approval-read:\${token}\`,
      limit: 30,
      windowSeconds: 300,
      failOpen: true,
    })
    if (blocked) return blocked

    const supabaseAdmin = getSupabaseAdmin()
    const { data: rawData, error } = await supabaseAdmin
      .from('art_approval_requests')
      .select(publicFields)
      .eq('token', token)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) throw error

    const data =
      rawData as unknown as ArtApprovalPublicRow | null

    if (!data) {
      return NextResponse.json(
        { error: 'Link expirado, revogado ou inexistente.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ request: data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao carregar aprovacao.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const { token: rawToken } = await context.params
    const token = cleanToken(rawToken)

    if (!token) {
      return NextResponse.json(
        { error: 'Link invalido.' },
        { status: 404 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: \`art-approval-write:\${token}\`,
      limit: 8,
      windowSeconds: 600,
    })
    if (blocked) return blocked

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      32 * 1024,
    )
    const action =
      body.action === 'request_changes'
        ? 'request_changes'
        : body.action === 'approve'
          ? 'approve'
          : ''
    const comment = String(body.comment || '').trim().slice(0, 2000)

    if (!action) {
      return NextResponse.json(
        { error: 'Acao invalida.' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const update =
      action === 'approve'
        ? {
            status: 'Arte aprovada',
            comentario_cliente: comment || null,
            approved_at: now,
            responded_at: now,
            updated_at: now,
          }
        : {
            status: 'Alteracao solicitada',
            comentario_cliente:
              comment || 'Cliente solicitou alteracao.',
            requested_changes_at: now,
            responded_at: now,
            updated_at: now,
          }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: rawData, error } = await supabaseAdmin
      .from('art_approval_requests')
      .update(update)
      .eq('token', token)
      .is('responded_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .select(publicFields)
      .maybeSingle()

    if (error) throw error

    const data =
      rawData as unknown as ArtApprovalPublicRow | null

    if (!data) {
      return NextResponse.json(
        { error: 'Link ja utilizado, expirado ou revogado.' },
        { status: 409 },
      )
    }

    if (data.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({
          status:
            action === 'approve'
              ? 'Arte aprovada'
              : 'Alteracao solicitada',
          updated_at: now,
        })
        .eq('id', data.order_id)
        .eq('company_id', data.company_id)
    }

    return NextResponse.json({ ok: true, request: data })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao responder aprovacao.',
      },
      { status: 500 },
    )
  }
}
`);
}

const aiRoutes = apiRoutes.filter((file) => {
  const content = fs.readFileSync(file, "utf8");
  return (
    content.includes("Transforme o pedido bagunçado") ||
    content.includes("assistente interno do Orçaly")
  );
});

for (const file of aiRoutes) {
  const relative = path.relative(root, file).replaceAll("\\\\", "/");
  let current = fs.readFileSync(file, "utf8");

  if (current.includes("ORCALY_AI_LIMITS_V1")) continue;

  current =
    `import { enforceRateLimit } from '@/lib/security/rate-limit'\n` +
    `import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'\n` +
    `// ORCALY_AI_LIMITS_V1\n` +
    current;

  const bodyNeedle = "    const body = await request.json()";
  if (!current.includes(bodyNeedle)) {
    throw new Error(`Leitura do body da IA nao encontrada em ${relative}`);
  }

  const limits = `    const plan = String(
      access.company.assinatura_plano ||
        access.company.plano ||
        'basico',
    ).toLowerCase()
    const dailyLimit =
      plan === 'premium'
        ? 600
        : plan === 'profissional'
          ? 120
          : 25

    const burstBlocked = await enforceRateLimit(request, {
      scope: 'ai-user-minute',
      identity: requester.id,
      limit: 10,
      windowSeconds: 60,
    })
    if (burstBlocked) return burstBlocked

    const dailyBlocked = await enforceRateLimit(request, {
      scope: 'ai-company-daily',
      identity: access.company.id,
      limit: dailyLimit,
      windowSeconds: 86400,
    })
    if (dailyBlocked) return dailyBlocked

    const body = await readJsonBody<any>(request, 16 * 1024)`;

  current = current.replace(bodyNeedle, limits);

  if (current.includes("const prompt = String(body.prompt || '').trim()")) {
    current = current.replace(
      "    const prompt = String(body.prompt || '').trim()",
      `    const prompt = String(body.prompt || '').trim().slice(0, 8000)`,
    );
  }

  if (current.includes("const text = String(body.text || '').trim()")) {
    current = current.replace(
      "    const text = String(body.text || '').trim()",
      `    const text = String(body.text || '').trim().slice(0, 8000)`,
    );
  }

  current = current.replace(
    /  } catch \(error\) \{\n    const message =/m,
    `  } catch (error) {\n    const bodyError = requestBodyErrorResponse(error)\n    if (bodyError) return bodyError\n\n    const message =`,
  );

  write(relative, current);
}

write("app/api/marketplace/payments/webhook/mercado-pago/route.ts", `/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { getMarketplaceWebhookSecret } from '@/lib/payments/marketplace/config'
import {
  getMercadoPagoPayment,
  mapMercadoPagoStatus,
  unprotectMercadoPagoToken,
  verifyMercadoPagoWebhookSignature,
} from '@/lib/mercado-pago'

function extractPaymentId(body: any, url: URL) {
  return String(
    body?.data?.id ||
      body?.id ||
      url.searchParams.get('data.id') ||
      url.searchParams.get('data_id') ||
      url.searchParams.get('id') ||
      '',
  )
}

function parseExternalReference(value: unknown) {
  const parts = String(value || '').split(':')
  if (parts.length === 4 && parts[0] === 'orcaly') {
    return {
      companyId: parts[1],
      orderId: parts[2],
      marketplacePaymentId: parts[3],
    }
  }

  return {
    companyId: '',
    orderId: '',
    marketplacePaymentId: '',
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const paymentId = extractPaymentId(body, url)
  const marketplacePaymentIdFromUrl = String(
    url.searchParams.get('marketplace_payment_id') || '',
  )
  const companyIdFromUrl = String(
    url.searchParams.get('company_id') || '',
  )

  try {
    const secret = getMarketplaceWebhookSecret()

    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook nao configurado.' },
        { status: 503 },
      )
    }

    const signatureOk = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId: paymentId,
      secret,
    })

    if (!signatureOk) {
      return NextResponse.json(
        { error: 'Assinatura invalida.' },
        { status: 401 },
      )
    }

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: 'Sem payment id.' })
    }

    let marketplacePayment: any = null

    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {
      const { data } = await supabaseAdmin
        .from('marketplace_payments')
        .select('*')
        .eq('id', marketplacePaymentIdFromUrl)
        .eq('company_id', companyIdFromUrl)
        .eq('provider', 'mercado_pago')
        .maybeSingle()
      marketplacePayment = data
    }

    if (!marketplacePayment) {
      const { data } = await supabaseAdmin
        .from('marketplace_payments')
        .select('*')
        .eq('provider', 'mercado_pago')
        .eq('provider_payment_id', paymentId)
        .maybeSingle()
      marketplacePayment = data
    }

    if (!marketplacePayment?.company_id) {
      return NextResponse.json({
        ok: true,
        ignored: 'Pagamento ainda nao registrado no Orcaly.',
      })
    }

    if (
      marketplacePayment.provider_payment_id &&
      String(marketplacePayment.provider_payment_id) !== paymentId
    ) {
      return NextResponse.json(
        { error: 'Pagamento divergente.' },
        { status: 409 },
      )
    }

    const { data: setting, error: settingError } = await supabaseAdmin
      .from('marketplace_payment_settings')
      .select('access_token')
      .eq('company_id', marketplacePayment.company_id)
      .eq('provider', 'mercado_pago')
      .maybeSingle()

    if (settingError) throw settingError
    if (!setting?.access_token) {
      throw new Error('Empresa sem access_token Mercado Pago.')
    }

    const mpPayment: any = await getMercadoPagoPayment(
      unprotectMercadoPagoToken(setting.access_token),
      paymentId,
    )
    const parsed = parseExternalReference(mpPayment.external_reference)

    if (
      parsed.companyId &&
      parsed.companyId !== String(marketplacePayment.company_id)
    ) {
      return NextResponse.json(
        { error: 'Empresa divergente no pagamento.' },
        { status: 409 },
      )
    }

    if (
      parsed.orderId &&
      parsed.orderId !== String(marketplacePayment.order_id)
    ) {
      return NextResponse.json(
        { error: 'Pedido divergente no pagamento.' },
        { status: 409 },
      )
    }

    if (
      parsed.marketplacePaymentId &&
      parsed.marketplacePaymentId !== String(marketplacePayment.id)
    ) {
      return NextResponse.json(
        { error: 'Transacao divergente.' },
        { status: 409 },
      )
    }

    const companyId = String(marketplacePayment.company_id)
    const orderId = String(marketplacePayment.order_id)
    const marketplacePaymentId = String(marketplacePayment.id)
    const mappedStatus = mapMercadoPagoStatus(
      String(mpPayment.status || ''),
    )
    const paidAt =
      mappedStatus === 'paid'
        ? mpPayment.date_approved || new Date().toISOString()
        : null
    const grossAmount = Number(
      mpPayment.transaction_amount ||
        marketplacePayment.amount ||
        0,
    )
    const feeDetails = Array.isArray(mpPayment.fee_details)
      ? mpPayment.fee_details
      : []
    const providerFeeAmount = feeDetails.reduce(
      (total: number, fee: any) =>
        total + Math.max(0, Number(fee?.amount || 0)),
      0,
    )
    const commissionAmount = Math.max(
      0,
      Number(marketplacePayment.commission_amount || 0),
    )
    const reportedNetAmount = Number(
      mpPayment.transaction_details?.net_received_amount || 0,
    )
    const netAmount =
      reportedNetAmount > 0
        ? reportedNetAmount
        : Math.max(
            0,
            Number(
              (
                grossAmount -
                providerFeeAmount -
                commissionAmount
              ).toFixed(2),
            ),
          )

    const { error: stockError } = await supabaseAdmin.rpc(
      'settle_marketplace_stock',
      {
        p_company_id: companyId,
        p_marketplace_payment_id: marketplacePaymentId,
        p_payment_status: mappedStatus,
        p_reason: String(mpPayment.status || mappedStatus),
      },
    )

    if (stockError) throw stockError

    await Promise.all([
      supabaseAdmin
        .from('marketplace_payments')
        .update({
          provider_payment_id: String(mpPayment.id || paymentId),
          provider_status: String(mpPayment.status || '') || null,
          status: mappedStatus,
          amount: grossAmount,
          provider_fee_amount: Number(providerFeeAmount.toFixed(2)),
          net_amount: Number(netAmount.toFixed(2)),
          raw_payload: mpPayment,
          paid_at: paidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', marketplacePaymentId)
        .eq('company_id', companyId),
      supabaseAdmin
        .from('orders')
        .update({
          payment_provider: 'mercado_pago',
          payment_status: mappedStatus,
          status:
            mappedStatus === 'paid'
              ? 'Recebido'
              : 'pending_payment',
          paid_at: paidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('company_id', companyId),
      supabaseAdmin
        .from('order_payments')
        .update({
          provider: 'mercado_pago',
          provider_payment_id: String(mpPayment.id || paymentId),
          status: mappedStatus,
          paid_amount:
            mappedStatus === 'paid'
              ? Number(mpPayment.transaction_amount || 0)
              : 0,
          remaining_amount:
            mappedStatus === 'paid'
              ? 0
              : Number(mpPayment.transaction_amount || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('company_id', companyId),
    ])

    if (mappedStatus === 'paid') {
      const { error: couponError } = await supabaseAdmin.rpc(
        'consume_marketplace_coupon',
        {
          p_company_id: companyId,
          p_order_id: orderId,
        },
      )

      if (couponError) throw couponError

      await supabaseAdmin
        .from('marketplace_commissions')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('marketplace_payment_id', marketplacePaymentId)
        .eq('company_id', companyId)
        .neq('status', 'confirmed')
    } else if (
      ['failed', 'canceled', 'refunded', 'charged_back'].includes(
        mappedStatus,
      )
    ) {
      await supabaseAdmin
        .from('marketplace_commissions')
        .update({
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('marketplace_payment_id', marketplacePaymentId)
        .eq('company_id', companyId)
        .neq('status', 'confirmed')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {
      await supabaseAdmin
        .from('marketplace_payments')
        .update({
          last_error:
            error instanceof Error
              ? error.message
              : 'Erro no webhook.',
          raw_payload: body,
        })
        .eq('id', marketplacePaymentIdFromUrl)
        .eq('company_id', companyIdFromUrl)
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro no webhook Mercado Pago.',
      },
      { status: 500 },
    )
  }
}
`);

write("app/api/assinatura/checkout/webhook/route.ts", `import { NextRequest, NextResponse } from 'next/server'
import { processSubscriptionCheckoutWebhook } from '@/lib/subscription-checkout-payment'
import { verifyMercadoPagoWebhookSignature } from '@/lib/mercado-pago'
import { getSubscriptionWebhookSecret } from '@/lib/payments/subscription/mercado-pago'

export const runtime = 'nodejs'

function paymentIdFrom(
  request: NextRequest,
  body: Record<string, unknown>,
) {
  const data =
    body.data &&
    typeof body.data === 'object' &&
    !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {}

  return String(
    data.id ||
      body.id ||
      request.nextUrl.searchParams.get('data.id') ||
      request.nextUrl.searchParams.get('id') ||
      '',
  ).trim()
}

export async function POST(request: NextRequest) {
  try {
    const secret = getSubscriptionWebhookSecret()

    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook nao configurado.' },
        { status: 503 },
      )
    }

    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>
    const paymentId = paymentIdFrom(request, body)
    const valid = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId: paymentId || null,
      secret,
    })

    if (!valid) {
      return NextResponse.json(
        { error: 'Assinatura invalida.' },
        { status: 401 },
      )
    }

    return NextResponse.json(
      await processSubscriptionCheckoutWebhook(paymentId),
    )
  } catch (error) {
    console.error(
      'orcaly_subscription_checkout_webhook_error',
      error instanceof Error ? error.message : error,
    )

    return NextResponse.json(
      { error: 'Nao foi possivel processar o webhook.' },
      { status: 500 },
    )
  }
}
`);

{
  const relative = "app/api/system/health/route.ts";
  if (fs.existsSync(full(relative))) {
    let current = read(relative);
    current = current.replace(
      "ok: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),\n        description: 'Token de checkout configurado.'",
      `ok: Boolean(\n          process.env.MP_MARKETPLACE_CLIENT_ID &&\n          process.env.MP_MARKETPLACE_CLIENT_SECRET &&\n          process.env.MP_MARKETPLACE_WEBHOOK_SECRET\n        ),\n        description: 'Credenciais e segredo do marketplace configurados.'`,
    );
    write(relative, current);
  }
}

write("supabase/migrations/20260729133000_orcaly_security_hardening.sql", `-- ORCALY_SECURITY_HARDENING_V1
begin;

create schema if not exists orcaly_private;
revoke all on schema orcaly_private from public, anon, authenticated;

create table if not exists orcaly_private.api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on orcaly_private.api_rate_limits from public, anon, authenticated;

create or replace function public.orcaly_consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) < 16 or length(p_key) > 128 then
    raise exception 'invalid rate limit key';
  end if;

  if p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'invalid rate limit window';
  end if;

  insert into orcaly_private.api_rate_limits (
    key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_key, v_now, 0, v_now)
  on conflict (key) do nothing;

  select window_started_at, request_count
    into v_window_started, v_count
  from orcaly_private.api_rate_limits
  where key = p_key
  for update;

  if v_window_started + make_interval(secs => p_window_seconds) <= v_now then
    v_window_started := v_now;
    v_count := 1;

    update orcaly_private.api_rate_limits
    set window_started_at = v_window_started,
        request_count = v_count,
        updated_at = v_now
    where key = p_key;

    return query
      select true, greatest(0, p_limit - v_count),
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  if v_count >= p_limit then
    return query
      select false, 0,
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  v_count := v_count + 1;

  update orcaly_private.api_rate_limits
  set request_count = v_count,
      updated_at = v_now
  where key = p_key;

  return query
    select true, greatest(0, p_limit - v_count),
      v_window_started + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.orcaly_consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.orcaly_consume_rate_limit(text, integer, integer)
  to service_role;

drop policy if exists "Público cria pedido em empresa ativa" on public.orders;
drop policy if exists "Publico cria pedido em empresa ativa" on public.orders;
drop policy if exists "Público cria itens em empresa ativa" on public.order_items;
drop policy if exists "Publico cria itens em empresa ativa" on public.order_items;

revoke insert on public.orders from anon;
revoke insert on public.order_items from anon;

do $$
declare
  item record;
begin
  for item in
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke all privileges on table public.%I from anon',
      item.tablename
    );
    execute format(
      'revoke truncate, references, trigger on table public.%I from authenticated',
      item.tablename
    );
  end loop;
end;
$$;

grant select on public.public_company_profiles to anon, authenticated;
grant select on public.public_marketplace_companies to anon, authenticated;
grant select on public.public_marketplace_products to anon, authenticated;
grant select on public.public_site_companies to anon, authenticated;
grant select on public.public_site_sections to anon, authenticated;
grant select on public.public_store_products to anon, authenticated;

revoke insert, update on public.orders from authenticated;

grant insert (
  nome,
  telefone,
  produto,
  largura,
  altura,
  quantidade,
  observacoes,
  status,
  preco_estimado,
  arquivo_url,
  company_id,
  valor_total,
  valor_sinal,
  percentual_sinal,
  forma_pagamento,
  parcelas,
  itens_resumo,
  cliente_empresa,
  dados_inteligentes,
  marketplace_origem,
  prazo,
  priority,
  internal_notes,
  files,
  source,
  original_order_id,
  cupom_id,
  cupom_codigo,
  valor_desconto,
  valor_total_original,
  prioridade,
  prazo_entrega,
  responsavel_id,
  canal_origem,
  endereco_entrega,
  observacoes_internas,
  responsavel_nome,
  delivery_type,
  delivery_fee,
  subtotal,
  total_amount,
  payment_method_id,
  delivery_zone_id,
  address,
  neighborhood,
  complement,
  reference_point,
  change_for,
  items_snapshot,
  discount_amount,
  coupon_code,
  customer_name,
  customer_email,
  customer_phone,
  total,
  payment_method,
  coupon_id
) on public.orders to authenticated;

grant update (
  nome,
  telefone,
  produto,
  largura,
  altura,
  quantidade,
  observacoes,
  status,
  preco_estimado,
  arquivo_url,
  valor_total,
  valor_sinal,
  percentual_sinal,
  forma_pagamento,
  parcelas,
  itens_resumo,
  cliente_empresa,
  dados_inteligentes,
  marketplace_origem,
  prazo,
  priority,
  internal_notes,
  files,
  source,
  original_order_id,
  cupom_id,
  cupom_codigo,
  valor_desconto,
  valor_total_original,
  prioridade,
  prazo_entrega,
  responsavel_id,
  canal_origem,
  endereco_entrega,
  observacoes_internas,
  aprovado_em,
  entregue_em,
  cancelado_em,
  updated_at,
  responsavel_nome,
  visualizado_em,
  notificado_em,
  delivery_type,
  delivery_fee,
  subtotal,
  total_amount,
  payment_method_id,
  delivery_zone_id,
  address,
  neighborhood,
  complement,
  reference_point,
  change_for,
  items_snapshot,
  discount_amount,
  coupon_code,
  customer_name,
  customer_email,
  customer_phone,
  total,
  payment_method,
  coupon_id
) on public.orders to authenticated;

update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ]::text[]
where id = 'artes';

drop policy if exists "Publico envia arte sem listar" on storage.objects;
drop policy if exists "Público envia arte sem listar" on storage.objects;
revoke insert, update, delete on storage.objects from anon;

alter table public.art_approval_requests
  add column if not exists expires_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists revoked_at timestamptz;

update public.art_approval_requests
set expires_at = coalesce(expires_at, created_at + interval '7 days')
where expires_at is null;

alter table public.art_approval_requests
  alter column expires_at set default (clock_timestamp() + interval '7 days');

create unique index if not exists art_approval_requests_token_unique
  on public.art_approval_requests(token);

create index if not exists art_approval_requests_active_token_idx
  on public.art_approval_requests(token, expires_at)
  where revoked_at is null;

commit;
`);

write("scripts/security-check.mjs", `import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function requireText(file, text, label) {
  if (!read(file).includes(text)) {
    failures.push(\`\${label}: \${file}\`)
  }
}

function forbidText(file, text, label) {
  if (read(file).includes(text)) {
    failures.push(\`\${label}: \${file}\`)
  }
}

requireText(
  'lib/orcaly-security.ts',
  'Content-Security-Policy',
  'CSP obrigatoria ausente',
)
forbidText(
  'lib/orcaly-security.ts',
  'Content-Security-Policy-Report-Only',
  'CSP ainda esta apenas em report-only',
)
requireText(
  'lib/mercado-pago.ts',
  'if (!secret || !xSignature || !xRequestId || !dataId) return false',
  'Webhook ainda permite segredo ausente',
)
forbidText(
  'lib/admin-auth.ts',
  'araujovinicius249@gmail.com',
  'Super admin fixo no codigo',
)
forbidText(
  'lib/company-access.ts',
  'araujovinicius249@gmail.com',
  'Super admin fixo no acesso da empresa',
)
forbidText(
  'lib/company-access.ts',
  'shouldAttachOwner',
  'Vinculo automatico por e-mail ainda ativo',
)
forbidText(
  'app/api/public-site/[slug]/route.ts',
  ".select('*')",
  'API publica ainda seleciona todos os campos',
)
requireText(
  'app/api/public-site/[slug]/route.ts',
  'type PublicCompanyRow = Record<string, unknown>',
  'Tipagem da empresa publica ausente',
)
requireText(
  'app/api/public-site/[slug]/route.ts',
  'rawCompany as unknown as PublicCompanyRow | null',
  'Consulta dinamica da empresa continua sem tipagem',
)
requireText(
  'app/api/public-site/[slug]/route.ts',
  '(rawProducts || []) as unknown as PublicProductRow[]',
  'Consulta dinamica dos produtos continua sem tipagem',
)
requireText(
  'supabase/migrations/20260729133000_orcaly_security_hardening.sql',
  'revoke all privileges on table public.%I from anon',
  'Revogacao de privilegios anonimos ausente',
)
requireText(
  'supabase/migrations/20260729133000_orcaly_security_hardening.sql',
  'drop policy if exists "Público cria pedido em empresa ativa"',
  'Politica publica de pedidos ainda nao foi removida',
)

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

for (const file of walk(path.join(root, 'app'))) {
  if (!/\\.(ts|tsx)$/.test(file)) continue
  const content = fs.readFileSync(file, 'utf8')
  if (
    content.includes("'use client'") &&
    /\\.from\\(['"]artes['"]\\)/.test(content)
  ) {
    failures.push(
      \`Upload direto para o bucket artes em componente cliente: \${path.relative(root, file)}\`,
    )
  }
}

if (failures.length) {
  console.error('\\nFALHAS DE SEGURANCA ENCONTRADAS:')
  for (const failure of failures) console.error(\`- \${failure}\`)
  process.exit(1)
}

console.log('SECURITY_CHECK_EXIT_CODE=0')
`);

console.log("PATCH_NODE_EXIT_CODE=0");
'@

Write-Utf8NoBom -Path $patcherPath -Content $patcher

try {
  Write-Section "APLICANDO PATCHES"
  & node $patcherPath
  if ($LASTEXITCODE -ne 0) {
    throw "O patch Node falhou com codigo $LASTEXITCODE."
  }

  Remove-Item -LiteralPath $patcherPath -Force -ErrorAction SilentlyContinue

  Write-Section "ATUALIZANDO DEPENDENCIAS"
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    throw "npm install falhou com codigo $LASTEXITCODE."
  }

  Write-Section "VALIDANDO SEGURANCA"
  & npm run security:check
  if ($LASTEXITCODE -ne 0) {
    throw "A verificacao de seguranca falhou."
  }

  $touchedForDiff = @(
    "package.json",
    "package-lock.json",
    "proxy.ts",
    "lib/supabase.ts",
    "lib/orcaly-security.ts",
    "lib/admin-auth.ts",
    "lib/company-access.ts",
    "lib/mercado-pago.ts",
    "lib/payments/checkout-service.ts",
    "lib/security/rate-limit.ts",
    "lib/security/request.ts",
    "lib/payments/checkout-validation.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
    "app/api/assinatura/checkout/webhook/route.ts",
    "app/api/checkout/[slug]/route.ts",
    "app/api/checkout/[slug]/prepare/route.ts",
    "app/api/checkout/[slug]/status/route.ts",
    "app/api/marketplace/coupon/route.ts",
    "app/api/security/report/route.ts",
    "app/api/public-site/[slug]/route.ts",
    "app/site/[slug]/page.tsx",
    "app/api/public/uploads/art/route.ts",
    "scripts/security-check.mjs",
    "supabase/migrations/20260729133000_orcaly_security_hardening.sql"
  ) + $dynamicFiles

  & git --no-pager diff --check -- $touchedForDiff
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou erro de espaco ou conflito."
  }

  if (-not $SkipBuild) {
    Write-Section "EXECUTANDO BUILD"
    if (Test-Path -LiteralPath ".next") {
      Remove-Item -LiteralPath ".next" -Recurse -Force
    }

    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Build falhou com codigo $LASTEXITCODE."
    }
    Write-Ok "BUILD_EXIT_CODE=0"
  }
}
catch {
  Remove-Item -LiteralPath $patcherPath -Force -ErrorAction SilentlyContinue
  Restore-Backup -BackupRoot $backupRoot -CreatedFiles $createdFiles
  Write-Fail $_.Exception.Message
  Write-Host "Os arquivos locais foram restaurados."
  exit 1
}

$dbApplied = $false

if (-not $SkipDatabase) {
  Write-Section "APLICANDO MIGRACAO DE SEGURANCA NO SUPABASE"

  $supabaseCommand = Get-Command supabase -ErrorAction SilentlyContinue
  $useNpx = $false

  if (-not $supabaseCommand) {
    if (Get-Command npx -ErrorAction SilentlyContinue) {
      $useNpx = $true
      Write-Warn "Supabase CLI global nao encontrado. Usando npx supabase@2.110.0."
    }
    else {
      Write-Warn "Supabase CLI e npx nao encontrados. Migracao ficou salva, mas nao foi aplicada."
    }
  }

  if ($supabaseCommand -or $useNpx) {
    $hasDbPassword = -not [string]::IsNullOrWhiteSpace($env:SUPABASE_DB_PASSWORD)

    if (-not $hasDbPassword) {
      Write-Warn "SUPABASE_DB_PASSWORD ausente. A migracao foi criada, mas nao foi enviada ao banco."
    }
    else {
      try {
        if ($useNpx) {
          & npx --yes supabase@2.110.0 link --project-ref $SupabaseProjectRef --password $env:SUPABASE_DB_PASSWORD
          if ($LASTEXITCODE -ne 0) { throw "Falha ao vincular o projeto Supabase." }

          & npx --yes supabase@2.110.0 db push --password $env:SUPABASE_DB_PASSWORD --yes
          if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar a migracao no Supabase." }
        }
        else {
          & supabase link --project-ref $SupabaseProjectRef --password $env:SUPABASE_DB_PASSWORD
          if ($LASTEXITCODE -ne 0) { throw "Falha ao vincular o projeto Supabase." }

          & supabase db push --password $env:SUPABASE_DB_PASSWORD --yes
          if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar a migracao no Supabase." }
        }

        $dbApplied = $true
        Write-Ok "MIGRACAO_SUPABASE_EXIT_CODE=0"
      }
      catch {
        Write-Warn $_.Exception.Message
        Write-Warn "O codigo permaneceu corrigido e a migracao ficou pronta em supabase\migrations."
      }
    }
  }
}

if (-not $SkipAuthHardening) {
  Write-Section "ENDURECENDO CONFIGURACAO DE SENHA"

  if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    Write-Warn "SUPABASE_ACCESS_TOKEN ausente. Protecao HIBP nao foi ativada automaticamente."
  }
  else {
    try {
      $headers = @{
        Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)"
        "Content-Type" = "application/json"
      }

      $body = @{
        password_hibp_enabled = $true
        password_min_length = 8
        refresh_token_rotation_enabled = $true
        security_update_password_require_reauthentication = $true
      } | ConvertTo-Json

      Invoke-RestMethod `
        -Method Patch `
        -Uri "https://api.supabase.com/v1/projects/$SupabaseProjectRef/config/auth" `
        -Headers $headers `
        -Body $body | Out-Null

      Write-Ok "PROTECAO_DE_SENHA_ATIVADA"
    }
    catch {
      Write-Warn "Nao foi possivel ativar a protecao de senha pela API: $($_.Exception.Message)"
    }
  }
}

Write-Section "VERIFICANDO VARIAVEIS EXTERNAS"

$requiredProductionVariables = @(
  "MP_MARKETPLACE_CLIENT_ID",
  "MP_MARKETPLACE_CLIENT_SECRET",
  "MP_MARKETPLACE_WEBHOOK_SECRET",
  "MP_SUBSCRIPTION_ACCESS_TOKEN",
  "MP_SUBSCRIPTION_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
)

$envFile = ".env.local"
$envText = if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile -Raw
}
else {
  ""
}

$missingLocal = @()
foreach ($name in $requiredProductionVariables) {
  $pattern = "(?m)^\s*" + [regex]::Escape($name) + "\s*=\s*(.+?)\s*$"
  $match = [regex]::Match($envText, $pattern)
  if (-not $match.Success -or [string]::IsNullOrWhiteSpace($match.Groups[1].Value)) {
    $missingLocal += $name
  }
}

if ($missingLocal.Count -gt 0) {
  Write-Warn ("Variaveis ausentes no .env.local: " + ($missingLocal -join ", "))
}

$vercelCommand = Get-Command vercel -ErrorAction SilentlyContinue
if ($vercelCommand) {
  try {
    $vercelEnv = (& vercel env ls production 2>&1 | Out-String)
    $missingVercel = @(
      $requiredProductionVariables |
        Where-Object { $vercelEnv -notmatch [regex]::Escape($_) }
    )

    if ($missingVercel.Count -gt 0) {
      Write-Warn ("Variaveis ausentes na Vercel Production: " + ($missingVercel -join ", "))
    }
    else {
      Write-Ok "VARIAVEIS_VERCEL_NOMES_OK"
    }
  }
  catch {
    Write-Warn "Nao foi possivel consultar as variaveis da Vercel."
  }
}
else {
  Write-Warn "CLI da Vercel nao encontrado. Variaveis de producao nao foram verificadas."
}

Write-Section "CORRECAO CONCLUIDA"
Write-Ok "PATCH_NODE_EXIT_CODE=0"
if (-not $SkipBuild) {
  Write-Ok "BUILD_EXIT_CODE=0"
}
if ($dbApplied) {
  Write-Ok "DATABASE_SECURITY_APPLIED=1"
}
else {
  Write-Warn "DATABASE_SECURITY_APPLIED=0"
}
Write-Host "Backup local: $backupRoot"
Write-Host ""
Write-Host "O script nao fez commit, push ou deploy." -ForegroundColor Cyan
