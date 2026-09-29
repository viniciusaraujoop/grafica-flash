import assert from 'node:assert/strict'
import {
  CompanyTimezoneRequiredError,
  InvalidCompanyTimezoneError,
  companyLocalToUtc,
  isValidIanaTimezone,
  normalizeIanaTimezone,
  requireCompanyTimezone,
  resolveCompanyTimezone,
  utcToCompanyLocal,
} from '../lib/company-timezone.ts'

const validTimezones = [
  'UTC',
  'America/Maceio',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Rio_Branco',
]

for (const timezone of validTimezones) {
  assert.equal(isValidIanaTimezone(timezone), true, `${timezone} should be valid`)
  assert.ok(normalizeIanaTimezone(timezone))
}

for (const timezone of [null, undefined, '', '-03:00', 'GMT-3', 'Brasília', 'America/Not_A_Zone', 'Etc/GMT+3']) {
  assert.equal(isValidIanaTimezone(timezone), false, `${String(timezone)} should be rejected`)
}

const utcInstant = '2026-09-10T15:00:00.000Z'
assert.equal(utcToCompanyLocal(utcInstant, 'UTC'), '2026-09-10T15:00:00')
assert.equal(utcToCompanyLocal(utcInstant, 'America/Maceio'), '2026-09-10T12:00:00')
assert.equal(utcToCompanyLocal(utcInstant, 'America/Sao_Paulo'), '2026-09-10T12:00:00')
assert.equal(utcToCompanyLocal(utcInstant, 'America/Manaus'), '2026-09-10T11:00:00')
assert.equal(utcToCompanyLocal(utcInstant, 'America/Rio_Branco'), '2026-09-10T10:00:00')
assert.equal(companyLocalToUtc('2026-09-10T12:00:00', 'America/Maceio'), utcInstant)
assert.equal(companyLocalToUtc('2026-09-10T15:00:00', 'UTC'), utcInstant)

assert.throws(() => companyLocalToUtc('2026-02-31T12:00:00', 'America/Maceio'), InvalidCompanyTimezoneError)
assert.throws(() => companyLocalToUtc('2026-09-10T12:00:00', '-03:00'), InvalidCompanyTimezoneError)

const companyId = '11111111-1111-4111-8111-111111111111'
function fakeDb(timezone) {
  return {
    from(table) {
      assert.equal(table, 'companies')
      return {
        select(selection) {
          assert.equal(selection, 'timezone')
          return {
            eq(column, value) {
              assert.equal(column, 'id')
              assert.equal(value, companyId)
              return {
                async maybeSingle() {
                  return { data: { timezone }, error: null }
                },
              }
            },
          }
        },
      }
    },
  }
}

assert.equal(await resolveCompanyTimezone(companyId, fakeDb('America/Maceio')), 'America/Maceio')
assert.equal(await resolveCompanyTimezone(companyId, fakeDb(null)), null)
await assert.rejects(() => resolveCompanyTimezone(companyId, fakeDb('Invalid/Zone')), InvalidCompanyTimezoneError)
await assert.rejects(() => requireCompanyTimezone(companyId, fakeDb(null)), CompanyTimezoneRequiredError)
assert.equal(await requireCompanyTimezone(companyId, fakeDb('UTC')), 'UTC')

console.log('Orçaly company timezone foundation checks: PASS')
