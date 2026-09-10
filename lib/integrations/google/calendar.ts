import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireCompanyTimezone } from '@/lib/company-timezone'
import { IntegrationError } from '@/lib/integrations/core/errors'
import type { IntegrationAdapter, IntegrationRuntimeContext, IntegrationSyncRequest, IntegrationSyncResult } from '@/lib/integrations/core/types'
import { parseRetryAfterMs } from '@/lib/jobs/core'
import { googleApiFetch } from '@/lib/integrations/google/oauth'
import {
  buildGoogleCalendarEventBody,
  calendarExternalId,
  calendarMappingKey,
  classifyGoogleCalendarHttpStatus,
  missingCalendarScopes,
  normalizeCalendarDeletePolicy,
  normalizeCalendarListItem,
  parseCalendarExternalId,
  readOrcalyEventIdentity,
  splitGrantedScopes,
  type CalendarEventDTO,
  type GoogleCalendarDeletePolicy,
  type GoogleCalendarEntityType,
  type GoogleCalendarListItem,
} from '@/lib/integrations/google/calendar-contract'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const CURSOR_PREFIX = 'events:'
const WATCH_RENEW_BEFORE_MS = 24 * 60 * 60 * 1000
const WATCH_TTL_SECONDS = 7 * 24 * 60 * 60

class GoogleCalendarSyncTokenGoneError extends Error {
  constructor() {
    super('Google invalidou o sync token.')
    this.name = 'GoogleCalendarSyncTokenGoneError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function providerReason(payload: unknown) {
  if (!isRecord(payload)) return null
  const error = isRecord(payload.error) ? payload.error : null
  if (!error) return null
  if (typeof error.message === 'string') return error.message.slice(0, 500)
  return null
}

async function googleCalendarRequest<T>(context: IntegrationRuntimeContext, url: string, init: RequestInit = {}): Promise<T> {
  const response = await googleApiFetch(context, url, init)
  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null)
  if (response.ok) return payload as T

  const classification = classifyGoogleCalendarHttpStatus(response.status)
  if (classification === 'SYNC_TOKEN_GONE') throw new GoogleCalendarSyncTokenGoneError()
  const reason = providerReason(payload) || `Google Calendar retornou HTTP ${response.status}.`
  if (classification === 'RATE_LIMITED') {
    throw new IntegrationError('RATE_LIMITED', reason, {
      status: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')) || undefined,
    })
  }
  if (classification === 'PROVIDER_DOWN') throw new IntegrationError('PROVIDER_DOWN', reason, { status: response.status })
  if (classification === 'INVALID_CREDENTIAL') throw new IntegrationError('INVALID_CREDENTIAL', reason, { status: response.status })
  if (classification === 'INSUFFICIENT_SCOPE') throw new IntegrationError('INSUFFICIENT_SCOPE', reason, { status: response.status })
  if (classification === 'CONFLICT') throw new IntegrationError('CONFLICT', reason, { status: response.status })
  if (classification === 'INVALID_DATA') throw new IntegrationError('INVALID_DATA', reason, { status: response.status })
  throw new IntegrationError('INTERNAL', reason, { status: response.status })
}

export async function getGrantedGoogleCalendarScopes(context: IntegrationRuntimeContext) {
  const credentials = await context.loadCredentials()
  return splitGrantedScopes(credentials?.scope)
}

export async function requireGoogleCalendarScopes(context: IntegrationRuntimeContext) {
  const granted = await getGrantedGoogleCalendarScopes(context)
  const missing = missingCalendarScopes(granted)
  if (missing.length) {
    await context.setConnectionStatus?.('REAUTH_REQUIRED', 'missing_calendar_scope')
    throw new IntegrationError('INSUFFICIENT_SCOPE', 'A conta Google não concedeu todos os escopos necessários.')
  }
  return granted
}

export async function listGoogleCalendars(context: IntegrationRuntimeContext): Promise<GoogleCalendarListItem[]> {
  await requireGoogleCalendarScopes(context)
  const calendars: GoogleCalendarListItem[] = []
  let pageToken: string | null = null

  do {
    const url = new URL(`${GOOGLE_CALENDAR_API}/users/me/calendarList`)
    url.searchParams.set('maxResults', '250')
    url.searchParams.set('showHidden', 'false')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const payload = await googleCalendarRequest<{ items?: unknown[]; nextPageToken?: string }>(context, url.toString())
    for (const item of payload.items || []) {
      const normalized = normalizeCalendarListItem(item)
      if (normalized) calendars.push(normalized)
    }
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken ? payload.nextPageToken : null
  } while (pageToken)

  return calendars
}

