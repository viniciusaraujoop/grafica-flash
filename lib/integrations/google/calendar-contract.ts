import { createHash } from 'node:crypto'

export const GOOGLE_CALENDAR_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const

export const GOOGLE_CALENDAR_ENTITY_TYPES = [
  'appointment',
  'meeting',
  'service_visit',
  'scheduled_task',
  'scheduled_delivery',
] as const

export type GoogleCalendarEntityType = (typeof GOOGLE_CALENDAR_ENTITY_TYPES)[number]
export type GoogleCalendarDeletePolicy = 'unlink' | 'cancel' | 'delete'

export type CalendarEventDTO = {
  entityType: GoogleCalendarEntityType
  entityId: string
  title: string
  description: string | null
  start: string
  end: string
  timezone: string | null
  location: string | null
  attendees: string[]
  source: 'orcaly'
  metadata: Record<string, unknown>
}

export type GoogleCalendarListItem = {
  id: string
  summary: string
  timeZone: string | null
  accessRole: string
  primary: boolean
  writable: boolean
}

export class GoogleCalendarContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleCalendarContractError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new GoogleCalendarContractError('Campo obrigatório ausente.')
  if (text.length > maxLength) throw new GoogleCalendarContractError('Campo excede o tamanho permitido.')
  return text || null
}

export function isGoogleCalendarEntityType(value: unknown): value is GoogleCalendarEntityType {
  return typeof value === 'string' && (GOOGLE_CALENDAR_ENTITY_TYPES as readonly string[]).includes(value)
}

export function normalizeCalendarDeletePolicy(value: unknown): GoogleCalendarDeletePolicy {
  return value === 'cancel' || value === 'delete' ? value : 'unlink'
}

export function splitGrantedScopes(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return [...new Set(value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean))].sort()
}

export function missingCalendarScopes(granted: readonly string[]) {
  const set = new Set(granted)
  return GOOGLE_CALENDAR_REQUIRED_SCOPES.filter((scope) => !set.has(scope))
}

function normalizeAttendees(value: unknown) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new GoogleCalendarContractError('Lista de participantes inválida.')
  const emails = value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
  if (emails.length > 100) throw new GoogleCalendarContractError('Participantes excedem o limite interno.')
  for (const email of emails) {
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new GoogleCalendarContractError('E-mail de participante inválido.')
    }
  }
  return [...new Set(emails)]
}

function parseAbsoluteInstant(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new GoogleCalendarContractError(`${label} é obrigatório.`)
  const input = value.trim()
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(input)) {
    throw new GoogleCalendarContractError(`${label} precisa ser um instante absoluto com Z ou offset.`)
  }
  const timestamp = Date.parse(input)
  if (!Number.isFinite(timestamp)) throw new GoogleCalendarContractError(`${label} inválido.`)
  return new Date(timestamp).toISOString()
}

export function parseCalendarEventDTO(value: unknown): CalendarEventDTO {
  if (!isRecord(value)) throw new GoogleCalendarContractError('Evento inválido.')
  if (!isGoogleCalendarEntityType(value.entityType)) throw new GoogleCalendarContractError('Tipo de entidade não permitido no calendário.')

  const entityId = cleanText(value.entityId, 512, true) as string
  const title = cleanText(value.title, 1024, true) as string
  const start = parseAbsoluteInstant(value.start, 'Início')
  const end = parseAbsoluteInstant(value.end, 'Fim')
  if (Date.parse(end) <= Date.parse(start)) throw new GoogleCalendarContractError('Fim deve ser posterior ao início.')

  return {
    entityType: value.entityType,
    entityId,
    title,
    description: cleanText(value.description, 8192),
    start,
    end,
    timezone: cleanText(value.timezone, 100),
    location: cleanText(value.location, 2048),
    attendees: normalizeAttendees(value.attendees),
    source: 'orcaly',
    metadata: isRecord(value.metadata) ? value.metadata : {},
  }
}

export function calendarMappingKey(entityType: GoogleCalendarEntityType, entityId: string) {
  const key = `${entityType}:${entityId}`
  if (key.length > 900) throw new GoogleCalendarContractError('Identificador de mapping excede o limite seguro.')
  return key
}

export function calendarExternalId(calendarId: string, eventId: string) {
  return `${encodeURIComponent(calendarId)}::${eventId}`
}

export function parseCalendarExternalId(value: string) {
  const separator = value.indexOf('::')
  if (separator <= 0) return null
  try {
    const calendarId = decodeURIComponent(value.slice(0, separator))
    const eventId = value.slice(separator + 2)
    return calendarId && eventId ? { calendarId, eventId } : null
  } catch {
    return null
  }
}

export function calendarEventVersionHash(dto: CalendarEventDTO, companyTimezone: string) {
  return createHash('sha256').update(JSON.stringify({
    entityType: dto.entityType,
    entityId: dto.entityId,
    title: dto.title,
    description: dto.description,
    start: dto.start,
    end: dto.end,
    timezone: companyTimezone,
    location: dto.location,
    attendees: dto.attendees,
  })).digest('hex')
}

export function buildGoogleCalendarEventBody(dto: CalendarEventDTO, companyTimezone: string, existingPrivate: Record<string, string> = {}) {
  const localHash = calendarEventVersionHash(dto, companyTimezone)
  return {
    summary: dto.title,
    description: dto.description || undefined,
    location: dto.location || undefined,
    start: { dateTime: dto.start, timeZone: companyTimezone },
    end: { dateTime: dto.end, timeZone: companyTimezone },
    attendees: dto.attendees.map((email) => ({ email })),
    extendedProperties: {
      private: {
        ...existingPrivate,
        orcaly_source: 'orcaly',
        orcaly_mapping_key: calendarMappingKey(dto.entityType, dto.entityId),
        orcaly_entity_type: dto.entityType,
        orcaly_entity_id: dto.entityId,
        orcaly_local_hash: localHash,
      },
    },
  }
}

export function normalizeCalendarListItem(value: unknown): GoogleCalendarListItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null
  const accessRole = typeof value.accessRole === 'string' ? value.accessRole : 'reader'
  return {
    id: value.id,
    summary: typeof value.summary === 'string' && value.summary.trim() ? value.summary : value.id,
    timeZone: typeof value.timeZone === 'string' ? value.timeZone : null,
    accessRole,
    primary: value.primary === true,
    writable: accessRole === 'owner' || accessRole === 'writer',
  }
}

export function classifyGoogleCalendarHttpStatus(status: number) {
  if (status === 401) return 'INVALID_CREDENTIAL' as const
  if (status === 403) return 'INSUFFICIENT_SCOPE' as const
  if (status === 404) return 'INVALID_DATA' as const
  if (status === 409) return 'CONFLICT' as const
  if (status === 410) return 'SYNC_TOKEN_GONE' as const
  if (status === 429) return 'RATE_LIMITED' as const
  if (status >= 500) return 'PROVIDER_DOWN' as const
  return 'INTERNAL' as const
}

export function readOrcalyEventIdentity(value: unknown) {
  if (!isRecord(value)) return null
  const extended = isRecord(value.extendedProperties) ? value.extendedProperties : null
  const privateProps = extended && isRecord(extended.private) ? extended.private : null
  if (!privateProps || privateProps.orcaly_source !== 'orcaly') return null
  if (!isGoogleCalendarEntityType(privateProps.orcaly_entity_type)) return null
  const entityId = typeof privateProps.orcaly_entity_id === 'string' ? privateProps.orcaly_entity_id : ''
  if (!entityId) return null
  return { entityType: privateProps.orcaly_entity_type, entityId }
}
