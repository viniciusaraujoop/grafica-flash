/**
 * Academy primitives: basis points, safe links/anchors, license rules and availability.
 * License handling FAILS CLOSED: full content renders only with a verified, current,
 * display-permitting license.
 */

import type { AcademyContentItem, AcademyLicense, Availability, Known } from './types'

export const MAX_BPS = 10000

export class AcademyInputError extends Error {
  readonly field: string
  constructor(field: string, message: string) { super(`${field}: ${message}`); this.field = field }
}

/** Integer basis points 0..10000. Rejects floats, negatives, overflow, NaN and non-numbers. */
export function parseBps(field: string, input: unknown): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0 || input > MAX_BPS) throw new AcademyInputError(field, 'basis points inteiros entre 0 e 10000')
  return input
}

export function known<T>(value: T): Known<T> { return { kind: 'KNOWN', value } }
export function unknown(reason: string): Known<never> { return { kind: 'UNKNOWN', reason } }
export const NOT_APPLICABLE: Known<never> = { kind: 'NOT_APPLICABLE' }

/** "50%" / "0%" for KNOWN; never a percentage for UNKNOWN or NOT_APPLICABLE. */
export function formatBpsPercent(value: Known<number>): string {
  if (value.kind === 'UNKNOWN') return 'Progresso desconhecido'
  if (value.kind === 'NOT_APPLICABLE') return 'Não se aplica'
  const bps = value.value
  const whole = Math.floor(bps / 100)
  const rest = bps % 100
  return rest ? `${whole},${String(rest).padStart(2, '0').replace(/0$/, '')}%` : `${whole}%`
}

/** Minutes/seconds formatting; UNKNOWN never becomes "0 min". */
export function formatDuration(value: Known<number>, unit: 'minutes' | 'seconds'): string {
  if (value.kind !== 'KNOWN') return value.kind === 'UNKNOWN' ? 'Duração não informada' : '—'
  const total = unit === 'seconds' ? value.value : value.value * 60
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours) return `${hours} h ${minutes} min`
  if (minutes) return seconds && unit === 'seconds' ? `${minutes} min ${seconds} s` : `${minutes} min`
  return `${seconds} s`
}

/** https only, no credentials, no whitespace/control chars, has a dotted host, bounded. */
export function safeExternalUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text || text.length > 2048 || /[\u0000-\u001f\u007f\s]/.test(text)) return null
  let url: URL
  try { url = new URL(text) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) return null
  return url.toString()
}

const ANCHOR = /^[a-z][a-z0-9-]{0,63}$/
export function isSafeAnchor(value: unknown): value is string { return typeof value === 'string' && ANCHOR.test(value) }

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/
export function isSafeId(value: unknown): value is string { return typeof value === 'string' && ID.test(value) }

export type PermittedActions = {
  displayMetadata: boolean
  renderFullContent: boolean
  download: boolean
  offlineCache: boolean
  quoteExcerpt: boolean
  summarizeWithAi: boolean
  reason: string
}

function isExpired(license: AcademyLicense, now: string): boolean {
  return license.status === 'EXPIRED' || (license.expiresAt !== null && license.expiresAt <= now)
}

/**
 * What the product may do with an item. Fail closed:
 *  - ORIGINAL (Orçaly-authored) must still be VERIFIED by the editorial owner.
 *  - PUBLIC_DOMAIN needs VERIFIED evidence.
 *  - LICENSED needs VERIFIED, not expired; offline/AI stay off until the contract says otherwise.
 *  - USER_PROVIDED renders only for its owner (enforced by persistence); never cached publicly.
 *  - EXTERNAL_LINK never renders here: metadata + link out only.
 *  - UNKNOWN: metadata only.
 */
