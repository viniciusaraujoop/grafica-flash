import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260816155115_operational_foundation_v1.sql',
)
const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

test('migration is additive and creates the four required tables', () => {
  for (const table of [
    'feature_flags',
    'company_feature_flags',
    'operational_events',
    'automation_jobs',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
  }

  assert.doesNotMatch(sql, /drop\s+table/)
  assert.doesNotMatch(sql, /drop\s+column/)
  assert.doesNotMatch(sql, /truncate\s+/)
})

test('migration enforces idempotency and efficient entity timeline access', () => {
  assert.match(sql, /unique\s*\(company_id,\s*idempotency_key\)/)
  assert.match(sql, /operational_events_entity_timeline_idx/)
  assert.match(sql, /company_id,\s*entity_type,\s*entity_id,\s*occurred_at desc/)
  assert.match(sql, /automation_jobs_due_idx/)
})

test('migration enables RLS, tenant policy and least-privilege grants', () => {
  for (const table of [
    'feature_flags',
    'company_feature_flags',
    'operational_events',
    'automation_jobs',
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
  }

  assert.match(sql, /create policy operational_events_select_company/)
  assert.match(sql, /member\.user_id = \(select auth\.uid\(\)\)/)
  assert.match(sql, /member\.company_id = operational_events\.company_id/)
  assert.match(sql, /revoke all privileges on table public\.automation_jobs/)
  assert.match(sql, /grant select on table public\.operational_events to authenticated/)
  assert.doesNotMatch(sql, /grant\s+insert[^;]+operational_events\s+to\s+authenticated/)
})

test('migration keeps events append-only and all rollouts disabled', () => {
  assert.match(sql, /operational_events_append_only/)
  assert.match(sql, /before update or delete on public\.operational_events/)

  const featureRows = sql.match(/\('[a-z0-9_]+',\s*'[^']+',\s*false,\s*true\)/g) || []
  assert.equal(featureRows.length, 7)
})
