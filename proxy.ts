// ORCALY_OWNER_SUPPORT_CONTROL_V1
// ORCALY_PLATFORM_ADMIN_HARDENING_V1
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import {
  applySecurityHeaders,
  isReservedSubdomain,
} from './lib/orcaly-security'
import { getRootDomain } from './lib/company-url'

type CookieToSet = {
  name: string
  value: string
  options?: any
}

function cleanHost(host: string) {
  return host.split(':')[0].toLowerCase()
}

function getSubdomain(
  hostname: string,
  rootDomain: string,
) {
  const host = cleanHost(hostname)

  if (host === rootDomain) return null
  if (host === `www.${rootDomain}`) return null

  if (host.endsWith(`.${rootDomain}`)) {
    return (
      host
        .replace(`.${rootDomain}`, '')
        .split('.')
        .pop() || null
    )
  }

  return null
}

function applyCookies(
  response: NextResponse,
  cookies: CookieToSet[],
) {
  for (const cookie of cookies) {
    response.cookies.set(
      cookie.name,
      cookie.value,
      cookie.options,
    )
  }

  return response
}

function secureResponse(
  response: NextResponse,
  request: NextRequest,
  cookies: CookieToSet[],
) {
  const secured = applySecurityHeaders(
    applyCookies(response, cookies),
    request,
  )
  const pathname = request.nextUrl.pathname
  const internalAdminResource =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/') ||
    pathname === '/api/platform-admin' ||
    pathname.startsWith('/api/platform-admin/')

  if (internalAdminResource) {
    secured.headers.set(
      'Cache-Control',
      'private, no-store, no-cache, max-age=0, must-revalidate',
    )
    secured.headers.set('Pragma', 'no-cache')
    secured.headers.set('Expires', '0')
    secured.headers.set(
      'X-Robots-Tag',
      'noindex, nofollow, noarchive, nosnippet',
    )
  }

  return secured
}

function normalizedRole(value: unknown) {
  const role = String(value || '')
    .trim()
    .toLowerCase()

  if (role === 'super_admin') return 'owner'
  if (role === 'suporte') return 'support'
  return role
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const host = request.headers.get('host') || ''
  const rootDomain = getRootDomain()
  const subdomain = getSubdomain(
    host,
    rootDomain,
  )

  const adminLoginPage =
    pathname === '/admin/login'
  const affiliateSensitivePage =
    pathname === '/parceiros/painel' ||
    pathname.startsWith('/parceiros/painel/')
  const adminSensitivePage =
    !adminLoginPage &&
    (pathname === '/admin' ||
      pathname.startsWith('/admin/'))
  const companySensitivePage =
    pathname === '/painel' ||
    pathname.startsWith('/painel/')
  const sensitivePage =
    adminSensitivePage ||
    affiliateSensitivePage ||
    companySensitivePage

  const cookiesToSet: CookieToSet[] = []

  if (sensitivePage) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return secureResponse(
        NextResponse.json(
          {
            error:
              'Autenticação indisponível.',
          },
          { status: 503 },
        ),
        request,
        cookiesToSet,
      )
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookies) {
            for (const cookie of cookies) {
              request.cookies.set(
                cookie.name,
                cookie.value,
              )
              cookiesToSet.push(cookie)
            }
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const login = request.nextUrl.clone()

      login.pathname = adminSensitivePage
        ? '/admin/login'
        : affiliateSensitivePage
          ? '/parceiros/login'
          : '/login'
      login.searchParams.set(
        'next',
        `${pathname}${request.nextUrl.search}`,
      )

      return secureResponse(
        NextResponse.redirect(login),
        request,
        cookiesToSet,
      )
    }

    const tokenRole = normalizedRole(
      user.app_metadata?.orcaly_role,
    )

    if (adminSensitivePage) {
      const { data, error } = await supabase.rpc(
        'get_my_platform_admin_access',
      )
      const adminAccess = Array.isArray(data)
        ? data[0]
        : data
      const databaseRole = normalizedRole(
        adminAccess?.admin_role,
      )
      const allowedAdminRoles = new Set([
        'owner',
        'admin',
        'finance',
        'support',
      ])
      const ownerEmailMatches =
        databaseRole !== 'owner' ||
        String(user.email || '').toLowerCase() ===
          'viniciusadm@orcaly.com'

      if (
        error ||
        adminAccess?.admin_is_active !== true ||
        !allowedAdminRoles.has(databaseRole) ||
        !ownerEmailMatches
      ) {
        const panel = request.nextUrl.clone()
        panel.pathname = '/painel/inicio'
        panel.search = ''

        return secureResponse(
          NextResponse.redirect(panel),
          request,
          cookiesToSet,
        )
      }

      if (
        adminAccess?.must_change_password === true &&
        pathname !== '/admin/alterar-senha'
      ) {
        const passwordPage =
          request.nextUrl.clone()
        passwordPage.pathname =
          '/admin/alterar-senha'
        passwordPage.search = ''

        return secureResponse(
          NextResponse.redirect(passwordPage),
          request,
          cookiesToSet,
        )
      }
    }

    if (
      affiliateSensitivePage &&
      tokenRole !== 'affiliate'
    ) {
      const login = request.nextUrl.clone()
      login.pathname = '/parceiros/login'
      login.search = ''

      return secureResponse(
        NextResponse.redirect(login),
        request,
        cookiesToSet,
      )
    }
  }

  const shouldRewriteSubdomain =
    subdomain &&
    !isReservedSubdomain(subdomain) &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')

  if (shouldRewriteSubdomain) {
    url.pathname = `/site/${subdomain}`

    return secureResponse(
      NextResponse.rewrite(url),
      request,
      cookiesToSet,
    )
  }

  return secureResponse(
    NextResponse.next({
      request,
    }),
    request,
    cookiesToSet,
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)',
  ],
}
