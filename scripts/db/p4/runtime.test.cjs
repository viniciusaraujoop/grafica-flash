/* eslint-disable @typescript-eslint/no-require-imports -- Node built-in test runner, no database access. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const r = require('./runtime.cjs');
const s = require('./signature.cjs');
const c = require('../r10-contract.cjs');
const a = require('./artifacts.cjs');
const fixture = () => ({ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted',
  GITHUB_REPOSITORY: 'viniciusaraujoop/grafica-flash', GITHUB_REF: 'refs/heads/reconcile/r10-production-base-canonicalization',
  GITHUB_EVENT_NAME: 'push', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'a'.repeat(40) });
test('only exact GitHub-hosted R10 context is accepted', () => {
  assert.match(r.guardEnvironment(fixture(), 'linux'), /LOCAL/);
  for (const [key, value] of [['GITHUB_REF','refs/heads/main'],['RUNNER_ENVIRONMENT','self-hosted'],['GITHUB_REPOSITORY','other/repo'],['GITHUB_EVENT_NAME','pull_request']]) {
    assert.throws(() => r.guardEnvironment({ ...fixture(), [key]: value }, 'linux'));
  }
  assert.throws(() => r.guardEnvironment(fixture(), 'win32'));
  assert.throws(() => r.guardEnvironment({ ...fixture(), GITHUB_EVENT_NAME:'workflow_dispatch', R10_EXPECTED_SHA:'b'.repeat(40) },'linux'));
});
for (const ref of ['ozrasuktfthsvbqprtel','zwxulgpjucxudadjdqov']) test('protected ref rejected in any environment value: ' + ref, () => {
  for (const value of [ref, ref.toUpperCase(), [...ref].map(ch => '%' + ch.charCodeAt(0).toString(16)).join('')]) {
    assert.throws(() => r.guardEnvironment({ ...fixture(), ARBITRARY: value }, 'linux'), /PROTECTED_REF/);
  }
});
test('credentials, remote Docker and database environment refused; child environment minimal', () => {
  for (const key of ['DATABASE_URL','SUPABASE_ACCESS_TOKEN','PGHOST','POSTGRES_PASSWORD','DOCKER_HOST','DOCKER_CONTEXT']) {
    assert.throws(() => r.guardEnvironment({ ...fixture(), [key]:'nonempty' }, 'linux'), /REFUSED/);
  }
  assert.deepEqual(r.cleanChildEnvironment({PATH:'bin',SUPABASE_ACCESS_TOKEN:'hidden',DATABASE_URL:'hidden',GITHUB_TOKEN:'hidden'}),{PATH:'bin'});
});
test('SQL networking, process execution, cron mutations and psql escape refused', () => {
  for (const sql of ['select dblink(x,y)','select net.http_post(x)','create server x','copy x to program x','select cron.schedule(x)', '\\connect remote']) assert.throws(() => r.checkSql(sql));
  assert.doesNotThrow(() => r.checkSql('select * from public.platform_admins;'));
});
test('exact 51 production forms only, immutable M1 pins, manifest and decoded privacy', () => {
  const rows = r.replayRows(); assert.equal(rows.length,51);
  assert.equal(rows[0].version,'20260723210120');
  assert.ok(rows.every(row => row.version < '20260929211421'));
  assert.equal(c.inspectText(s.frozen().text).length,0);
});
test('missing frontier fails closed; preparation cannot fabricate one', () => assert.throws(() => r.frontier(), /FRONTIER_NOT_DERIVED/));
test('64-bit catalog numeric values remain exact, strings unchanged', () => {
  assert.notDeepEqual(s.lossless('{"n":9223372036854775807}'),s.lossless('{"n":9223372036854775806}'));
  assert.equal(s.lossless('{"s":"123 \\\" text"}').s,'123 " text');
  assert.throws(() => s.lossless('{"$r10Number":"1"}'),/RESERVED/);
});
test('reviewed allowlist applies exactly four gates and ignores zero catalog fields', () => {
  const expected = s.expectedAfterAllowlist();
  assert.equal(expected.report.applied_function_gates.length,4);
  assert.deepEqual(expected.report.ignored_fields,[]);
  assert.equal(s.differences(expected.expected.payload,structuredClone(expected.expected.payload)).length,0);
  for (const field of ['functions','policies','relations','indexes','constraints','sequences','effective_function_privileges']) {
    const changed = structuredClone(expected.expected.payload); changed[field] = [];
    assert.ok(s.differences(expected.expected.payload,changed).length > 0,field);
  }
});
test('whole signature comparator accepts only reviewed transformed catalog, denies default drift', () => {
  const emit = value => {
    if (value && typeof value === 'object' && Object.keys(value).length === 1 && value.$r10Number) return value.$r10Number;
    if (Array.isArray(value)) return '[' + value.map(emit).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).map(([key,v]) => JSON.stringify(key) + ':' + emit(v)).join(',') + '}';
    return JSON.stringify(value);
  };
  const expected = s.expectedAfterAllowlist().expected.payload;
  assert.equal(s.compare(emit(expected)).matched,true);
  const changed = structuredClone(expected);
  const column = changed.columns.find(x => x.relation === 'marketplace_payment_settings' && x.name === 'is_active');
  assert.equal(column.default_or_generation_expression,'false');
  column.default_or_generation_expression = 'true';
  assert.equal(s.compare(emit(changed)).matched,false);
  assert.equal(s.compare(s.frozen().text).matched,false,'Historical email gate is NOT accepted in fresh runtime');
});
test('workflow is branch-scoped, standalone, readonly and never uses credentials or remote commands', () => {
  const y = c.read('.github/workflows/r10-p4-disposable-replay.yml').toString();
  assert.match(y,/branches: \[reconcile\/r10-production-base-canonicalization\]/);
  assert.match(y,/contents: read/); assert.match(y,/ubuntu-24.04/);
  assert.doesNotMatch(y,/secrets\.|supabase link|db push|migration repair|--include-all|pull_request:/);
  assert.match(y,/7074584113aa00495beeac661c41fb09f1ddd0a483cd7333894b0d080086dc6e/);
  const driver = c.read('scripts/db/p4/runtime.cjs').toString();
  assert.match(driver,/enabled = false/); assert.match(driver,/--network-id/); assert.match(driver,/--internal/);
  assert.match(driver,/PGHOST=\/var\/run\/postgresql/);
});
test('runtime SQL contains rollback, both false defaults and all four actor gates, without real auth provisioning', () => {
  const sql = c.read('scripts/db/p4/security.sql').toString();
  r.checkSql(sql);
  for (const x of ['automatic_payout_enabled','is_active','NULL_ACTOR','super_admin','23502','23514','zero_owner_missing_actor','FOUNDER_INVITE_NOT_OWNED','service_role','search_path=pg_catalog, public']) assert.ok(sql.includes(x),x);
  assert.match(sql,/begin;/); assert.match(sql,/rollback;/);
  assert.doesNotMatch(sql,/insert into auth\.|disable.*trigger|drop.*constraint/i);
});
test('artifact privacy allowlist rejects arbitrary files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'r10-artifact-test-'));
  const dir = path.join(temp,'r10-p4-evidence'); fs.mkdirSync(dir);
  try {
    fs.writeFileSync(path.join(dir,'final-attestation.json'),'{}'); assert.equal(a.inspectDirectory(temp),1);
    fs.writeFileSync(path.join(dir,'unexpected.json'),'{}'); assert.throws(() => a.inspectDirectory(temp),/UNEXPECTED/);
  } finally {
    // Exact synthetic test files only; never recursively traverse user paths.
    fs.unlinkSync(path.join(dir,'unexpected.json')); fs.unlinkSync(path.join(dir,'final-attestation.json'));
    fs.rmdirSync(dir); fs.rmdirSync(temp);
  }
});
