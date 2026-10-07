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
for (const [text, expected] of [
  ['invalid config','CONFIG_VALIDATION_FAILURE'],['image pull failed','IMAGE_PULL_FAILURE'],
  ['docker permission denied','DOCKER_PERMISSION_FAILURE'],['network not found','DOCKER_NETWORK_FAILURE'],
  ['address already in use','PORT_BIND_FAILURE'],['realtime initialization failed','REALTIME_SETUP_FAILURE'],
  ['database startup failed','DATABASE_CONTAINER_FAILURE'],['database health failed','DATABASE_HEALTH_FAILURE'],
  ['auth setup failed','AUTH_SETUP_FAILURE'],['storage setup failed','STORAGE_SETUP_FAILURE'],
  ['postgrest error','POSTGREST_FAILURE'],['kong error','KONG_FAILURE'],['postgres-meta error','POSTGRES_META_FAILURE'],
  ['service unhealthy','SERVICE_HEALTHCHECK_FAILURE'],['unrecognized opaque text','LOCAL_SUPABASE_START_UNKNOWN'],
]) test('safe startup classification: ' + expected, () => {
  assert.equal(r.classifyStart({stderr:text}),expected);
  assert.equal(r.classifyStart({stdout:text}),expected);
});
const diagnosticFixture = () => r.startDiagnostic({status:1,stderr:'RAW_STDERR_CANARY',stdout:'RAW_STDOUT_CANARY'},123);
const projectFixture = 'r10p4-123-1';
const containerFixture = () => ({Name:'/supabase_db_' + projectFixture,Config:{Image:'public.ecr.aws/supabase/postgres:17.0',Env:['PASSWORD=unsafe']},
  State:{Status:'exited',Running:false,ExitCode:1,OOMKilled:false,Dead:false,Health:{Status:'unhealthy'},Error:'unsafe'},
  NetworkSettings:{Networks:{[projectFixture+'-internal']:{IPAddress:'unsafe'}}},Mounts:['unsafe']});
const networkFixture = () => ({Name:projectFixture+'-internal',Driver:'bridge',Internal:true,Labels:{'r10.disposable':projectFixture},
  Containers:{id:{Name:'supabase_db_'+projectFixture,IPv4Address:'unsafe'}},IPAM:{unsafe:true}});
for (const suffix of ['db','kong','auth','inbucket','realtime','rest','storage','imgproxy','pg_meta','studio','edge_runtime','analytics','vector','pooler'])
  test('canonical suffix accepted by both snapshots: ' + suffix, () => {
    const name='supabase_'+suffix+'_'+projectFixture;
    assert.equal(r.safeContainer({...containerFixture(),Name:name},projectFixture).name,name);
    assert.deepEqual(r.safeNetwork({...networkFixture(),Containers:{id:{Name:name}}},projectFixture).container_names,[name]);
  });
for (const suffix of ['meta','mailpit','unknown','helper','database_helper','arbitrary','foo','*','','db|helper','db.*','pg_meta_extra'])
  test('noncanonical suffix rejected by both snapshots: ' + suffix, () => {
    const name='supabase_'+suffix+'_'+projectFixture;
    assert.throws(()=>r.safeContainer({...containerFixture(),Name:name},projectFixture));
    assert.throws(()=>r.safeNetwork({...networkFixture(),Containers:{id:{Name:name}}},projectFixture));
  });
