import { createServerClient } from '@supabase/ssr'
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
  if (host === `www.${rootDomain}`) return null

  if (host.endsWith(`.${rootDomain}`)) {
    return host.replace(`.${rootDomain}`, '').split('.').pop() || null
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
      login.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
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
    url.pathname = `/site/${subdomain}`
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
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)',
  ],
}
