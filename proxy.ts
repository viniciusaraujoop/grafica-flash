import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, isReservedSubdomain } from './lib/orcaly-security'
import { getRootDomain } from './lib/company-url'

function cleanHost(host: string) {
  return host.split(':')[0].toLowerCase()
}


function getSubdomain(hostname: string, rootDomain: string) {
  const host = cleanHost(hostname)

  if (host === rootDomain) return null
  if (host === `www.${rootDomain}`) return null

  if (host.endsWith(`.${rootDomain}`)) {
    return host.replace(`.${rootDomain}`, '').split('.').pop() || null
  }

  return null
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const host = request.headers.get('host') || ''
  const rootDomain = getRootDomain()
  const subdomain = getSubdomain(host, rootDomain)

  const shouldRewriteSubdomain =
    subdomain &&
    !isReservedSubdomain(subdomain) &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')

  let response: NextResponse

  if (shouldRewriteSubdomain) {
    url.pathname = `/site/${subdomain}`
    response = NextResponse.rewrite(url)
  } else {
    response = NextResponse.next()
  }

  return applySecurityHeaders(response, request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)',
  ],
}
