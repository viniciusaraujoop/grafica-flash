import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = new URL('..', import.meta.url)
const rootPath = fileURLToPath(root)
const migrationPath =
  '../supabase/migrations/20260930155522_m1b_shared_audit_contract.sql'

const [migration, contracts, writer] = await Promise.all([
  readFile(new URL(migrationPath, import.meta.url), 'utf8'),
  readFile(new URL('../lib/audit/shared-audit-contracts.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/audit/shared-audit.ts', import.meta.url), 'utf8'),
])

// One canonical shared surface only.
assert.match(migration, /alter table public\.ecosystem_audit_events/)
assert.equal(migration.includes('shared_audit_events'), false)
assert.equal(migration.includes('action_audit_events'), false)

// No semantic backfill.
assert.equal(/update\s+public\.ecosystem_audit_events/i.test(migration), false)
assert.equal(migration.includes('audit_contract_version smallint,'), true)
assert.equal(
  /audit_contract_version\s+smallint\s+default/i.test(migration),
  false,
)

// New-row guard is trigger-only and SECURITY INVOKER.
assert.match(
  migration,
  /function ecosystem_private\.enforce_shared_audit_insert_contract\(\)/,
)
assert.match(
  migration,
  /enforce_shared_audit_insert_contract\(\)[\s\S]*security invoker/,
)
assert.match(
  migration,
  /if new\.audit_contract_version is null then[\s\S]*M1B audit_contract_version is required/,
)
assert.match(
  migration,
  /if new\.audit_contract_version <> 1 then[\s\S]*M1B unsupported audit_contract_version/,
)
assert.match(
  migration,
  /create trigger ecosystem_audit_events_insert_contract_guard[\s\S]*before insert on public\.ecosystem_audit_events/,
)

const rowChangeUpgrade = migration.indexOf(
  'create or replace function ecosystem_private.record_change()',
)
const versionGuard = migration.indexOf(
  'create or replace function ecosystem_private.enforce_shared_audit_insert_contract()',
)
const insertGuardTrigger = migration.indexOf(
  'create trigger ecosystem_audit_events_insert_contract_guard',
)
assert.ok(rowChangeUpgrade >= 0)
assert.ok(versionGuard > rowChangeUpgrade)
assert.ok(insertGuardTrigger > versionGuard)

// Historical actor FK is removed and no new historical ownership FK is created.
assert.match(
  migration,
  /alter table public\.ecosystem_audit_events drop constraint/,
)
for (const field of ['company_id', 'scope_user_id', 'subject_user_id']) {
  assert.equal(
    new RegExp(field + '[^\\n]*references', 'i').test(migration),
    false,
    'historical identity must not gain lifecycle FK: ' + field,
  )
}

// Storage bounds.
assert.match(migration, /octet_length\(metadata::text\) <= 8192/)
assert.match(
  migration,
  /coalesce\(octet_length\(before_snapshot::text\),0\)[\s\S]*coalesce\(octet_length\(after_snapshot::text\),0\)[\s\S]*<= 16384/,
)

// Canonical identifier bounds and ACTION dedupe shape.
for (const token of [
  'char_length(event_type) between 1 and 160',
  'char_length(resource_type) between 1 and 96',
  'char_length(entity_id) between 1 and 256',
  'char_length(request_id) between 1 and 128',
  'char_length(actor_key) between 1 and 128',
  'char_length(source) between 1 and 96',
  'char_length(product_id) between 1 and 64',
  'char_length(purpose_key) between 1 and 128',
  'char_length(dedupe_key) = 67',
  'char_length(row_table) between 1 and 128',
]) {
  assert.equal(migration.includes(token), true, 'missing M1B bound: ' + token)
}
assert.match(migration, /dedupe_key ~ '\^a1:\[0-9a-f\]\{64\}\$'/)

// Scope-aware ACTION uniqueness.
for (const indexName of [
  'uq_ecosystem_audit_action_company_dedupe',
  'uq_ecosystem_audit_action_personal_dedupe',
  'uq_ecosystem_audit_action_platform_dedupe',
]) {
  assert.equal(migration.includes(indexName), true)
}

// ROW_CHANGE is static allowlist-based and stores no whole-row snapshots.
assert.equal(
  (migration.match(/when '.*' then/g) || []).filter((item) =>
    item.includes('wealth_') || item.includes('ecosystem_'),
  ).length >= 23,
  true,
)
assert.match(migration, /M1B unreviewed ROW_CHANGE relation/)
assert.equal(
  migration.includes("v_changed_fields,\n    null,\n    null,\n    '{}'::jsonb"),
  true,
)

// Browser direct access closed; service_role is append-only.
assert.match(
  migration,
  /revoke all on table public\.ecosystem_audit_events from anon/,
)
assert.match(
  migration,
  /revoke all on table public\.ecosystem_audit_events from authenticated/,
)
assert.match(
  migration,
  /revoke all on table public\.ecosystem_audit_events from service_role/,
)
assert.match(
  migration,
  /grant select, insert on table public\.ecosystem_audit_events to service_role/,
)
assert.equal(
  /grant[^;]*(update|delete|truncate)[^;]*ecosystem_audit_events/i.test(migration),
  false,
)

