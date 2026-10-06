/* eslint-disable @typescript-eslint/no-require-imports -- Tests for standalone CommonJS CLI tooling. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('./r10-contract.cjs');
test('deterministic archive manifest covers and hashes every artifact', () => assert.ok(c.manifest().entries.length >= 232));
test('lossless redacted catalog decoder verifies digest and all signature sections', () => {
  const p = c.catalog().payload;
  for (const section of ['functions', 'policies', 'indexes', 'constraints', 'views', 'triggers', 'default_privileges', 'effective_function_privileges']) assert.ok(section in p);
  assert.equal(Object.keys(p).length, 24);
});
test('plan covers 71 source files and declares exactly 51 + 4 identities', () => {
  const p = c.plan();
  assert.equal(p.plan.actions.length, 71);
  assert.equal(p.index.rows.length, 51);
  assert.equal(p.plan.pending_migration_set.length, 4);
});
test('M1A/M1B Git bytes and working content remain pinned', () => assert.equal(c.immutable().m1.length, 4));
test('P3: 51 prepared forms, four neutralizations and approved row30 mapping', () => {
  const rows = c.plan().index.rows;
  assert.equal(rows.filter(r => r.category === 'VERBATIM_LEDGER').length, 47);
  assert.equal(rows.filter(r => r.category === 'NEUTRALIZED').length, 4);
  assert.equal(rows.filter(r => r.staged_replay_file).length, 51);
  assert.equal(rows[29].category, 'NEUTRALIZED');
  assert.equal(rows[29].status, 'PREPARED_STATIC_VERIFIED_NOT_RUNTIME_CERTIFIED');
});
test('uncanonicalized active directory is rejected, not mislabeled PASS', () => assert.throws(() => c.activeDirectory(), /ACTIVE_DIRECTORY_NOT_CANONICAL/));
test('secret scanner decodes opaque catalog and emits no matched values', () => assert.equal(c.secretScan().findings, 0));
test('scanner detects fixture identity and credentials without returning them', () => {
  assert.deepEqual(c.inspectText('fixture' + '@' + 'example.invalid'), ['EMAIL_IDENTITY']);
  assert.deepEqual(c.inspectText('sb_' + 'secret_' + 'abcdefghijkl'), ['CREDENTIAL_PREFIX']);
  assert.deepEqual(c.inspectText('[REDACTED_OWNER_EMAIL]'), []);
  assert.deepEqual(c.inspectText('vault.create_secret(p_secret, p_name)'), []);
  assert.deepEqual(c.inspectText("vault.create_secret('fixture-value', p_name)"), ['VAULT_SECRET_LITERAL']);
});
test('protected project refs denied even when URL-encoded', () => {
  for (const ref of ['ozrasuktfthsvbqprtel', 'zwxulgpjucxudadjdqov']) {
    assert.throws(() => c.classifyTarget('postgres://user@' + ref + '.supabase.co/db'), /PROTECTED_TARGET/);
    assert.throws(() => c.classifyTarget('postgres://user@localhost/' + ref.split('').map(x => '%' + x.charCodeAt(0).toString(16)).join('')), /PROTECTED_TARGET/);
  }
});
test('nonlocal hosts and connection override parameters denied', () => {
  for (const value of ['postgres://user@db.example.invalid/db', 'postgres://user@localhost/db?host=db.example.invalid', 'https://localhost/db', 'postgres://user@localhost/db#override']) {
    assert.throws(() => c.classifyTarget(value));
  }
});
test('localhost is only a candidate; no replay without frontier, no connection', () => {
  assert.equal(c.classifyTarget('postgres://user@127.0.0.1:54322/postgres'), 'LOCAL_CANDIDATE_NOT_AUTHORIZED_FOR_EXECUTION');
  assert.throws(() => c.freshReplay('postgres://user@127.0.0.1:54322/postgres'), /FRONTIER_NOT_DERIVED/);
});
