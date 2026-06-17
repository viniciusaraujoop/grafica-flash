import { NextRequest, NextResponse } from 'next/server'

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br').toLowerCase()

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'login',
  'painel',
  'dashboard',
  'cadastro',
  'checkout',
  'assinatura',
  'proposta',
  'propostas',
  'assets',
  'static',
  'public',
  'private',
  'config',
  'settings',
  'security',
  'auth',
])

function applySecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')

  return response
}

function cleanSubdomain(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 42)
}

function getHostname(request: NextRequest) {
  const host = request.headers.get('host') || ''
  return host.split(':')[0].toLowerCase()
}

function getPort(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const parts = host.split(':')
  return parts.length > 1 ? `:${parts[1]}` : ''
}

function getTenantSubdomain(hostname: string) {
  if (!hostname) return null

  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return null
  }

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const left = hostname.slice(0, -(`.${ROOT_DOMAIN}`).length)
    const first = left.split('.')[0]
    const subdomain = cleanSubdomain(first)

    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null

    return subdomain
  }

  if (hostname.endsWith('.localhost')) {
    const first = hostname.replace('.localhost', '').split('.')[0]
    const subdomain = cleanSubdomain(first)

    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null

    return subdomain
  }

  return null
}

function isPublicFile(pathname: string) {
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml|webmanifest|map)$/i.test(pathname)
}

function shouldBypass(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    isPublicFile(pathname)
  )
}

function isRootDomain(hostname: string) {
  return hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}` || hostname === 'localhost'
}

function redirectRootOrcamentoToSubdomain(request: NextRequest, hostname: string) {
  const { pathname } = request.nextUrl

  if (!isRootDomain(hostname)) return null
  if (!pathname.startsWith('/orcamento/')) return null

  const rawSlug = pathname.split('/')[2] || ''
  const subdomain = cleanSubdomain(rawSlug)

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null

  const url = request.nextUrl.clone()
  const port = getPort(request)

  if (hostname === 'localhost') {
    url.hostname = `${subdomain}.localhost`
    if (port) url.port = port.replace(':', '')
    url.pathname = '/'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  url.hostname = `${subdomain}.${ROOT_DOMAIN}`
  url.pathname = '/'
  return applySecurityHeaders(NextResponse.redirect(url))
}

export function proxy(request: NextRequest) {
  const hostname = getHostname(request)
  const pathname = request.nextUrl.pathname

  const rootRedirect = redirectRootOrcamentoToSubdomain(request, hostname)
  if (rootRedirect) return rootRedirect

  if (shouldBypass(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  const tenantSubdomain = getTenantSubdomain(hostname)

  if (!tenantSubdomain) {
    return applySecurityHeaders(NextResponse.next())
  }

  if (pathname.startsWith('/orcamento/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  const internalRoutes = [
    '/admin',
    '/painel',
    '/login',
    '/cadastro',
    '/checkout',
    '/assinatura',
    '/proposta',
  ]

  if (internalRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return applySecurityHeaders(NextResponse.next())
  }

  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = `/orcamento/${tenantSubdomain}`

  return applySecurityHeaders(NextResponse.rewrite(rewriteUrl))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
