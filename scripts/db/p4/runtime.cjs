/* eslint-disable @typescript-eslint/no-require-imports -- Disposable GitHub-hosted runner orchestration only. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const c = require('../r10-contract.cjs');
const sig = require('./signature.cjs');
const PROTECTED = ['ozrasuktfthsvbqprtel', 'zwxulgpjucxudadjdqov'];
const BRANCH = 'refs/heads/reconcile/r10-production-base-canonicalization';
const SOCKET = 'unix:///var/run/docker.sock';
const LOCAL_SERVICE_SUFFIXES = Object.freeze(['db','kong','auth','inbucket','realtime','rest','storage',
  'imgproxy','pg_meta','studio','edge_runtime','analytics','vector','pooler']);
function canonicalContainerName(name, project) {
  // Fixed in-code tokens only; no Docker/config/environment-derived service authority.
  return typeof name === 'string' && LOCAL_SERVICE_SUFFIXES.some(suffix => name === 'supabase_' + suffix + '_' + project);
}
const START_CLASSES = ['CONFIG_VALIDATION_FAILURE','IMAGE_PULL_FAILURE','DOCKER_PERMISSION_FAILURE',
  'DOCKER_NETWORK_FAILURE','PORT_BIND_FAILURE','DATABASE_CONTAINER_FAILURE','DATABASE_HEALTH_FAILURE',
  'AUTH_SETUP_FAILURE','STORAGE_SETUP_FAILURE','REALTIME_SETUP_FAILURE','POSTGREST_FAILURE','KONG_FAILURE',
  'POSTGRES_META_FAILURE','SERVICE_HEALTHCHECK_FAILURE','LOCAL_SUPABASE_START_UNKNOWN'];
const CLI_ERROR_CODES = Object.freeze({
  ContainerCreateError: 'CONTAINER_CREATE_ERROR', ContainerStartError: 'CONTAINER_START_ERROR',
  HealthCheckTimeoutError: 'HEALTH_CHECK_TIMEOUT_ERROR', ImagePrepullError: 'IMAGE_PREPULL_ERROR',
  NetworkCreateError: 'NETWORK_CREATE_ERROR', VolumeInspectError: 'VOLUME_INSPECT_ERROR',
  VolumeCreateError: 'VOLUME_CREATE_ERROR', StartBackupVolumeExistsError: 'BACKUP_VOLUME_EXISTS_ERROR',
  DbConfigLoadError: 'DB_CONFIG_LOAD_ERROR', DbSetupError: 'DB_SETUP_ERROR',
  MigrationVaultError: 'MIGRATION_VAULT_ERROR', MigrationApplyError: 'MIGRATION_APPLY_ERROR',
  MigrationSeedError: 'MIGRATION_SEED_ERROR',
  DbConnectError: 'DB_CONNECT_ERROR', StartWorkdirError: 'START_WORKDIR_ERROR',
  StartConfigLoadError: 'START_CONFIG_LOAD_ERROR', StartInvalidConfigError: 'START_INVALID_CONFIG_ERROR',
  DockerLifecycleInspectError: 'DOCKER_LIFECYCLE_INSPECT_ERROR', DockerLifecycleListError: 'DOCKER_LIFECYCLE_LIST_ERROR',
  StatusDbInspectError: 'STATUS_DB_INSPECT_ERROR', StatusDbNotRunningError: 'STATUS_DB_NOT_RUNNING_ERROR',
  StatusDbNotReadyError: 'STATUS_DB_NOT_READY_ERROR', StatusListError: 'STATUS_LIST_ERROR',
  StatusInvalidConfigError: 'STATUS_INVALID_CONFIG_ERROR',
});
const CLI_ERROR_ENUM = Object.freeze([...Object.values(CLI_ERROR_CODES), 'LOCAL_START_CLI_ERROR_UNKNOWN']);
const CLI_ERROR_PARSE_STATUS_ENUM = Object.freeze(['MACHINE_ERROR_RECOGNIZED','MACHINE_ERROR_UNRECOGNIZED_CODE',
  'MACHINE_ERROR_INVALID_ENVELOPE','MACHINE_ERROR_INVALID_JSON','MACHINE_ERROR_STDOUT_EMPTY','MACHINE_ERROR_STDOUT_OVERSIZE']);
function parseCliError(stdout) {
  // Untrusted envelope/prose stays memory-only. Never return source values or parser errors.
  const unknown = 'LOCAL_START_CLI_ERROR_UNKNOWN';
  const fail = status => ({cli_error_code: unknown, cli_error_parse_status: status});
  if (typeof stdout !== 'string' || !stdout.trim()) return fail('MACHINE_ERROR_STDOUT_EMPTY');
  if (Buffer.byteLength(stdout, 'utf8') > 65536) return fail('MACHINE_ERROR_STDOUT_OVERSIZE');
  try {
    const envelope = JSON.parse(stdout);
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || envelope._tag !== 'Error' ||
        !envelope.error || typeof envelope.error !== 'object' || Array.isArray(envelope.error) ||
        typeof envelope.error.code !== 'string') return fail('MACHINE_ERROR_INVALID_ENVELOPE');
    if (!Object.hasOwn(CLI_ERROR_CODES, envelope.error.code)) return fail('MACHINE_ERROR_UNRECOGNIZED_CODE');
    return {cli_error_code: CLI_ERROR_CODES[envelope.error.code], cli_error_parse_status: 'MACHINE_ERROR_RECOGNIZED'};
  } catch { return fail('MACHINE_ERROR_INVALID_JSON'); }
}
function cliErrorCode(stdout) { return parseCliError(stdout).cli_error_code; }
function classifyStart(result) {
  const text = String(result.stderr || '').slice(0, 65536) + String(result.stdout || '').slice(0, 65536);
  const rules = [
    [/config.*(?:invalid|failed|error)|failed to parse|invalid.*config/i, START_CLASSES[0]],
    [/pull.*(?:failed|denied|error)|manifest unknown|failed to.*image/i, START_CLASSES[1]],
    [/permission denied.*docker|docker.*permission denied/i, START_CLASSES[2]],
    [/network.*(?:failed|error|not found)|failed to.*network/i, START_CLASSES[3]],
    [/address already in use|port is already allocated|failed to bind/i, START_CLASSES[4]],
    [/realtime.*(?:failed|error|unhealthy)/i, START_CLASSES[9]],
    [/postgrest.*(?:failed|error|unhealthy)/i, START_CLASSES[10]],
    [/postgres.meta.*(?:failed|error|unhealthy)/i, START_CLASSES[12]],
    [/database.*(?:unhealthy|health.*fail)|postgres.*(?:unhealthy|health.*fail)/i, START_CLASSES[6]],
    [/database.*(?:failed|error)|postgres.*(?:failed|error)/i, START_CLASSES[5]],
    [/auth.*(?:failed|error|unhealthy)/i, START_CLASSES[7]],
    [/storage.*(?:failed|error|unhealthy)/i, START_CLASSES[8]],
    [/postgrest.*(?:failed|error|unhealthy)/i, START_CLASSES[10]],
    [/kong.*(?:failed|error|unhealthy)/i, START_CLASSES[11]],
    [/postgres.meta.*(?:failed|error|unhealthy)/i, START_CLASSES[12]],
    [/health.?check.*(?:failed|error)|service.*unhealthy/i, START_CLASSES[13]],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || START_CLASSES[14];
}
function safeContainer(raw, project) {
  if (!/^r10p4-\d+-\d+$/.test(project)) throw Error('DIAGNOSTIC_PROJECT_INVALID');
  const name = String(raw.Name || '').replace(/^\//, '');
  if (!canonicalContainerName(name, project)) throw Error('UNRELATED_CONTAINER_REFUSED');
  const networks = Object.keys(raw.NetworkSettings?.Networks || {});
  if (networks.some(n => n !== project + '-internal')) throw Error('UNRELATED_NETWORK_REFUSED');
  const state = raw.State || {}, health = state.Health?.Status;
  const image = raw.Config?.Image;
  if (typeof image !== 'string' || !/^public\.ecr\.aws\/supabase\/[a-z0-9._/-]+:[a-zA-Z0-9._-]+$/.test(image)) throw Error('DIAGNOSTIC_IMAGE_INVALID');
  if (!['created','running','paused','restarting','removing','exited','dead'].includes(state.Status) ||
      !['Running','OOMKilled','Dead'].every(k => typeof state[k] === 'boolean') || !Number.isInteger(state.ExitCode) ||
      (health !== undefined && !['none','starting','healthy','unhealthy'].includes(health))) throw Error('DIAGNOSTIC_STATE_INVALID');
  return { name, image, state: { status: state.Status, running: state.Running, exit_code: state.ExitCode,
    oom_killed: state.OOMKilled, dead: state.Dead }, health: { status: health || 'none' }, network_names: networks };
}
function safeNetwork(raw, project) {
  if (!/^r10p4-\d+-\d+$/.test(project) || raw.Name !== project + '-internal' ||
      raw.Internal !== true || raw.Labels?.['r10.disposable'] !== project || raw.Driver !== 'bridge') throw Error('UNRELATED_NETWORK_REFUSED');
  const names = Object.values(raw.Containers || {}).map(v => v.Name);
  if (names.length > 32 || names.some(n => !canonicalContainerName(n, project))) throw Error('UNRELATED_CONTAINER_REFUSED');
  return { name: raw.Name, driver: raw.Driver, internal: true, container_names: names.sort() };
}
function startDiagnostic(result, duration) {
  return { stage: 'local-supabase-start', process_exit_code: Number.isInteger(result.status) ? result.status : null,
    process_signal: ['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGPIPE'].includes(result.signal) ? result.signal : null,
    timed_out: result.error?.code === 'ETIMEDOUT', duration_ms: Math.max(0, Math.min(3600000, Math.floor(duration))),
    classification: classifyStart(result), ...parseCliError(result.stdout), containers: [], network: null };
}
function guardEnvironment(env, platform = process.platform) {
  for (const [key, value] of Object.entries(env)) {
    let decoded = String(value);
    for (let i = 0; i < 3; i++) {
      if (PROTECTED.some(ref => decoded.toLowerCase().includes(ref))) throw Error('PROTECTED_REF_IN_ENVIRONMENT');
      try { decoded = decodeURIComponent(decoded); } catch { break; }
    }
    if (value && /^(?:PG[A-Z_]*|DATABASE_URL|DB_URL|DB_HOST|POSTGRES[A-Z_]*|SUPABASE[A-Z_]*|DOCKER_HOST|DOCKER_CONTEXT)$/i.test(key)) throw Error('DATABASE_OR_REMOTE_TOOL_ENVIRONMENT_REFUSED');
  }
  if (platform !== 'linux' || env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
      env.GITHUB_REPOSITORY !== 'viniciusaraujoop/grafica-flash' || env.GITHUB_REF !== BRANCH ||
      !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) || !/^\d+$/.test(env.GITHUB_RUN_ID || '') || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT || '')) throw Error('GITHUB_HOSTED_R10_ONLY');
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.R10_EXPECTED_SHA !== env.GITHUB_SHA) throw Error('DISPATCH_SHA_MISMATCH');
  if (!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || '')) throw Error('GITHUB_SHA_INVALID');
  return 'LOCAL_GITHUB_HOSTED_DISPOSABLE_ONLY';
}
function checkSql(text) {
  if (/^\s*\\/m.test(text) || /\b(?:dblink|postgres_fdw|http_post|http_get|http_request)\b|\bnet\.(?:http|https)|\bcreate\s+(?:foreign\s+data\s+wrapper|server)|\bcopy\b[^;]*\bprogram\b|cron\.(?:schedule|unschedule)\s*\(/i.test(text)) throw Error('REMOTE_SQL_OR_PROCESS_PRIMITIVE_REFUSED');
  if (PROTECTED.some(ref => text.toLowerCase().includes(ref))) throw Error('PROTECTED_REF_IN_SQL');
}
function frontier() {
  const sqlPath = path.join(c.ROOT, 'supabase/frontier/production_base_frontier.sql');
  const metaPath = path.join(c.ROOT, 'supabase/frontier/FRONTIER.json');
  if (!fs.existsSync(sqlPath) || !fs.existsSync(metaPath)) throw Error('FRONTIER_NOT_DERIVED');
  if (fs.lstatSync(path.dirname(sqlPath)).isSymbolicLink() || fs.lstatSync(sqlPath).isSymbolicLink() || fs.lstatSync(metaPath).isSymbolicLink()) throw Error('FRONTIER_SYMLINK_REFUSED');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')), bytes = fs.readFileSync(sqlPath), pins = c.json('supabase/provenance/IMMUTABLE_HASHES.json');
  if (meta.kind !== 'ENGINEERED_PRE_LEDGER_FRONTIER' || meta.not_ledgered !== true || meta.first_production_version !== '20260723210120' ||
      meta.requires_business_data !== false || meta.requires_real_auth_users !== false || meta.requires_production_secrets !== false ||
      meta.sha256 !== c.sha(bytes) || pins.frontier_sha256 !== meta.sha256) throw Error('FRONTIER_CONTRACT_OR_PIN_INVALID');
  checkSql(bytes.toString('utf8'));
  return { sql: bytes.toString('utf8'), sha256: meta.sha256 };
}
function replayRows() {
  c.manifest(); c.immutable(); c.secretScan();
  const rows = c.plan().index.rows;
  if (rows.length !== 51 || rows.some((r, i) => !/^\d{14}$/.test(r.version) || !/^[a-z0-9_]+$/.test(r.name) || r.ordered_position !== i + 1 || !r.staged_replay_file || (i && r.version <= rows[i - 1].version) || r.version >= '20260929211421')) throw Error('REPLAY_IDENTITY_OR_ORDER_INVALID');
  return rows.map(r => {
    const bytes = c.read(r.staged_replay_file); checkSql(bytes.toString('utf8'));
    return { ...r, sql: bytes.toString('utf8'), sha256: c.sha(bytes) };
  });
}
function cleanChildEnvironment(env) {
  return Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'RUNNER_TEMP', 'LANG'].filter(k => env[k]).map(k => [k, env[k]]));
}
function run() {
  const env = process.env;
  guardEnvironment(env);
  const head = cp.execFileSync('git', ['-C', c.ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== env.GITHUB_SHA) throw Error('CHECKOUT_SHA_MISMATCH');
  const temp = fs.realpathSync(env.RUNNER_TEMP);
  if (!fs.statSync(temp).isDirectory() || temp === c.ROOT || temp.startsWith(c.ROOT + path.sep)) throw Error('RUNNER_TEMP_UNSAFE');
  const workspace = fs.realpathSync(env.GITHUB_WORKSPACE);
  if (workspace !== c.ROOT) throw Error('WORKSPACE_MISMATCH');
  const evidence = path.join(temp, 'r10-p4-evidence');
  if (fs.existsSync(evidence)) throw Error('EVIDENCE_DIRECTORY_NOT_FRESH');
  fs.mkdirSync(evidence, { mode: 0o700 });
  const save = (file, data) => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n';
    if (c.inspectText(text).length) throw Error('UNSAFE_EVIDENCE_REFUSED');
    fs.writeFileSync(path.join(evidence, file), text, { mode: 0o600 });
  };
  const childEnv = cleanChildEnvironment(env);
  const command = (name, args, input, stage) => {
    const started = performance.now();
    const result = cp.spawnSync(name, args, { env: childEnv, input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    if (stage === 'local-supabase-start' && (result.status !== 0 || result.error)) {
      const diagnostic = startDiagnostic(result, performance.now() - started);
      try {
        const snapshot = JSON.parse(docker(['network', 'inspect', network], null, 'diagnostic-network'))[0];
        diagnostic.network = safeNetwork(snapshot, project);
        for (const name of diagnostic.network.container_names) {
          try { diagnostic.containers.push(safeContainer(JSON.parse(docker(['inspect', name], null, 'diagnostic-container'))[0], project)); } catch { /* unavailable or unsafe: omit */ }
        }
      } catch { /* preserve original startup failure */ }
      try { require('./artifacts.cjs').validateDiagnostic(diagnostic); save('local-start-diagnostic.json', diagnostic); } catch { /* never mask startup failure */ }
    }
    if (result.status !== 0 || result.error) throw Error('LOCAL_PROCESS_FAILED:' + stage); // Never print raw CLI/SQL stderr or startup keys.
    return result.stdout;
  };
  const docker = (args, input, stage) => command('docker', ['--host', SOCKET, ...args], input, stage);
  const project = 'r10p4-' + env.GITHUB_RUN_ID + '-' + env.GITHUB_RUN_ATTEMPT;
  const network = project + '-internal', container = 'supabase_db_' + project;
  const scratch = fs.mkdtempSync(path.join(temp, 'r10-p4-'));
  let networkOwned = false, startupAttempted = false, verifiedContainerId = null;
  const execution = [], attestation = { kind: 'P4_DISPOSABLE_LOCAL_ONLY_NOT_P7', commit: head, status: 'BLOCKED', executed_migrations: 0, production_connection: false, staging_connection: false, remote_sql: false };
  const assertContainer = () => {
    const n = JSON.parse(docker(['network', 'inspect', network], null, 'network-inspect'))[0];
    const db = JSON.parse(docker(['inspect', container], null, 'container-inspect'))[0];
    if (!n.Internal || n.Labels?.['r10.disposable'] !== project || Object.keys(db.NetworkSettings.Networks).length !== 1 ||
        !db.NetworkSettings.Networks[network] || !db.State.Running || !db.Id || (verifiedContainerId && verifiedContainerId !== db.Id)) throw Error('DISPOSABLE_CONTAINER_IDENTITY_OR_ISOLATION_FAILED');
    verifiedContainerId = db.Id;
  };
  const sql = (text, stage) => {
    checkSql(text); assertContainer();
    return docker(['exec', '-i', verifiedContainerId, 'env', '-i', 'PATH=/usr/local/bin:/usr/bin:/bin', 'PGHOST=/var/run/postgresql',
      'PGDATABASE=postgres', 'PGUSER=postgres', 'PGPORT=5432',
      'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', '-'], text, stage).trim();
  };
  const ledger = () => JSON.parse(sql("SELECT coalesce(json_agg(json_build_object('version',version,'name',name) ORDER BY version),'[]'::json) FROM supabase_migrations.schema_migrations;", 'ledger'));
  try {
    const rows = replayRows(); sig.frozen(); sig.expectedAfterAllowlist();
    save('replay-form-manifest.json', rows.map(r => ({ index: r.ordered_position, version: r.version, name: r.name, file: r.staged_replay_file, sha256: r.sha256 })));
    const cli = command('supabase', ['--version'], null, 'cli-version').trim();
    if (cli !== '2.120.0') throw Error('CLI_VERSION_NOT_PINNED');
    command('supabase', ['start', '--help'], null, 'start-help');
    command('supabase', ['stop', '--help'], null, 'stop-help');
    save('runtime-versions.json', { node: process.version, supabase_cli: cli, docker: docker(['version', '--format', '{{.Server.Version}}'], null, 'docker-version').trim(), postgres: 'NOT_STARTED_YET' });
    // Isolated config only: no repo migrations, seeds, linked project, credentials or .env.
    fs.mkdirSync(path.join(scratch, 'supabase/migrations'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'supabase/config.toml'),
      'project_id = "' + project + '"\n[db]\nmajor_version = 17\nport = 54322\n[db.migrations]\nenabled = false\nschema_paths = []\n[db.seed]\nenabled = false\nsql_paths = []\n[studio]\nenabled = false\n[analytics]\nenabled = false\n[edge_runtime]\nenabled = false\n');
    docker(['network', 'create', '--internal', '--label', 'r10.disposable=' + project, network], null, 'create-internal-network'); networkOwned = true;
    startupAttempted = true;
    command('supabase', ['--output-format', 'json', '--workdir', scratch, '--network-id', network, 'start', '--exclude', 'studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor'], null, 'local-supabase-start');
    assertContainer();
    save('runtime-versions.json', { node: process.version, supabase_cli: cli, docker: docker(['version', '--format', '{{.Server.Version}}'], null, 'docker-version').trim(), postgres: sql('SELECT version();', 'postgres-version') });
    const fresh = JSON.parse(sql("SELECT json_build_object('server_address',inet_server_addr(),'database',current_database(),'user',current_user,'ledger_exists',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,'application_relations',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','api','orcaly_private') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')),'application_functions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','api','orcaly_private') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')),'application_types',(SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','api','orcaly_private') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')));", 'fresh-state'));
    if (fresh.server_address !== null || fresh.database !== 'postgres' || fresh.user !== 'postgres' ||
        fresh.application_relations !== 0 || fresh.application_functions !== 0 || fresh.application_types !== 0 ||
        (fresh.ledger_exists && ledger().length)) throw Error('NONEMPTY_OR_NONLOCAL_DATABASE_REFUSED');
    save('fresh-state.json', fresh);
    const f = frontier(); save('frontier-hash.json', { sha256: f.sha256 });
    sql(f.sql, 'frontier');
    if (fresh.ledger_exists && ledger().length) throw Error('FRONTIER_MUST_NOT_BE_LEDGERED');
    sql("CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);", 'local-replay-ledger-initialization');
    if (ledger().length) throw Error('FRONTIER_LEDGER_NOT_EMPTY');
    for (const row of rows) {
      // Historical forms sometimes include BEGIN/COMMIT. Do not strip or rewrite their SQL.
      sql(row.sql, 'replay-' + row.version);
      sql("INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('" + row.version + "','" + row.name + "');", 'record-local-executed-identity');
      execution.push({ index: row.ordered_position, version: row.version, name: row.name, sha256: row.sha256, status: 'EXECUTED_LOCAL_ONLY' });
      attestation.executed_migrations = execution.length; save('migration-execution-log.json', execution);
      const actual = ledger();
      if (JSON.stringify(actual) !== JSON.stringify(rows.slice(0, execution.length).map(r => ({ version: r.version, name: r.name })))) throw Error('LOCAL_LEDGER_ORDER_DIFFERENT');
    }
    save('resulting-migration-ledger.json', ledger()); // Exactly 51; never M1A/M1B.
    const query = c.read('supabase/provenance/catalog/SIGNATURE_QUERY.sql').toString('utf8').trim().replace(/;$/, '');
    const captured = JSON.parse(sql("SELECT json_build_object('signature_sha256',signature_sha256,'signature_digest_representation',signature_digest_representation) FROM (" + query + ") AS frozen_method;", 'signature'));
    if (c.sha(captured.signature_digest_representation) !== captured.signature_sha256) throw Error('RUNTIME_RAW_SIGNATURE_HASH_INVALID');
    save('raw-schema-signature.json', captured);
    const compared = sig.compare(captured.signature_digest_representation);
    save('normalized-schema-signature.json', compared.actual_normalized);
    save('signature-diff.json', compared.diff); save('allowlist-application-report.json', compared.allowlist);
    if (!compared.matched) { attestation.agent2_architecture_escalation_required = true; throw Error('AGENT_2_ARCHITECTURE_ESCALATION_REQUIRED:UNLISTED_SIGNATURE_DIFFERENCES'); }
    const securityText = c.read('scripts/db/p4/security.sql').toString('utf8');
    const securityResult = sql(securityText, 'runtime-security');
    if (!securityResult.includes('"status" : "PASS"') && !securityResult.includes('"status":"PASS"')) throw Error('RUNTIME_SECURITY_ATTESTATION_MISSING');
    save('runtime-security-test-results.json', JSON.parse(securityResult));
    attestation.status = 'PASS_LOCAL_P4_ONLY'; attestation.frozen_signature_allowlisted_match = true;
  } catch (error) {
    // Error messages originate from bounded stages, never subprocess stderr.
    const safeReason = /^[A-Za-z0-9_:-]{1,160}$/.test(error.message) ? error.message : 'LOCAL_INTERNAL_FAILURE_REDACTED';
    attestation.reason = safeReason;
    throw Error(safeReason);
  } finally {
    if (startupAttempted) {
      try { command('supabase', ['--workdir', scratch, 'stop', '--project-id', project, '--no-backup'], null, 'cleanup-local-project'); }
      catch { attestation.cleanup_failed = true; attestation.status = 'BLOCKED'; }
    }
    if (networkOwned) {
      try { docker(['network', 'rm', network], null, 'cleanup-owned-network'); }
      catch { attestation.cleanup_failed = true; attestation.status = 'BLOCKED'; }
    }
    save('migration-execution-log.json', execution); save('final-attestation.json', attestation);
  }
  if (attestation.status !== 'PASS_LOCAL_P4_ONLY') throw Error('DISPOSABLE_CLEANUP_OR_ATTESTATION_FAILED');
}
module.exports = { guardEnvironment, checkSql, frontier, replayRows, cleanChildEnvironment,
  START_CLASSES, CLI_ERROR_ENUM, CLI_ERROR_PARSE_STATUS_ENUM, parseCliError, cliErrorCode, classifyStart, safeContainer, safeNetwork, startDiagnostic };
if (require.main === module) {
  try { if (process.argv[2] === '--preflight') { guardEnvironment(process.env); replayRows(); console.log('LOCAL_DISPOSABLE_PREFLIGHT_PASS'); } else run(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
