// ORCALY_OWNER_SUPPORT_CONTROL_V1
// ORCALY_PLATFORM_ADMIN_HARDENING_V1
// ORCALY_OWNER_BACKOFFICE_V2
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, isReservedSubdomain } from './lib/orcaly-security'
import { getRootDomain } from './lib/company-url'

type CookieToSet = { name: string; value: string; options?: CookieOptions }
const OFFICIAL_OWNER_EMAIL = 'viniciusadm@orcaly.com'

function cleanHost(host: string) { return host.split(':')[0].toLowerCase() }
function getSubdomain(hostname: string, rootDomain: string) {
  const host = cleanHost(hostname)
  if (host === rootDomain || host === `www.${rootDomain}`) return null
  if (host.endsWith(`.${rootDomain}`)) return host.replace(`.${rootDomain}`, '').split('.').pop() || null
  return null
}
function applyCookies(response: NextResponse, cookies: CookieToSet[]) {
  for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}
function secureResponse(response: NextResponse, request: NextRequest, cookies: CookieToSet[]) {
  const secured = applySecurityHeaders(applyCookies(response, cookies), request)
  const pathname = request.nextUrl.pathname
  const internal = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/suporte' || pathname.startsWith('/suporte/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/') || pathname === '/api/platform-admin' || pathname.startsWith('/api/platform-admin/')
  const customerPortal = pathname === '/acompanhar' || pathname.startsWith('/acompanhar/') || pathname === '/api/customer-portal' || pathname.startsWith('/api/customer-portal/')
  if (internal || customerPortal) {
    secured.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate')
    secured.headers.set('Pragma', 'no-cache')
    secured.headers.set('Expires', '0')
    secured.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
  }
  if (customerPortal) secured.headers.set('Referrer-Policy', 'no-referrer')
  return secured
}
function normalizedRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase()
  if (role === 'super_admin') return 'owner'
  if (role === 'suporte') return 'support'
  return role
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const rootDomain = getRootDomain()
  const subdomain = getSubdomain(request.headers.get('host') || '', rootDomain)
  const adminLoginPage = pathname === '/admin/login'
  const passwordPage = pathname === '/admin/alterar-senha'
  const affiliatePage = pathname === '/parceiros/painel' || pathname.startsWith('/parceiros/painel/')
  const supportPage = pathname === '/suporte' || pathname.startsWith('/suporte/')
  const adminPage = !adminLoginPage && !passwordPage && (pathname === '/admin' || pathname.startsWith('/admin/'))
  const companyPage = pathname === '/painel' || pathname.startsWith('/painel/')
  const sensitive = adminPage || passwordPage || supportPage || affiliatePage || companyPage
  const cookiesToSet: CookieToSet[] = []

  if (sensitive) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return secureResponse(NextResponse.json({ error: 'Autenticação indisponível.' }, { status: 503 }), request, cookiesToSet)

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookies) { for (const cookie of cookies) { request.cookies.set(cookie.name, cookie.value); cookiesToSet.push(cookie) } },
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const login = request.nextUrl.clone()
      login.pathname = adminPage || passwordPage || supportPage || affiliatePage ? '/parceiros/login' : '/login'
      login.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      return secureResponse(NextResponse.redirect(login), request, cookiesToSet)
    }

    const tokenRole = normalizedRole(user.app_metadata?.orcaly_role)
    if (adminPage || passwordPage || supportPage || affiliatePage) {
      const { data, error } = await supabase.rpc('get_my_platform_admin_access')
      const access = Array.isArray(data) ? data[0] : data
      const role = normalizedRole(access?.admin_role)
      const active = !error && access?.admin_is_active === true
      const officialOwner = active && role === 'owner' && String(user.email || '').toLowerCase() === OFFICIAL_OWNER_EMAIL
      const activeSupport = active && role === 'support'
      const activeProspector = active && role === 'prospector'
      const prospectorAllowedPage =
        pathname === '/admin/prospeccao' ||
        pathname.startsWith('/admin/prospeccao/') ||
        pathname === '/admin/fundadores' ||
        pathname.startsWith('/admin/fundadores/')

      if (adminPage && activeProspector && !prospectorAllowedPage) {
        const commercial = request.nextUrl.clone()
        commercial.pathname = '/admin/prospeccao'
        commercial.search = ''
        return secureResponse(NextResponse.redirect(commercial), request, cookiesToSet)
      }

      if (adminPage && !officialOwner && !activeProspector) {
        const destination = request.nextUrl.clone()
        destination.pathname = activeSupport ? '/suporte' : '/parceiros/login'
        destination.search = ''
        return secureResponse(NextResponse.redirect(destination), request, cookiesToSet)
      }
      if (supportPage && !activeSupport && !officialOwner) {
        const login = request.nextUrl.clone(); login.pathname = '/parceiros/login'; login.search = ''
        return secureResponse(NextResponse.redirect(login), request, cookiesToSet)
      }
      if (passwordPage && !officialOwner && !activeSupport && !activeProspector) {
        const login = request.nextUrl.clone(); login.pathname = '/parceiros/login'; login.search = ''
        return secureResponse(NextResponse.redirect(login), request, cookiesToSet)
      }
      if ((officialOwner || activeSupport || activeProspector) && access?.must_change_password === true && !passwordPage) {
        const change = request.nextUrl.clone(); change.pathname = '/admin/alterar-senha'; change.search = ''
        return secureResponse(NextResponse.redirect(change), request, cookiesToSet)
      }
      if (affiliatePage && officialOwner) {
        const admin = request.nextUrl.clone(); admin.pathname = '/admin'; admin.search = ''
        return secureResponse(NextResponse.redirect(admin), request, cookiesToSet)
      }
      if (affiliatePage && activeSupport) {
        const support = request.nextUrl.clone(); support.pathname = '/suporte'; support.search = ''
        return secureResponse(NextResponse.redirect(support), request, cookiesToSet)
      }
      if (affiliatePage && activeProspector) {
        const commercial = request.nextUrl.clone(); commercial.pathname = '/admin/prospeccao'; commercial.search = ''
        return secureResponse(NextResponse.redirect(commercial), request, cookiesToSet)
      }
    }

    if (affiliatePage && tokenRole !== 'affiliate') {
      const login = request.nextUrl.clone(); login.pathname = '/parceiros/login'; login.search = ''
      return secureResponse(NextResponse.redirect(login), request, cookiesToSet)
    }
  }

  const shouldRewriteSubdomain = subdomain && !isReservedSubdomain(subdomain) && pathname === '/'
  if (shouldRewriteSubdomain) {
    url.pathname = `/site/${subdomain}`
    return secureResponse(NextResponse.rewrite(url), request, cookiesToSet)
  }
  return secureResponse(NextResponse.next({ request }), request, cookiesToSet)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)'],
}