// Run the real pure contract module after TypeScript transpilation.
const executableContractsSource = contracts.replace("import 'server-only'", '')
const executableContractsJs = ts.transpileModule(executableContractsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const contractModule = await import(
  'data:text/javascript;base64,' +
    Buffer.from(executableContractsJs, 'utf8').toString('base64')
)

const {
  buildCanonicalSharedAuditAction,
  deriveSharedAuditDedupeKey,
  getSharedAuditActionContract,
} = contractModule

const instanceId = '11111111-1111-4111-8111-111111111111'
const validInput = {
  actionInstanceId: instanceId,
  result: 'COMPLETED',
  resourceId: 'Verification#Case-ABC',
  requestId: 'm1b-verify-request',
  metadata: {
    check: 'writer-contract',
    passed: true,
  },
}

// Unknown ACTION fails closed.
assert.throws(
  () => getSharedAuditActionContract('platform.unknown.action'),
  (error) => error?.code === 'unknown_action',
)

// Known ACTION derives all trusted authority fields.
const canonical = buildCanonicalSharedAuditAction(
  'platform.shared_audit.verify',
  {
    ...validInput,
    actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    actor_kind: 'AI',
    actor_key: 'evil.actor',
    company_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    scope_kind: 'COMPANY',
    product_id: 'evil',
    source: 'evil',
    purpose_key: 'evil',
    dedupe_key: 'evil',
  },
)
assert.equal(canonical.audit_contract_version, 1)
assert.equal(canonical.audit_kind, 'ACTION')
assert.equal(canonical.actor_id, null)
assert.equal(canonical.actor_kind, 'SYSTEM')
assert.equal(canonical.actor_key, 'system.shared_audit_verifier')
assert.equal(canonical.scope_kind, 'PLATFORM')
assert.equal(canonical.company_id, null)
assert.equal(canonical.scope_user_id, null)
assert.equal(canonical.product_id, null)
assert.equal(canonical.source, 'm1b.shared_audit')
assert.equal(canonical.purpose_key, 'shared_audit.verification')
assert.equal(canonical.entity_id, 'Verification#Case-ABC')
assert.match(canonical.dedupe_key, /^a1:[0-9a-f]{64}$/)

// Dedupe is deterministic and lifecycle/action identity sensitive.
const sameKey = deriveSharedAuditDedupeKey(
  'platform.shared_audit.verify',
  1,
  instanceId,
  'COMPLETED',
)
assert.equal(sameKey, canonical.dedupe_key)
assert.notEqual(
  sameKey,
  deriveSharedAuditDedupeKey(
    'platform.shared_audit.verify',
    1,
    instanceId,
    'FAILED',
  ),
)
assert.notEqual(
  sameKey,
  deriveSharedAuditDedupeKey(
    'platform.shared_audit.verify',
    2,
    instanceId,
    'COMPLETED',
  ),
)
assert.notEqual(
  sameKey,
  deriveSharedAuditDedupeKey(
    'platform.shared_audit.verify',
    1,
    '22222222-2222-4222-8222-222222222222',
    'COMPLETED',
  ),
)

// Metadata uses positive allowlist + recursive secret rejection.
assert.throws(
  () =>
    buildCanonicalSharedAuditAction('platform.shared_audit.verify', {
      ...validInput,
      metadata: { unknown: 'nope' },
    }),
  (error) => error?.code === 'metadata_key_not_allowed',
)
assert.throws(
  () =>
    buildCanonicalSharedAuditAction('platform.shared_audit.verify', {
      ...validInput,
      metadata: { check: 'ok', password: 'secret' },
    }),
  (error) => error?.code === 'metadata_secret_key',
)

// Writer inserts first and only resolves duplicate after DB uniqueness.
const insertPosition = writer.indexOf(".insert(row)")
const conflictPosition = writer.indexOf("error?.code !== '23505'")
const duplicateLookupPosition = writer.indexOf(
  ".eq('dedupe_key', row.dedupe_key)",
)
assert.ok(insertPosition >= 0)
assert.ok(conflictPosition > insertPosition)
assert.ok(duplicateLookupPosition > conflictPosition)
assert.equal(writer.includes('actorId:'), false)
assert.equal(writer.includes('companyId:'), false)
assert.equal(writer.includes('dedupeKey:'), true)

// Execute the real writer against a deterministic mock database.
const writerWithoutServerOnly = writer.replace("import 'server-only'\n\n", '')
const writerWithoutTypeImport = writerWithoutServerOnly.replace(
  "import type { SupabaseClient } from '@supabase/supabase-js'\n",
  '',
)
const writerWithoutContractImport = writerWithoutTypeImport.replace(
  /import \{[\s\S]*?\} from '\.\/shared-audit-contracts'\n\n/,
  '',
)
const executableWriterJs = ts.transpileModule(
  executableContractsSource + '\n' + writerWithoutContractImport,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText
const writerModule = await import(
  'data:text/javascript;base64,' +
    Buffer.from(executableWriterJs, 'utf8').toString('base64')
)

function makeAuditDbMock({ duplicate = false, existing = null } = {}) {
  const state = {
    inserts: [],
    duplicateLookups: 0,
  }

  const db = {
    from(table) {
      assert.equal(table, 'ecosystem_audit_events')

      return {
        insert(row) {
          state.inserts.push(row)
          return {
            select() {
              return {
                async single() {
                  if (duplicate) {
                    return { data: null, error: { code: '23505' } }
                  }
                  return {
                    data: { id: '33333333-3333-4333-8333-333333333333', ...row },
                    error: null,
                  }
                },
              }
            },
          }
        },
        select() {
          state.duplicateLookups += 1
          const chain = {
            eq() {
              return chain
            },
            is() {
              return chain
            },
            async maybeSingle() {
              return { data: existing, error: null }
            },
          }
          return chain
        },
      }
    },
  }

  return { db, state }
}

const writerInput = {
  ...validInput,
  actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actor_kind: 'AI',
  actor_key: 'evil.actor',
  company_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  scope_kind: 'COMPANY',
  product_id: 'evil',
  source: 'evil',
  purpose_key: 'evil',
  dedupe_key: 'evil',
}
const firstMock = makeAuditDbMock()
const firstWrite = await writerModule.writeSharedAuditAction(
  firstMock.db,
  'platform.shared_audit.verify',
  writerInput,
)
assert.equal(firstWrite.inserted, true)
assert.equal(firstMock.state.inserts.length, 1)
assert.equal(firstMock.state.inserts[0].actor_id, null)
assert.equal(firstMock.state.inserts[0].actor_kind, 'SYSTEM')
assert.equal(firstMock.state.inserts[0].actor_key, 'system.shared_audit_verifier')
assert.equal(firstMock.state.inserts[0].scope_kind, 'PLATFORM')
assert.equal(firstMock.state.inserts[0].company_id, null)
assert.equal(firstMock.state.inserts[0].source, 'm1b.shared_audit')
assert.equal(firstMock.state.inserts[0].dedupe_key, canonical.dedupe_key)

const duplicateExisting = {
  id: '44444444-4444-4444-8444-444444444444',
  event_type: canonical.event_type,
  key_version: canonical.key_version,
  action_instance_id: canonical.action_instance_id,
  result: canonical.result,
  source: canonical.source,
  dedupe_key: canonical.dedupe_key,
}
const duplicateMock = makeAuditDbMock({
  duplicate: true,
  existing: duplicateExisting,
})
const duplicateWrite = await writerModule.writeSharedAuditAction(
  duplicateMock.db,
  'platform.shared_audit.verify',
  validInput,
)
assert.equal(duplicateWrite.inserted, false)
assert.equal(duplicateWrite.id, duplicateExisting.id)
assert.equal(duplicateWrite.dedupeKey, canonical.dedupe_key)
assert.equal(duplicateMock.state.inserts.length, 1)
assert.equal(duplicateMock.state.duplicateLookups, 1)

// ACTION application insertion ownership must remain centralized.
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

const appFiles = [
  ...(await walk(path.join(rootPath, 'app'))),
  ...(await walk(path.join(rootPath, 'lib'))),
]
const directWriters = []

for (const filename of appFiles) {
  const body = await readFile(filename, 'utf8')
  if (
    /\.from\(['"]ecosystem_audit_events['"]\)[\s\S]{0,300}\.insert\(/m.test(
      body,
    )
  ) {
    directWriters.push(path.relative(rootPath, filename))
  }
}

assert.deepEqual(directWriters, ['lib/audit/shared-audit.ts'])

// M1B remains independent from Event Fabric.
assert.equal(writer.includes('transactional_outbox'), false)
assert.equal(writer.includes('background_jobs'), false)
assert.equal(writer.includes('event_idempotency'), false)
assert.equal(contracts.includes('transactional_outbox'), false)

// Explicit typecheck gate.
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const typecheck = spawnSync(npmCommand, ['run', 'typecheck'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
assert.equal(
  typecheck.status,
  0,
  'M1B explicit typecheck failed with exit code ' + typecheck.status,
)
console.log('M1B explicit typecheck exit code: ' + typecheck.status)

// Scoped lint is a hard M1B gate.
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const scopedLint = spawnSync(
  npxCommand,
  [
    'eslint',
    'lib/audit/shared-audit-contracts.ts',
    'lib/audit/shared-audit.ts',
    'scripts/verify-m1b-shared-audit.mjs',
  ],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
)
assert.equal(
  scopedLint.status,
  0,
  'M1B scoped ESLint failed with exit code ' + scopedLint.status,
)
console.log('M1B scoped ESLint exit code: ' + scopedLint.status)

// Repository-wide lint is executed for evidence. A non-zero result is reported
// separately as baseline unless it points to the M1B file set above.
const fullLint = spawnSync(npmCommand, ['run', 'lint'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
assert.equal(
  fullLint.status,
  0,
  'M1B repository-wide lint failed with exit code ' + fullLint.status,
)
console.log('M1B repository lint exit code: ' + fullLint.status)

console.log('M1B Shared Audit verification: PASS')
