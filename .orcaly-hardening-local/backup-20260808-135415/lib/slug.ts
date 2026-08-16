export const RESERVED_SUBDOMAINS = [
  'www',
  'app',
  'admin',
  'api',
  'login',
  'painel',
  'dashboard',
  'checkout',
  'assinatura',
  'cadastro',
  'site',
  'loja',
  'cliente',
  'clientes',
  'proposta',
  'propostas',
  'marketplace',
  'suporte',
  'help',
  'orcaly',
] as const

export type SlugValidation = {
  ok: boolean
  slug: string
  reason?: string
}

export function normalizeSubdomainSlug(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
}

export function validateSubdomainSlug(value: unknown): SlugValidation {
  const slug = normalizeSubdomainSlug(value)

  if (!slug) {
    return { ok: false, slug, reason: 'Escolha um link público.' }
  }

  if (slug.length < 3) {
    return { ok: false, slug, reason: 'Use pelo menos 3 caracteres.' }
  }

  if (slug.length > 42) {
    return { ok: false, slug, reason: 'Use no máximo 42 caracteres.' }
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return { ok: false, slug, reason: 'Use apenas letras, números e hífen.' }
  }

  if (RESERVED_SUBDOMAINS.includes(slug as typeof RESERVED_SUBDOMAINS[number])) {
    return { ok: false, slug, reason: 'Esse endereço é reservado pelo Orçaly.' }
  }

  return { ok: true, slug }
}

export function getSubdomainSuggestions(baseValue: unknown, city?: unknown) {
  const base = normalizeSubdomainSlug(baseValue) || 'minha-empresa'
  const normalizedCity = normalizeSubdomainSlug(city)

  const suggestions = [
    normalizedCity ? `${base}-${normalizedCity}` : '',
    `${base}-al`,
    `${base}-2026`,
    `${base}-oficial`,
    `${base}-online`,
  ]
    .filter(Boolean)
    .map((item) => normalizeSubdomainSlug(item))
    .filter((item) => validateSubdomainSlug(item).ok)

  return Array.from(new Set(suggestions)).slice(0, 4)
}
