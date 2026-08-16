import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260816162948_customer_portal_read_only_v1.sql',
)
const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

test('migration is additive and depends on the Phase 1 foundation', () => {
  assert.match(sql, /create table public\.customer_portal_access/)
  assert.match(sql, /to_regclass\('public\.feature_flags'\)/)
  assert.match(sql, /to_regclass\('public\.operational_events'\)/)
  assert.doesNotMatch(sql, /drop\s+table/)
  assert.doesNotMatch(sql, /drop\s+column/)
  assert.doesNotMatch(sql, /truncate\s+/)
})

test('migration persists only a constrained unique token hash', () => {
  assert.match(sql, /token_hash text not null/)
  assert.match(sql, /token_hash ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(sql, /customer_portal_access_token_hash_uidx/)

  const tableBlock = sql.match(
    /create table public\.customer_portal_access \([\s\S]+?\n\);/,
  )?.[0] || ''
  assert.doesNotMatch(tableBlock, /\n\s*token\s+text/)
})

test('migration enforces RLS and no direct client privileges', () => {
  assert.match(
    sql,
    /alter table public\.customer_portal_access enable row level security/,
  )
  assert.match(sql, /customer_portal_access_no_direct_client_access/)
  assert.match(sql, /to anon, authenticated\s+using \(false\)/)
  assert.match(
    sql,
    /revoke all privileges on table public\.customer_portal_access\s+from public, anon, authenticated/,
  )
  assert.match(
    sql,
    /grant select, insert, update, delete\s+on table public\.customer_portal_access\s+to service_role/,
  )
  assert.doesNotMatch(
    sql,
    /grant\s+(select|insert|update|delete)[^;]+customer_portal_access[^;]+to\s+(anon|authenticated)/,
  )
})

test('rotation scopes order by company and revokes previous active access', () => {
  assert.match(sql, /orcaly_rotate_customer_portal_access/)
  assert.match(sql, /orders\.id = p_entity_id/)
  assert.match(sql, /orders\.company_id = p_company_id/)
  assert.match(
    sql,
    /where company_id = p_company_id\s+and entity_type = p_entity_type\s+and entity_id = p_entity_id/,
  )
  assert.match(sql, /customer_portal_access_active_entity_uidx/)
})

test('access activity is throttled and separate from operational timeline', () => {
  assert.match(sql, /orcaly_record_customer_portal_access/)
  assert.match(sql, /last_accessed_at < clock_timestamp\(\) - interval '15 minutes'/)
  assert.doesNotMatch(sql, /insert into public\.operational_events/)
})
