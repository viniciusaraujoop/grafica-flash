export const OFFICIAL_ROOT_DOMAIN = 'orcaly.com.br'

function cleanRootDomain(value: unknown) {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/\/+$/, '')

  if (!raw) return OFFICIAL_ROOT_DOMAIN

  const vercelRoot = `vercel.${OFFICIAL_ROOT_DOMAIN}`
  if (raw === vercelRoot || (raw.includes('.vercel.') && raw.endsWith(`.${OFFICIAL_ROOT_DOMAIN}`))) {
    return OFFICIAL_ROOT_DOMAIN
  }

  if (raw.endsWith('.vercel.app')) return OFFICIAL_ROOT_DOMAIN

  return raw
}

export function getRootDomain() {
  if (process.env.NODE_ENV === 'production') return OFFICIAL_ROOT_DOMAIN

  return cleanRootDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN || OFFICIAL_ROOT_DOMAIN)
}

export function normalizeCompanySlug(value: unknown) {
  const rootDomain = getRootDomain()
  let raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '')

  if (!raw) return ''

  const officialSitePrefix = `${OFFICIAL_ROOT_DOMAIN}/site/`
  const envSitePrefix = `${rootDomain}/site/`

  if (raw.startsWith(officialSitePrefix)) raw = raw.slice(officialSitePrefix.length)
  if (raw.startsWith(envSitePrefix)) raw = raw.slice(envSitePrefix.length)

  if (raw.includes('/site/')) {
    raw = raw.split('/site/').pop() || ''
  }

  for (const domain of [rootDomain, OFFICIAL_ROOT_DOMAIN]) {
    if (raw === domain) raw = ''
    if (raw.endsWith(`.${domain}`)) {
      raw = raw.slice(0, -1 * (`.${domain}`.length))
    }
  }

  if (raw.endsWith('.vercel')) raw = raw.slice(0, -'.vercel'.length)

  raw = raw.split('/')[0].split('.')[0]

  return raw
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)
}

export function getCompanyPublicUrl(slugValue: unknown, path = '') {
  const slug = normalizeCompanySlug(slugValue)
  const rootDomain = getRootDomain()
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''

  if (!slug) {
    return process.env.NODE_ENV === 'development'
      ? `http://localhost:3000${normalizedPath || '/site'}`
      : `https://${OFFICIAL_ROOT_DOMAIN}${normalizedPath}`
  }

  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:3000/site/${slug}${normalizedPath}`
  }

  return `https://${slug}.${rootDomain}${normalizedPath}`
}

export function getCompanyPublicHost(slugValue: unknown) {
  const url = getCompanyPublicUrl(slugValue)
  return url.replace(/^https?:\/\//, '')
}

export function getCompanyInternalSitePath(slugValue: unknown) {
  const slug = normalizeCompanySlug(slugValue)
  return slug ? `/site/${slug}` : '/site'
}

export function getCompanyLocalSitePath(slugValue: unknown) {
  return getCompanyInternalSitePath(slugValue)
}