export function permittedActions(license: AcademyLicense, now: string): PermittedActions {
  const none = (reason: string, displayMetadata = true): PermittedActions => ({ displayMetadata, renderFullContent: false, download: false, offlineCache: false, quoteExcerpt: false, summarizeWithAi: false, reason })
  if (isExpired(license, now)) return none('Licença expirada.')
  switch (license.type) {
    case 'UNKNOWN': return none('Licença desconhecida: só metadados.')
    case 'EXTERNAL_LINK': return none('Conteúdo hospedado externamente: abrir na fonte original.')
    case 'ORIGINAL':
    case 'PUBLIC_DOMAIN':
      return license.status === 'VERIFIED'
        ? { displayMetadata: true, renderFullContent: true, download: license.type === 'PUBLIC_DOMAIN', offlineCache: true, quoteExcerpt: true, summarizeWithAi: false, reason: 'Licença verificada.' }
        : none('Licença ainda não verificada.')
    case 'LICENSED':
      return license.status === 'VERIFIED'
        ? { displayMetadata: true, renderFullContent: true, download: false, offlineCache: false, quoteExcerpt: true, summarizeWithAi: false, reason: 'Licença verificada; download, offline e IA dependem do contrato.' }
        : none('Licença de terceiro não verificada.')
    case 'USER_PROVIDED':
      return license.status === 'DECLARED' || license.status === 'VERIFIED'
        ? { displayMetadata: true, renderFullContent: true, download: false, offlineCache: false, quoteExcerpt: true, summarizeWithAi: false, reason: 'Material enviado pelo próprio usuário; visível só para ele.' }
        : none('Material do usuário sem declaração de direito.')
    default:
      return none('Tipo de licença inválido.', false)
  }
}

/** Availability shown to the learner. Order matters: publication > license > content presence. */
export function deriveAvailability(item: AcademyContentItem, now: string): Availability {
  if (item.publication === 'DRAFT' || item.publication === 'REVIEW') return 'COMING_SOON'
  if (item.publication === 'ARCHIVED') return 'UNAVAILABLE'
  if (item.publication === 'BLOCKED_LICENSE') return 'BLOCKED_LICENSE'
  if (item.license.type === 'EXTERNAL_LINK') return safeExternalUrl(item.source.canonicalUrl) ? 'EXTERNAL_ONLY' : 'UNAVAILABLE'
  const actions = permittedActions(item.license, now)
  if (!actions.renderFullContent) return 'BLOCKED_LICENSE'
  if ((item.type === 'VIDEO' || item.type === 'AUDIO') && item.media?.state === 'NOT_CONFIGURED') return 'COMING_SOON'
  return 'AVAILABLE'
}

export const AVAILABILITY_COPY: Record<Availability, { label: string; tone: 'success' | 'neutral' | 'warning' | 'info' | 'danger'; detail: string }> = {
  AVAILABLE: { label: 'Disponível', tone: 'success', detail: 'Pode ser lido aqui.' },
  COMING_SOON: { label: 'Em breve', tone: 'neutral', detail: 'Ainda não publicado ou em preparação.' },
  BLOCKED_LICENSE: { label: 'Bloqueado por licença', tone: 'warning', detail: 'O direito de exibir o conteúdo completo não está verificado.' },
  EXTERNAL_ONLY: { label: 'Na fonte externa', tone: 'info', detail: 'Abre no site original; não é exibido aqui.' },
  UNAVAILABLE: { label: 'Indisponível', tone: 'danger', detail: 'Retirado da biblioteca.' },
}

export const LICENSE_TYPE_LABEL = { ORIGINAL: 'Original Orçaly', PUBLIC_DOMAIN: 'Domínio público', LICENSED: 'Licenciado', USER_PROVIDED: 'Enviado por você', EXTERNAL_LINK: 'Link externo', UNKNOWN: 'Licença desconhecida' } as const
export const LICENSE_STATUS_LABEL = { VERIFIED: 'verificada', DECLARED: 'declarada', NOT_VERIFIED: 'não verificada', EXPIRED: 'expirada', NOT_APPLICABLE: 'não se aplica' } as const
