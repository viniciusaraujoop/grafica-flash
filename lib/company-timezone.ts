import type { SupabaseClient } from '@supabase/supabase-js'

const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
const MAX_TIMEZONE_LENGTH = 100
const HOUR_MS = 60 * 60 * 1000

export class CompanyTimezoneRequiredError extends Error {
  readonly code = 'COMPANY_TIMEZONE_REQUIRED'

  constructor() {
    super('A empresa precisa configurar um fuso horário antes desta operação.')
    this.name = 'CompanyTimezoneRequiredError'
  }
}

export class InvalidCompanyTimezoneError extends Error {
  readonly code = 'INVALID_COMPANY_TIMEZONE'

  constructor(message = 'O fuso horário informado não é um timezone IANA válido.') {
    super(message)
    this.name = 'InvalidCompanyTimezoneError'
  }
}

function cleanTimezoneInput(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeIanaTimezone(value: unknown): string | null {
  const input = cleanTimezoneInput(value)
  if (!input || input.length > MAX_TIMEZONE_LENGTH) return null

  if (input.toUpperCase() === 'UTC') return 'UTC'

  // Reject fixed-offset labels. Operational company time must be backed by a real IANA zone.
  if (!input.includes('/') || /^Etc\/GMT[+-]\d+$/i.test(input)) return null

  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: input })
      .resolvedOptions()
      .timeZone

    if (!resolved) return null
    if (resolved.toUpperCase() === 'UTC' || resolved === 'Etc/UTC' || resolved === 'Etc/GMT') return 'UTC'
    if (!resolved.includes('/') || /^Etc\/GMT[+-]\d+$/i.test(resolved)) return null
    return resolved
  } catch {
    return null
  }
}

export function isValidIanaTimezone(value: unknown): boolean {
  return normalizeIanaTimezone(value) !== null
}

export function requireValidIanaTimezone(value: unknown): string {
  const normalized = normalizeIanaTimezone(value)
  if (!normalized) throw new InvalidCompanyTimezoneError()
  return normalized
}

type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

function parseLocalDateTime(value: string): LocalParts {
  const match = LOCAL_DATETIME_PATTERN.exec(value)
  if (!match) throw new InvalidCompanyTimezoneError('Data/hora local inválida. Use YYYY-MM-DDTHH:mm[:ss[.SSS]].')

  const parts: LocalParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
    millisecond: Number(String(match[7] || '').padEnd(3, '0') || 0),
  }

  const naive = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  ))

  if (
    naive.getUTCFullYear() !== parts.year
    || naive.getUTCMonth() !== parts.month - 1
    || naive.getUTCDate() !== parts.day
    || naive.getUTCHours() !== parts.hour
    || naive.getUTCMinutes() !== parts.minute
    || naive.getUTCSeconds() !== parts.second
  ) {
    throw new InvalidCompanyTimezoneError('Data/hora local inválida.')
  }

  return parts
}

function formatterFor(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
}

function localPartsAt(instantMs: number, timezone: string): LocalParts {
  const parts = formatterFor(timezone).formatToParts(new Date(instantMs))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    millisecond: ((instantMs % 1000) + 1000) % 1000,
  }
}

function utcLike(parts: LocalParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  )
}

function sameLocalDateTime(left: LocalParts, right: LocalParts) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second
    && left.millisecond === right.millisecond
}

function offsetAt(instantMs: number, timezone: string) {
  const roundedInstant = Math.floor(instantMs / 1000) * 1000
  const parts = localPartsAt(roundedInstant, timezone)
  return utcLike({ ...parts, millisecond: 0 }) - roundedInstant
}

export function utcToCompanyLocal(value: string | Date, timezoneValue: unknown): string {
  const timezone = requireValidIanaTimezone(timezoneValue)
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new InvalidCompanyTimezoneError('Instante UTC inválido.')

  const parts = localPartsAt(date.getTime(), timezone)
  const pad = (number: number, size = 2) => String(number).padStart(size, '0')
  const millis = parts.millisecond ? `.${pad(parts.millisecond, 3)}` : ''

  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${millis}`
}

export function companyLocalToUtc(value: string, timezoneValue: unknown): string {
  const timezone = requireValidIanaTimezone(timezoneValue)
  const target = parseLocalDateTime(value)
  const targetUtcLike = utcLike(target)

  // Probe offsets around the target. This handles DST and historical offset transitions
  // without relying on a fixed numeric offset.
  const offsets = new Set<number>()
  for (const deltaHours of [-36, -12, 0, 12, 36]) {
    offsets.add(offsetAt(targetUtcLike + deltaHours * HOUR_MS, timezone))
  }

  const candidates: number[] = []
  for (const offset of offsets) {
    const candidate = targetUtcLike - offset
    const rendered = localPartsAt(candidate, timezone)
    if (sameLocalDateTime(rendered, target)) candidates.push(candidate)
  }

  const uniqueCandidates = [...new Set(candidates)].sort((a, b) => a - b)
  if (uniqueCandidates.length === 0) {
    throw new InvalidCompanyTimezoneError('Este horário local não existe no fuso configurado, possivelmente por transição de horário de verão.')
  }
  if (uniqueCandidates.length > 1) {
    throw new InvalidCompanyTimezoneError('Este horário local é ambíguo no fuso configurado. Informe um instante absoluto ou escolha outro horário.')
  }

  return new Date(uniqueCandidates[0]).toISOString()
}

export async function resolveCompanyTimezone(
  companyId: string,
  db: Pick<SupabaseClient, 'from'>,
): Promise<string | null> {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new InvalidCompanyTimezoneError('Empresa inválida para resolução de fuso horário.')
  }

  const { data, error } = await db
    .from('companies')
    .select('timezone')
    .eq('id', companyId)
    .maybeSingle()

  if (error) throw error
  if (!data?.timezone) return null

  const timezone = normalizeIanaTimezone(data.timezone)
  if (!timezone) {
    throw new InvalidCompanyTimezoneError('A empresa possui um fuso horário armazenado inválido.')
  }

  return timezone
}

export async function requireCompanyTimezone(
  companyId: string,
  db: Pick<SupabaseClient, 'from'>,
): Promise<string> {
  const timezone = await resolveCompanyTimezone(companyId, db)
  if (!timezone) throw new CompanyTimezoneRequiredError()
  return timezone
}