test('canonical service wrong project and additional network remain rejected', () => {
  for(const suffix of ['db','pg_meta','inbucket']) {
    const name='supabase_'+suffix+'_r10p4-124-1';
    assert.throws(()=>r.safeContainer({...containerFixture(),Name:name},projectFixture));
    assert.throws(()=>r.safeNetwork({...networkFixture(),Containers:{id:{Name:name}}},projectFixture));
  }
  assert.throws(()=>r.safeContainer({...containerFixture(),NetworkSettings:{Networks:{[projectFixture+'-internal']:{},other:{}}}},projectFixture));
});
test('raw stdout/stderr and arbitrary process fields never leave structured diagnostic', () => {
  const d = diagnosticFixture(); a.validateDiagnostic(d);
  assert.doesNotMatch(JSON.stringify(d),/CANARY|stderr|stdout/);
  assert.equal(r.startDiagnostic({status:null,signal:'SIGTERM',error:{code:'ETIMEDOUT',message:'unsafe'}},55).timed_out,true);
});
test('startup throw and diagnostic inspection remain fixed/bounded, never output-derived', () => {
  const driver=fs.readFileSync(path.join(__dirname,'runtime.cjs'),'utf8');
  assert.match(driver,/throw Error\('LOCAL_PROCESS_FAILED:' \+ stage\)/);
  assert.doesNotMatch(driver,/console\.(?:log|error)\(result|save\([^;]*result\.(?:stdout|stderr)/);
});
test('container snapshot excludes unsafe fields and rejects unrelated identity/networks', () => {
  const safe=r.safeContainer(containerFixture(),projectFixture);
  assert.doesNotMatch(JSON.stringify(safe),/unsafe|Env|Mounts|IPAddress/);
  for(const name of ['supabase_db_other','evil_'+projectFixture]) assert.throws(()=>r.safeContainer({...containerFixture(),Name:name},projectFixture));
  assert.throws(()=>r.safeContainer({...containerFixture(),NetworkSettings:{Networks:{other:{}}}},projectFixture));
});
test('network snapshot excludes IPAM/labels and requires exact internal ownership', () => {
  assert.doesNotMatch(JSON.stringify(r.safeNetwork(networkFixture(),projectFixture)),/unsafe|IPAM|Labels/);
  for(const patch of [{Name:'other'},{Internal:false},{Labels:{}},{Containers:{x:{Name:'evil_'+projectFixture}}}])
    assert.throws(()=>r.safeNetwork({...networkFixture(),...patch},projectFixture));
});
test('diagnostic schema rejects arbitrary fields at every depth', () => {
  assert.throws(()=>a.validateDiagnostic({...diagnosticFixture(),stderr:'unsafe'}));
  const d=diagnosticFixture();d.network=r.safeNetwork(networkFixture(),projectFixture);d.containers=[r.safeContainer(containerFixture(),projectFixture)];
  a.validateDiagnostic(d);d.containers[0].state.error='unsafe';assert.throws(()=>a.validateDiagnostic(d));
});
for (const unsafe of ['ozrasuktfthsvbqprtel','zwxulgpjucxudadjdqov','postgres://user:password@host/db',
  'eyJ'+'a'.repeat(30)+'.token.signature','sb_secret_fake','access_token=unsafe','refresh_token=unsafe',
  'password=unsafe','person@example.test','00000000-0000-4000-8000-000000000001'])
  test('unsafe diagnostic evidence rejected: fixture ' + unsafe.slice(0,3),()=>assert.throws(()=>a.validateDiagnostic({...diagnosticFixture(),classification:unsafe})));
test('artifact allowlist adds diagnostic JSON only; unknown extensions remain denied', () => {
  assert(a.allowed.has('local-start-diagnostic.json'));
  for(const name of ['local-start-diagnostic.log','local-start-diagnostic.txt','.env','config.toml','docker.json']) assert(!a.allowed.has(name));
});
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
test('candidate frontier hash/metadata can be inspected without executing runtime', () => {
  const candidate = r.frontier();
  assert.equal(candidate.sha256, c.json('supabase/frontier/FRONTIER.json').sha256);
  assert.equal(c.json('supabase/frontier/FRONTIER.json').derivation_status, 'CANDIDATE_NOT_RUNTIME_CERTIFIED');
});
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
  const y = c.read('.github/workflows/r10-p4-disposable-replay.yml').toString().replace(/\r\n/g,'\n');
  const trigger = y.split('\non:\n')[1].split('\npermissions:')[0];
  assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):/gm)].map(match => match[1]),['workflow_dispatch']);
  assert.match(y,/github\.ref == 'refs\/heads\/reconcile\/r10-production-base-canonicalization'/);
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
