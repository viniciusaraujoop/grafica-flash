/** Only same-origin relative paths may be used after authentication. */
const AUTH_NAV_ORIGIN = 'https://orcaly.invalid'
const AUTH_NAV_FALLBACK = '/painel/inicio'
const FORBIDDEN_AUTH_PATHS = ['/login', '/mfa', '/cadastro'] as const

function isForbiddenAuthPath(pathname: string) {
  return FORBIDDEN_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function safeNextPath(rawNext?: string | null) {
  const next = String(rawNext || '').trim()
  let decoded = next

  try {
    for (let pass = 0; pass < 3; pass++) {
      const value = decodeURIComponent(decoded)
      if (value === decoded) break
      decoded = value
    }
  } catch {
    return AUTH_NAV_FALLBACK
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/.test(decoded) ||
    decoded.includes('://')
  ) {
    return AUTH_NAV_FALLBACK
  }

  let url: URL
  try {
    url = new URL(decoded, AUTH_NAV_ORIGIN)
  } catch {
    return AUTH_NAV_FALLBACK
  }

  if (url.origin !== AUTH_NAV_ORIGIN) return AUTH_NAV_FALLBACK

  const pathname = url.pathname
  if (isForbiddenAuthPath(pathname)) return AUTH_NAV_FALLBACK

  return `${pathname}${url.search}${url.hash}`
}

export function isPersonalEcosystemDestination(safePath: string) {
  try {
    const url = new URL(safePath, AUTH_NAV_ORIGIN)
    if (url.origin !== AUTH_NAV_ORIGIN) return false
    return url.pathname === '/apps' || url.pathname.startsWith('/apps/')
  } catch {
    return false
  }
}
