export const OFFICIAL_ROOT_DOMAIN = 'orcaly.com.br'

export function normalizeCompanySlug(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('.')[0]
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)
}

export function getRootDomain() {
  const raw = String(process.env.NEXT_PUBLIC_ROOT_DOMAIN || OFFICIAL_ROOT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/\/$/, '')

  if (!raw) return OFFICIAL_ROOT_DOMAIN

  if (process.env.NODE_ENV === 'production') return OFFICIAL_ROOT_DOMAIN

  if (raw === 'vercel.orcaly.com.br' || raw.endsWith('.vercel.orcaly.com.br')) {
    return OFFICIAL_ROOT_DOMAIN
  }

  if (raw.endsWith('.vercel.app')) return OFFICIAL_ROOT_DOMAIN

  return raw
}

export function getCompanyPublicUrl(slugValue: unknown, path = '') {
  const slug = normalizeCompanySlug(slugValue)
  if (!slug) return ''

  const rootDomain = getRootDomain()
  const protocol = rootDomain.includes('localhost') || rootDomain.startsWith('127.') ? 'http' : 'https'
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''

  return `${protocol}://${slug}.${rootDomain}${normalizedPath}`
}

export function getCompanyPublicHost(slugValue: unknown) {
  const url = getCompanyPublicUrl(slugValue)
  return url.replace(/^https?:\/\//, '')
}

export function getCompanyLocalSitePath(slugValue: unknown) {
  const slug = normalizeCompanySlug(slugValue)
  return slug ? `/site/${slug}` : '/painel/site'
}
