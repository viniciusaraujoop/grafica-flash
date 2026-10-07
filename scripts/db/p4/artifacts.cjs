/* eslint-disable @typescript-eslint/no-require-imports -- Standalone evidence privacy gate. */
const fs = require('node:fs');
const path = require('node:path');
const c = require('../r10-contract.cjs');
const allowed = new Set(['runtime-versions.json', 'frontier-hash.json', 'replay-form-manifest.json',
  'migration-execution-log.json', 'resulting-migration-ledger.json', 'raw-schema-signature.json',
  'normalized-schema-signature.json', 'signature-diff.json', 'allowlist-application-report.json',
  'runtime-security-test-results.json', 'final-attestation.json', 'fresh-state.json', 'local-start-diagnostic.json']);
function validateDiagnostic(value) {
  const exact = (v, keys) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== keys.sort().join(',')) throw Error('DIAGNOSTIC_SCHEMA_INVALID');
  };
  exact(value, ['stage','process_exit_code','process_signal','timed_out','duration_ms','classification','containers','network']);
  const text = JSON.stringify(value);
  if (c.inspectText(text).length || /eyJ[A-Za-z0-9_-]{10,}|sb_(?:secret|publishable)_|postgres(?:ql)?:\/\/|https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:password|access_token|refresh_token|service_role|anon_key)\s*[=:"]|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i.test(text)) throw Error('UNSAFE_DIAGNOSTIC');
  if (value.stage !== 'local-supabase-start' || !require('./runtime.cjs').START_CLASSES.includes(value.classification) ||
      (value.process_exit_code !== null && (!Number.isInteger(value.process_exit_code) || value.process_exit_code < 0 || value.process_exit_code > 255)) ||
      (value.process_signal !== null && !['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGPIPE'].includes(value.process_signal)) ||
      typeof value.timed_out !== 'boolean' || !Number.isInteger(value.duration_ms) || value.duration_ms < 0 || value.duration_ms > 3600000 ||
      !Array.isArray(value.containers) || value.containers.length > 32) throw Error('DIAGNOSTIC_SCHEMA_INVALID');
  const projectOf = name => {
    const match = /_(r10p4-\d+-\d+)$/.exec(name);
    if (!match) throw Error('DIAGNOSTIC_IDENTITY_INVALID');
    return match[1];
  };
  for (const v of value.containers) {
    exact(v, ['name','image','state','health','network_names']);
    exact(v.state, ['status','running','exit_code','oom_killed','dead']); exact(v.health, ['status']);
    if (!Array.isArray(v.network_names)) throw Error('DIAGNOSTIC_SCHEMA_INVALID');
    require('./runtime.cjs').safeContainer({ Name:v.name, Config:{Image:v.image},
      State:{Status:v.state.status,Running:v.state.running,ExitCode:v.state.exit_code,OOMKilled:v.state.oom_killed,Dead:v.state.dead,Health:{Status:v.health.status}},
      NetworkSettings:{Networks:Object.fromEntries(v.network_names.map(n=>[n,{}]))} }, projectOf(v.name));
  }
  if (value.network !== null) {
    exact(value.network, ['name','driver','internal','container_names']);
    const n = value.network, project = /^r10p4-\d+-\d+-internal$/.test(n.name) ? n.name.slice(0,-9) : '';
    if (!Array.isArray(n.container_names) || n.container_names.length > 32 || value.containers.some(v=>projectOf(v.name)!==project)) throw Error('DIAGNOSTIC_SCHEMA_INVALID');
    require('./runtime.cjs').safeNetwork({Name:n.name,Driver:n.driver,Internal:n.internal,Labels:{'r10.disposable':project},
      Containers:Object.fromEntries(n.container_names.map((name,i)=>[i,{Name:name}]))},project);
  } else if (value.containers.length) throw Error('DIAGNOSTIC_SCHEMA_INVALID');
  return value;
}
function inspectDirectory(temp) {
  const root = fs.realpathSync(temp), dir = path.join(root, 'r10-p4-evidence');
  if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw Error('EVIDENCE_DIRECTORY_UNSAFE');
  const files = fs.readdirSync(dir);
  if (!files.includes('final-attestation.json')) throw Error('ATTESTATION_MISSING');
  for (const file of files) {
    const p = path.join(dir, file), stat = fs.lstatSync(p);
    if (!allowed.has(file) || !stat.isFile() || stat.isSymbolicLink()) throw Error('UNEXPECTED_ARTIFACT');
    const text = fs.readFileSync(p, 'utf8'); JSON.parse(text);
    if (file === 'local-start-diagnostic.json') validateDiagnostic(JSON.parse(text));
    if (c.inspectText(text).length || /(?:eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.|sb_secret_|postgres(?:ql)?:\/\/)/i.test(text)) throw Error('UNSAFE_ARTIFACT');
  }
  return files.length;
}
if (require.main === module) {
  try { console.log('P4_SAFE_ARTIFACT_COUNT:' + inspectDirectory(process.env.RUNNER_TEMP)); }
  catch { console.error('P4_ARTIFACT_UPLOAD_REFUSED'); process.exitCode = 1; }
}
module.exports = { inspectDirectory, allowed, validateDiagnostic };
