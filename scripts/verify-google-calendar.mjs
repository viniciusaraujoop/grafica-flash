import assert from 'node:assert/strict'
import {
  buildGoogleCalendarEventBody,
  calendarExternalId,
  calendarMappingKey,
  classifyGoogleCalendarHttpStatus,
  missingCalendarScopes,
  normalizeCalendarDeletePolicy,
  normalizeCalendarListItem,
  parseCalendarEventDTO,
  parseCalendarExternalId,
  readOrcalyEventIdentity,
  splitGrantedScopes,
} from '../lib/integrations/google/calendar-contract.ts'

const scopes = splitGrantedScopes('openid https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly')
assert.deepEqual(missingCalendarScopes(scopes), [])
assert.equal(missingCalendarScopes(['openid']).length, 2)
assert.equal(normalizeCalendarDeletePolicy('delete'), 'delete')
assert.equal(normalizeCalendarDeletePolicy('garbage'), 'unlink')
assert.equal(classifyGoogleCalendarHttpStatus(410), 'SYNC_TOKEN_GONE')
assert.equal(classifyGoogleCalendarHttpStatus(429), 'RATE_LIMITED')
assert.equal(classifyGoogleCalendarHttpStatus(500), 'PROVIDER_DOWN')

const dto = parseCalendarEventDTO({
  entityType: 'appointment',
  entityId: 'apt-123',
  title: 'Consulta',
  description: 'Descrição segura',
  start: '2026-09-10T15:00:00Z',
  end: '2026-09-10T16:00:00Z',
  location: 'Maceió',
  attendees: ['CLIENTE@example.com'],
  metadata: {},
})
assert.equal(dto.attendees[0], 'cliente@example.com')
assert.throws(() => parseCalendarEventDTO({ ...dto, start: '2026-09-10T15:00:00', end: '2026-09-10T16:00:00Z' }))
assert.throws(() => parseCalendarEventDTO({ ...dto, end: dto.start }))

const body = buildGoogleCalendarEventBody(dto, 'America/Maceio')
assert.equal(body.start.timeZone, 'America/Maceio')
assert.equal(body.extendedProperties.private.orcaly_source, 'orcaly')
assert.equal(body.extendedProperties.private.orcaly_mapping_key, calendarMappingKey('appointment', 'apt-123'))
const identity = readOrcalyEventIdentity(body)
assert.deepEqual(identity, { entityType: 'appointment', entityId: 'apt-123' })

const external = calendarExternalId('primary@example.com', 'event-1')
assert.deepEqual(parseCalendarExternalId(external), { calendarId: 'primary@example.com', eventId: 'event-1' })
assert.equal(parseCalendarExternalId('broken'), null)

assert.equal(normalizeCalendarListItem({ id: 'primary', summary: 'Agenda', accessRole: 'owner', primary: true })?.writable, true)
assert.equal(normalizeCalendarListItem({ id: 'readonly', accessRole: 'reader' })?.writable, false)
assert.equal(normalizeCalendarListItem({ accessRole: 'owner' }), null)

console.log('Orçaly Google Calendar contract checks: PASS')