function configuredCalendarId(context: IntegrationRuntimeContext) {
  const value = context.connection.config.default_calendar_id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function calendarDeletePolicy(context: IntegrationRuntimeContext): GoogleCalendarDeletePolicy {
  return normalizeCalendarDeletePolicy(context.connection.config.delete_policy)
}

export async function requireWritableDefaultCalendar(context: IntegrationRuntimeContext) {
  const calendarId = configuredCalendarId(context)
  if (!calendarId) throw new IntegrationError('NOT_CONFIGURED', 'Selecione o calendário padrão antes de sincronizar.')
  const calendars = await listGoogleCalendars(context)
  const calendar = calendars.find((item) => item.id === calendarId)
  if (!calendar) throw new IntegrationError('INVALID_DATA', 'O calendário padrão não existe ou não está acessível.')
  if (!calendar.writable) throw new IntegrationError('INSUFFICIENT_SCOPE', 'O calendário padrão conectado é somente leitura.')
  return calendar
}

function cursorKey(calendarId: string) {
  return `${CURSOR_PREFIX}${calendarId}`
}

async function readSyncCursor(context: IntegrationRuntimeContext, calendarId: string) {
  const { data, error } = await context.db
    .from('integration_sync_cursors')
    .select('cursor_value')
    .eq('connection_id', context.connection.id)
    .eq('cursor_key', cursorKey(calendarId))
    .maybeSingle()
  if (error) throw error
  return typeof data?.cursor_value === 'string' && data.cursor_value ? data.cursor_value : null
}

async function writeSyncCursor(context: IntegrationRuntimeContext, calendarId: string, syncToken: string) {
  const { error } = await context.db.from('integration_sync_cursors').upsert({
    connection_id: context.connection.id,
    cursor_key: cursorKey(calendarId),
    cursor_value: syncToken,
    checkpoint: { provider: 'google_calendar', calendar_id: calendarId },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'connection_id,cursor_key' })
  if (error) throw error
}

async function clearSyncCursor(context: IntegrationRuntimeContext, calendarId: string) {
  const { error } = await context.db
    .from('integration_sync_cursors')
    .delete()
    .eq('connection_id', context.connection.id)
    .eq('cursor_key', cursorKey(calendarId))
  if (error) throw error
}

async function findLocalMapping(context: IntegrationRuntimeContext, entityType: string, entityId: string) {
  const { data, error } = await context.db.from('integration_mappings')
    .select('*')
    .eq('company_id', context.connection.companyId)
    .eq('connection_id', context.connection.id)
    .eq('entity_type', entityType)
    .eq('orcaly_entity_id', entityId)
    .maybeSingle()
  if (error) throw error
  return data as Record<string, unknown> | null
}

async function findExternalMapping(context: IntegrationRuntimeContext, entityType: string, externalId: string) {
  const { data, error } = await context.db.from('integration_mappings')
    .select('*')
    .eq('company_id', context.connection.companyId)
    .eq('connection_id', context.connection.id)
    .eq('entity_type', entityType)
    .eq('external_id', externalId)
    .maybeSingle()
  if (error) throw error
  return data as Record<string, unknown> | null
}

async function persistMapping(context: IntegrationRuntimeContext, input: {
  entityType: string
  entityId: string | null
  calendarId: string
  eventId: string
  externalVersion?: string | null
  metadata?: Record<string, unknown>
}) {
  const externalId = calendarExternalId(input.calendarId, input.eventId)
  const now = new Date().toISOString()
  const patch = {
    external_id: externalId,
    external_version: input.externalVersion || null,
    metadata: {
      ...(input.metadata || {}),
      calendar_id: input.calendarId,
      event_id: input.eventId,
      provider: 'google_calendar',
    },
    updated_at: now,
  }

  if (input.entityId) {
    const local = await findLocalMapping(context, input.entityType, input.entityId)
    if (local?.id) {
      const { data, error } = await context.db.from('integration_mappings')
        .update(patch)
        .eq('id', String(local.id))
        .eq('company_id', context.connection.companyId)
        .eq('connection_id', context.connection.id)
        .select('*')
        .single()
      if (error) throw error
      return data
    }
  }

  const external = await findExternalMapping(context, input.entityType, externalId)
  if (external?.id) {
    const { data, error } = await context.db.from('integration_mappings')
      .update({ ...patch, orcaly_entity_id: input.entityId })
      .eq('id', String(external.id))
      .eq('company_id', context.connection.companyId)
      .eq('connection_id', context.connection.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await context.db.from('integration_mappings').insert({
    company_id: context.connection.companyId,
    connection_id: context.connection.id,
    entity_type: input.entityType,
    orcaly_entity_id: input.entityId,
    external_id: externalId,
    external_version: input.externalVersion || null,
    metadata: patch.metadata,
    created_at: now,
    updated_at: now,
  }).select('*').single()
  if (error) throw error
  return data
}

function eventIdentityFromMapping(mapping: Record<string, unknown>) {
  const metadata = isRecord(mapping.metadata) ? mapping.metadata : {}
  const calendarId = typeof metadata.calendar_id === 'string' ? metadata.calendar_id : ''
  const eventId = typeof metadata.event_id === 'string' ? metadata.event_id : ''
  if (calendarId && eventId) return { calendarId, eventId }
  return parseCalendarExternalId(String(mapping.external_id || ''))
}

async function enqueueControlledFullResync(context: IntegrationRuntimeContext) {
  const row = {
    company_id: context.connection.companyId,
    job_type: 'google.calendar.full_resync',
    payload: {
      connection_id: context.connection.id,
      provider: 'google_calendar',
      requested_by: null,
      mode: 'full',
      cursor: null,
      entity: null,
      metadata: { reason: 'sync_token_gone' },
    },
    status: 'queued',
    max_attempts: 5,
    metadata: { source: 'google_calendar', reason: 'sync_token_gone' },
  }
  const { data, error } = await context.db.from('background_jobs').insert(row).select('id,status,created_at').single()
  if (!error) return { queued: true, job: data }
  if (error.code !== '23505') throw error
  const { data: existing, error: findError } = await context.db.from('background_jobs')
    .select('id,status,created_at')
    .eq('company_id', context.connection.companyId)
    .eq('job_type', 'google.calendar.full_resync')
    .eq('payload->>connection_id', context.connection.id)
    .in('status', ['queued','running','retrying'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (findError) throw findError
  return { queued: false, job: existing || null }
}

async function synchronizeCalendar(context: IntegrationRuntimeContext, request: IntegrationSyncRequest): Promise<IntegrationSyncResult> {
  const timezone = await requireCompanyTimezone(context.connection.companyId, context.db)
  const calendar = await requireWritableDefaultCalendar(context)
  const savedCursor = request.mode === 'full' ? null : await readSyncCursor(context, calendar.id)
  let pageToken: string | null = null
  let imported = 0
  let skipped = 0
  let finalSyncToken: string | null = null

  try {
    do {
      const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendar.id)}/events`)
      url.searchParams.set('maxResults', '2500')
      url.searchParams.set('showDeleted', 'true')
      url.searchParams.set('singleEvents', 'true')
      if (savedCursor) url.searchParams.set('syncToken', savedCursor)
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const payload = await googleCalendarRequest<{ items?: unknown[]; nextPageToken?: string; nextSyncToken?: string }>(context, url.toString())
      for (const rawEvent of payload.items || []) {
        if (!isRecord(rawEvent) || typeof rawEvent.id !== 'string' || !rawEvent.id) {
          skipped += 1
          continue
        }
        const identity = readOrcalyEventIdentity(rawEvent)
        const entityType = identity?.entityType || 'google_calendar_event'
        const entityId = identity?.entityId || null
        await persistMapping(context, {
          entityType,
          entityId,
          calendarId: calendar.id,
          eventId: rawEvent.id,
          externalVersion: typeof rawEvent.etag === 'string' ? rawEvent.etag : typeof rawEvent.updated === 'string' ? rawEvent.updated : null,
          metadata: {
            status: typeof rawEvent.status === 'string' ? rawEvent.status : null,
            provider_updated_at: typeof rawEvent.updated === 'string' ? rawEvent.updated : null,
            source: identity ? 'orcaly' : 'google',
            company_timezone: timezone,
            local_write_allowed: Boolean(identity),
          },
        })
        imported += 1
      }

      pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken ? payload.nextPageToken : null
      if (!pageToken && typeof payload.nextSyncToken === 'string' && payload.nextSyncToken) finalSyncToken = payload.nextSyncToken
    } while (pageToken)
  } catch (error) {
    if (error instanceof GoogleCalendarSyncTokenGoneError && savedCursor) {
      await clearSyncCursor(context, calendar.id)
      const recovery = await enqueueControlledFullResync(context)
      await context.emitAudit('calendar.sync_token_invalidated', { calendar_id: calendar.id, recovery_job_id: recovery.job?.id || null })
      return { status: 'RETRYING', imported: 0, exported: 0, skipped: 0, metadata: { full_resync_queued: true } }
    }
    throw error
  }

  if (finalSyncToken) await writeSyncCursor(context, calendar.id, finalSyncToken)
  return {
    status: 'COMPLETED',
    cursor: finalSyncToken,
    imported,
    exported: 0,
    skipped,
    metadata: { calendar_id: calendar.id, company_timezone: timezone, mode: savedCursor ? 'incremental' : 'full' },
  }
}

async function findProviderRecoveryEvent(context: IntegrationRuntimeContext, calendarId: string, dto: CalendarEventDTO) {
  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('maxResults', '10')
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.append('privateExtendedProperty', `orcaly_mapping_key=${calendarMappingKey(dto.entityType, dto.entityId)}`)
  const payload = await googleCalendarRequest<{ items?: unknown[] }>(context, url.toString())
  return (payload.items || []).find((item) => isRecord(item) && typeof item.id === 'string' && item.id) as Record<string, unknown> | undefined
}

export async function createGoogleCalendarEvent(context: IntegrationRuntimeContext, dto: CalendarEventDTO) {
  const timezone = await requireCompanyTimezone(context.connection.companyId, context.db)
  const calendar = await requireWritableDefaultCalendar(context)
  const existing = await findLocalMapping(context, dto.entityType, dto.entityId)
  if (existing) return { created: false, recovered: false, mapping: existing }

  const recoveredEvent = await findProviderRecoveryEvent(context, calendar.id, dto)
  if (recoveredEvent && typeof recoveredEvent.id === 'string') {
    const mapping = await persistMapping(context, {
      entityType: dto.entityType,
      entityId: dto.entityId,
      calendarId: calendar.id,
      eventId: recoveredEvent.id,
      externalVersion: typeof recoveredEvent.etag === 'string' ? recoveredEvent.etag : null,
      metadata: { source: 'orcaly', recovered_after_mapping_failure: true },
    })
    return { created: false, recovered: true, mapping }
  }

  const event = await googleCalendarRequest<Record<string, unknown>>(context, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendar.id)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildGoogleCalendarEventBody(dto, timezone)),
  })
  if (typeof event.id !== 'string' || !event.id) throw new IntegrationError('INVALID_DATA', 'Google criou evento sem ID utilizável.')

  const mapping = await persistMapping(context, {
    entityType: dto.entityType,
    entityId: dto.entityId,
    calendarId: calendar.id,
    eventId: event.id,
    externalVersion: typeof event.etag === 'string' ? event.etag : null,
    metadata: { source: 'orcaly', provider_updated_at: typeof event.updated === 'string' ? event.updated : null },
  })
  await context.emitAudit('calendar.event_created', { entity_type: dto.entityType, entity_id: dto.entityId, calendar_id: calendar.id })
  return { created: true, recovered: false, mapping }
}

export async function updateGoogleCalendarEvent(context: IntegrationRuntimeContext, dto: CalendarEventDTO) {
  const timezone = await requireCompanyTimezone(context.connection.companyId, context.db)
  await requireGoogleCalendarScopes(context)
  const mapping = await findLocalMapping(context, dto.entityType, dto.entityId)
  if (!mapping) throw new IntegrationError('CONFLICT', 'Evento não possui mapping externo; o Orçaly não vai adivinhar qual evento alterar.')
  const identity = eventIdentityFromMapping(mapping)
  if (!identity) throw new IntegrationError('INVALID_DATA', 'Mapping do calendário está incompleto.')

  const current = await googleCalendarRequest<Record<string, unknown>>(context, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(identity.calendarId)}/events/${encodeURIComponent(identity.eventId)}`)
  const extended = isRecord(current.extendedProperties) ? current.extendedProperties : {}
  const privateProps = isRecord(extended.private)
    ? Object.fromEntries(Object.entries(extended.private).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {}

  const event = await googleCalendarRequest<Record<string, unknown>>(context, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(identity.calendarId)}/events/${encodeURIComponent(identity.eventId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildGoogleCalendarEventBody(dto, timezone, privateProps)),
  })
  await persistMapping(context, {
    entityType: dto.entityType,
    entityId: dto.entityId,
    calendarId: identity.calendarId,
    eventId: identity.eventId,
    externalVersion: typeof event.etag === 'string' ? event.etag : null,
    metadata: { source: 'orcaly', provider_updated_at: typeof event.updated === 'string' ? event.updated : null },
  })
  await context.emitAudit('calendar.event_updated', { entity_type: dto.entityType, entity_id: dto.entityId, calendar_id: identity.calendarId })
  return event
}

export async function deleteGoogleCalendarEvent(context: IntegrationRuntimeContext, entityType: GoogleCalendarEntityType, entityId: string, policyInput?: unknown) {
  await requireGoogleCalendarScopes(context)
  const mapping = await findLocalMapping(context, entityType, entityId)
  if (!mapping) throw new IntegrationError('CONFLICT', 'Evento não possui mapping externo.')
  const identity = eventIdentityFromMapping(mapping)
  if (!identity) throw new IntegrationError('INVALID_DATA', 'Mapping do calendário está incompleto.')
  const policy = policyInput === undefined ? calendarDeletePolicy(context) : normalizeCalendarDeletePolicy(policyInput)

  if (policy === 'cancel') {
    await googleCalendarRequest(context, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(identity.calendarId)}/events/${encodeURIComponent(identity.eventId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
  } else if (policy === 'delete') {
    await googleCalendarRequest(context, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(identity.calendarId)}/events/${encodeURIComponent(identity.eventId)}`, { method: 'DELETE' })
  }

  const { error } = await context.db.from('integration_mappings')
    .delete()
    .eq('id', String(mapping.id))
    .eq('company_id', context.connection.companyId)
    .eq('connection_id', context.connection.id)
  if (error) throw error
  await context.emitAudit('calendar.event_unlinked', { entity_type: entityType, entity_id: entityId, policy })
  return { policy }
}

function calendarWebhookUrl() {
  const configured = String(process.env.ORCALY_PUBLIC_URL || '').trim()
  if (!configured) return null
  try {
    const url = new URL('/api/integrations/google/calendar/webhook', configured)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function hashChannelToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function secureCalendarChannelTokenMatches(received: string | null | undefined, expectedHash: string) {
  const receivedHash = hashChannelToken(String(received || ''))
  const left = Buffer.from(receivedHash)
  const right = Buffer.from(expectedHash)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function stopChannelAtGoogle(context: IntegrationRuntimeContext, channelId: string, resourceId: string) {
  try {
    await googleCalendarRequest(context, `${GOOGLE_CALENDAR_API}/channels/stop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: channelId, resourceId }),
    })
  } catch (error) {
    if (error instanceof IntegrationError && (error.code === 'INVALID_DATA' || error.code === 'CONFLICT')) return
    throw error
  }
}

async function scheduleWatchRenewal(db: SupabaseClient, input: { companyId: string; connectionId: string; expiresAt: string }) {
  await db.from('background_jobs')
    .delete()
    .eq('company_id', input.companyId)
    .eq('job_type', 'google.calendar.watch.renew')
    .eq('payload->>connection_id', input.connectionId)
    .in('status', ['queued','retrying'])

  const expires = Date.parse(input.expiresAt)
  const runAt = new Date(Math.max(Date.now() + 60 * 60 * 1000, expires - WATCH_RENEW_BEFORE_MS)).toISOString()
  const { error } = await db.from('background_jobs').insert({
    company_id: input.companyId,
    job_type: 'google.calendar.watch.renew',
    payload: { connection_id: input.connectionId },
    status: 'queued',
    max_attempts: 5,
    run_after: runAt,
    metadata: { source: 'google_calendar_watch' },
  })
  if (error) throw error
}

export async function stopGoogleCalendarWatches(context: IntegrationRuntimeContext) {
  const { data, error } = await context.db.from('integration_push_channels')
    .select('id,channel_id,resource_id')
    .eq('company_id', context.connection.companyId)
    .eq('connection_id', context.connection.id)
    .eq('provider', 'google_calendar')
    .eq('state', 'active')
  if (error) throw error

  for (const row of data || []) {
    await stopChannelAtGoogle(context, String(row.channel_id), String(row.resource_id))
    const { error: updateError } = await context.db.from('integration_push_channels')
      .update({ state: 'stopped', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('company_id', context.connection.companyId)
    if (updateError) throw updateError
  }
  await context.db.from('background_jobs')
    .delete()
    .eq('company_id', context.connection.companyId)
    .eq('job_type', 'google.calendar.watch.renew')
    .eq('payload->>connection_id', context.connection.id)
    .in('status', ['queued','retrying'])
}

export async function ensureGoogleCalendarWatch(context: IntegrationRuntimeContext) {
  const webhookUrl = calendarWebhookUrl()
  if (!webhookUrl) throw new IntegrationError('NOT_CONFIGURED', 'Push do Google Calendar exige ORCALY_PUBLIC_URL HTTPS configurada.')
  const calendar = await requireWritableDefaultCalendar(context)
  const channelId = randomUUID()
  const channelToken = randomBytes(32).toString('base64url')
  const watch = await googleCalendarRequest<Record<string, unknown>>(context, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendar.id)}/events/watch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: channelId,
      token: channelToken,
      type: 'web_hook',
      address: webhookUrl,
      params: { ttl: String(WATCH_TTL_SECONDS) },
    }),
  })
  const resourceId = typeof watch.resourceId === 'string' ? watch.resourceId : ''
  if (!resourceId) throw new IntegrationError('INVALID_DATA', 'Google criou canal sem resourceId.')
  const expirationMs = typeof watch.expiration === 'string' ? Number(watch.expiration) : Number(watch.expiration)
  const expiresAt = Number.isFinite(expirationMs) && expirationMs > Date.now()
    ? new Date(expirationMs).toISOString()
    : new Date(Date.now() + WATCH_TTL_SECONDS * 1000).toISOString()

  const { data: previous, error: previousError } = await context.db.from('integration_push_channels')
    .select('id,channel_id,resource_id')
    .eq('company_id', context.connection.companyId)
    .eq('connection_id', context.connection.id)
    .eq('provider', 'google_calendar')
    .eq('state', 'active')
  if (previousError) throw previousError

  const { error: insertError } = await context.db.from('integration_push_channels').insert({
    company_id: context.connection.companyId,
    connection_id: context.connection.id,
    provider: 'google_calendar',
    resource_type: 'events',
    channel_id: channelId,
    resource_id: resourceId,
    resource_uri: typeof watch.resourceUri === 'string' ? watch.resourceUri : null,
    token_hash: hashChannelToken(channelToken),
    expires_at: expiresAt,
    state: 'active',
    metadata: { calendar_id: calendar.id },
  })
  if (insertError) throw insertError

  await scheduleWatchRenewal(context.db, { companyId: context.connection.companyId, connectionId: context.connection.id, expiresAt })

  for (const row of previous || []) {
    try { await stopChannelAtGoogle(context, String(row.channel_id), String(row.resource_id)) } catch { /* new channel is already active */ }
    await context.db.from('integration_push_channels')
      .update({ state: 'stopped', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('company_id', context.connection.companyId)
  }

  await context.emitAudit('calendar.watch_started', { calendar_id: calendar.id, expires_at: expiresAt })
  return { channelId, resourceId, expiresAt }
}

export const googleCalendarAdapter: IntegrationAdapter = {
  key: 'google_calendar',
  name: 'Google Calendar',
  getCapabilities() { return ['calendar.read', 'calendar.write'] },
  async getHealth(context) {
    const startedAt = Date.now()
    try {
      const scopes = await requireGoogleCalendarScopes(context)
      const calendars = await listGoogleCalendars(context)
      const defaultCalendarId = configuredCalendarId(context)
      const selected = defaultCalendarId ? calendars.find((calendar) => calendar.id === defaultCalendarId) : null
      return {
        status: defaultCalendarId && selected?.writable ? 'CONNECTED' : 'DEGRADED',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: !defaultCalendarId ? 'Conta conectada; selecione o calendário padrão.' : selected?.writable ? 'Google Calendar operacional.' : 'Calendário padrão indisponível ou sem escrita.',
        details: { granted_scope_count: scopes.length, calendar_count: calendars.length },
      }
    } catch (error) {
      return {
        status: error instanceof IntegrationError && (error.code === 'INVALID_CREDENTIAL' || error.code === 'INSUFFICIENT_SCOPE') ? 'REAUTH_REQUIRED' : 'DEGRADED',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Falha ao validar Google Calendar.',
      }
    }
  },
  async sync(context, request) {
    return synchronizeCalendar(context, request)
  },
}
