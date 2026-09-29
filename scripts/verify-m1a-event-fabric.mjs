import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath =
  '../supabase/migrations/20260929211421_m1a_event_fabric_safety_contract.sql'

const [
  migration,
  contracts,
  handlers,
  relay,
  worker,
  health,
  cronRoute,
  vercel,
  packageJson,
] = await Promise.all([
  readFile(new URL(migrationPath, import.meta.url), 'utf8'),
  readFile(new URL('../lib/event-fabric/contracts.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/event-fabric/handlers.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/event-fabric/relay.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/event-fabric/worker.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/event-fabric/health.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/cron/event-fabric/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
])

// Exactly the frozen additive columns.
for (const column of [
  'user_id uuid',
  "producer text not null default 'business'",
  'event_version smallint not null default 1',
  'correlation_id uuid not null default gen_random_uuid()',
  'causation_id uuid',
  'dedupe_key text',
]) {
  assert.equal(migration.includes(column), true, 'missing outbox contract: ' + column)
}

for (const column of [
  'outbox_event_id uuid references public.transactional_outbox(id) on delete restrict',
  'correlation_id uuid',
  'job_version smallint not null default 1',
]) {
  assert.equal(migration.includes(column), true, 'missing job contract: ' + column)
}

// Scope-aware dedupe: 3 outbox + 3 jobs.
for (const indexName of [
  'uq_transactional_outbox_dedupe_company',
  'uq_transactional_outbox_dedupe_personal',
  'uq_transactional_outbox_dedupe_platform',
  'uq_background_jobs_dedupe_company',
  'uq_background_jobs_dedupe_personal',
  'uq_background_jobs_dedupe_platform',
]) {
  assert.equal(migration.includes(indexName), true, 'missing scope-aware index: ' + indexName)
}

assert.match(migration, /company_id, producer, event_type, dedupe_key/)
assert.match(migration, /user_id, producer, event_type, dedupe_key/)
assert.match(migration, /company_id, job_type, dedupe_key/)
assert.match(migration, /user_id, job_type, dedupe_key/)

// Claim isolation must be structural and coexist in one queue.
assert.match(
  migration,
  /create or replace function public\.claim_event_fabric_jobs[\s\S]*outbox_event_id is not null/,
)
assert.match(
  migration,
  /create or replace function public\.claim_background_jobs[\s\S]*outbox_event_id is null/,
)
assert.match(migration, /for update skip locked/)

// Retention / destructive privilege hardening.
assert.match(
  migration,
  /revoke delete on table public\.transactional_outbox from service_role/,
)
assert.match(
  migration,
  /revoke truncate on table public\.transactional_outbox from service_role/,
)

// Security-definer boundaries use fixed pg_catalog search_path.
for (const fn of [
  'claim_background_jobs',
  'claim_event_fabric_jobs',
  'orcaly_dispatch_outbox_event',
  'orcaly_settle_outbox_failure',
]) {
  const start = migration.indexOf('function public.' + fn)
  assert.notEqual(start, -1, 'missing privileged function ' + fn)
  const fragment = migration.slice(start, start + 6500)
  assert.match(fragment, /security definer/)
  assert.match(fragment, /set search_path = pg_catalog/)
}

// RPC browser denial.
for (const fn of [
  'claim_event_fabric_jobs',
  'orcaly_dispatch_outbox_event',
  'orcaly_settle_outbox_failure',
]) {
  assert.equal(
    migration.includes(
      'revoke all on function public.' + fn,
    ),
    true,
    'missing revoke for ' + fn,
  )
}
assert.match(migration, /grant execute on function public\.claim_event_fabric_jobs/)
assert.match(migration, /to service_role/)

// Payload bounds.
assert.match(migration, /octet_length\(payload::text\) <= 32768/)
assert.match(migration, /octet_length\(payload::text\) <= 8192/)
assert.equal(contracts.includes('EVENT_PAYLOAD_MAX_BYTES = 32 * 1024'), true)
assert.equal(contracts.includes('RELAY_JOB_PAYLOAD_MAX_BYTES = 8 * 1024'), true)

// Known producer contracts are validation-only: no fake consumer.
for (const eventType of [
  'order.created',
  'order.ready',
  'payment.confirmed',
  'proposal.accepted',
]) {
  assert.equal(contracts.includes("eventType: '" + eventType + "'"), true)
}
assert.equal((contracts.match(/consumers: \[\]/g) || []).length, 4)

// Nested secret-class validation exists.
assert.match(contracts, /payloadHasForbiddenSecret\(item\)/)
assert.match(contracts, /FORBIDDEN_SECRET_KEYS/)

// Worker can only claim Event Fabric jobs.
assert.equal(worker.includes("db.rpc('claim_event_fabric_jobs'"), true)
assert.equal(worker.includes("db.rpc('claim_background_jobs'"), false)
assert.equal(worker.includes('validateEventRecord(event)'), true)
assert.equal(worker.includes('handlerAcceptsEvent(handler, event)'), true)
assert.equal(worker.includes('handler.isAlreadyApplied(context)'), true)

// Relay never executes domain handlers.
assert.equal(relay.includes('handler.execute'), false)
assert.equal(relay.includes("'orcaly_dispatch_outbox_event'"), true)
assert.equal(relay.includes("'orcaly_settle_outbox_failure'"), true)

// Static handler registry rejects duplicate ownership; production registry is empty.
assert.match(handlers, /Duplicate Event Fabric handler ownership/)
assert.match(handlers, /const HANDLER_REGISTRY = buildHandlerRegistry\(\[\]\)/)

// Dedicated cron boundary only.
assert.equal(
  cronRoute.includes('ORCALY_EVENT_FABRIC_CRON_SECRET'),
  true,
)
assert.equal(cronRoute.includes('process.env.CRON_SECRET'), false)
assert.equal(cronRoute.includes('ORCALY_EVENT_FABRIC_ENABLED'), true)
assert.equal(cronRoute.includes('timingSafeEqual'), true)
assert.equal(cronRoute.includes('searchParams'), false)
assert.equal(cronRoute.includes('cookie'), false)

const authCheck = cronRoute.indexOf('timingSafeSecretEqual(configuredSecret, suppliedSecret)')
const serviceRoleLoad = cronRoute.indexOf("await import('@/lib/company-access')")
assert.ok(authCheck >= 0 && serviceRoleLoad > authCheck)

// Health telemetry never selects raw payload.
assert.equal(health.includes("select('id,event_type,status,created_at,available_at')"), true)
assert.equal(health.includes("select('id,job_type,status,created_at,run_after,outbox_event_id')"), true)
assert.equal(/\.select\([^\n]*payload/.test(health), false)

// No scheduler activation in this mission.
assert.equal(vercel.includes('/api/cron/event-fabric'), false)

// Canonical test gate must include this verifier.
const parsedPackage = JSON.parse(packageJson)
assert.equal(
  parsedPackage.scripts['verify:m1a-event-fabric'],
  'node scripts/verify-m1a-event-fabric.mjs',
)
assert.equal(
  String(parsedPackage.scripts.test).includes('npm run verify:m1a-event-fabric'),
  true,
)

console.log('M1A Event Fabric static contract checks: PASS')
