import { NextRequest, NextResponse } from 'next/server'

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
    .replace(/[\u0300-\u036f]/g, '')
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
    '..\\',
    '${',
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
    `script-src ${scriptSources.join(' ')}`,
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
