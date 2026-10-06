/* eslint-disable @typescript-eslint/no-require-imports -- Standalone core-only Node CommonJS CLI, no application bundling. */
// Repository-only checkpoint validation. No database/network access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '../..');
const BASE = '9611d195290247694ad60d5aa2638ac8b96ecefb';
const LEDGER = '48d34e8fec27c3afc640b166306d5b2fb5f0e876daff22939a817638c93c699a';
const SIGNATURE = 'affd3c4f7a5155fcbedb9bcf9999477c2e3275a492710fd2859b98ba88f82be9';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function localFile(name) {
  const result = path.resolve(ROOT, name);
  if (!result.startsWith(ROOT + path.sep)) throw Error('PATH_OUTSIDE_REPOSITORY');
  const parts = path.relative(ROOT, result).split(path.sep);
  let current = ROOT;
  for (const part of parts) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw Error('LINKED_EVIDENCE_REFUSED');
    }
  }
  return result;
}
const read = name => fs.readFileSync(localFile(name));
const json = name => JSON.parse(read(name).toString('utf8'));
const git = args => cp.execFileSync('git', ['-c', 'safe.directory=' + ROOT, '-C', ROOT, ...args], { maxBuffer: 40 * 1024 * 1024 });
function manifest() {
  const m = json('supabase/provenance/MANIFEST.json');
  if (m.base_main !== BASE || !m.self_excluded) throw Error('MANIFEST_BASE_OR_FORMAT');
  const ordered = [...m.entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (JSON.stringify(ordered) !== JSON.stringify(m.entries)) throw Error('MANIFEST_ORDER');
  if (sha(JSON.stringify(m.entries)) !== m.tree_digest) throw Error('MANIFEST_TREE_DIGEST');
  const names = new Set();
  for (const entry of m.entries) {
    if (names.has(entry.path)) throw Error('MANIFEST_DUPLICATE');
    names.add(entry.path);
    if (!entry.path.startsWith('supabase/provenance/') && !entry.path.startsWith('supabase/replay-forms/')) {
      throw Error('MANIFEST_SCOPE');
    }
    const bytes = read(entry.path);
    if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) {
      throw Error('MANIFEST_FILE_HASH: ' + entry.path);
    }
  }
  const discover = directory => fs.readdirSync(localFile(directory), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? discover(directory + '/' + e.name) : [directory + '/' + e.name]);
  const actual = [...discover('supabase/provenance'), ...discover('supabase/replay-forms')]
    .filter(p => p !== 'supabase/provenance/MANIFEST.json').sort();
  if (JSON.stringify(actual) !== JSON.stringify([...names].sort())) throw Error('MANIFEST_UNLISTED_FILE');
  return m;
}
function catalog() {
  const packed = json('supabase/provenance/catalog/PRODUCTION_BASE_SIGNATURE.redacted.json');
  const meta = json('supabase/provenance/catalog/META.json');
  if (packed.encoding !== 'base64+gzip' || !packed.redacted || !Array.isArray(packed.data)) {
    throw Error('CATALOG_ENCODING');
  }
  const decoded = zlib.gunzipSync(Buffer.from(packed.data.join(''), 'base64'), { maxOutputLength: 25 * 1024 * 1024 });
  if (sha(decoded) !== packed.decoded_sha256 || sha(decoded) !== meta.redacted_payload_sha256) {
    throw Error('CATALOG_DECODED_HASH');
  }
  if (meta.frozen_signature_sha256 !== SIGNATURE) throw Error('FROZEN_SIGNATURE_DRIFT');
  return { text: decoded.toString('utf8'), payload: JSON.parse(decoded), meta };
}
function immutable() {
  const pins = json('supabase/provenance/IMMUTABLE_HASHES.json');
  if (pins.base_main !== BASE || pins.m1.length !== 4) throw Error('IMMUTABLE_SET');
  for (const pin of pins.m1) {
    const original = git(['show', BASE + ':' + pin.path]);
    const current = git(['show', 'HEAD:' + pin.path]);
    if (sha(original) !== pin.sha256 || sha(current) !== pin.sha256) throw Error('IMMUTABLE_GIT_BYTES: ' + pin.path);
    // Git raw bytes are the immutable authority. Windows checkout CRLF is not a schema edit.
    if (sha(read(pin.path).toString('utf8').replace(/\r\n/g, '\n')) !== pin.sha256) {
      throw Error('IMMUTABLE_WORKING_CONTENT: ' + pin.path);
    }
  }
  return pins;
}
function plan() {
  const p = json('supabase/provenance/ACTIVE_DIRECTORY_PLAN.json');
  const index = json('supabase/provenance/ledger/production/INDEX.json');
  if (p.base_main !== BASE || index.ledger_count !== 51 || index.ordered_ledger_sha256 !== LEDGER) throw Error('FROZEN_LEDGER_DRIFT');
  const original = git(['ls-tree', '-r', '--name-only', BASE, 'supabase/migrations']).toString('utf8').trim().split('\n').filter(p => p.endsWith('.sql'));
  const sources = p.actions.map(a => a.source_file).sort();
  if (JSON.stringify(sources) !== JSON.stringify(original.sort()) || p.before_count !== 71) throw Error('PLAN_SOURCE_COVERAGE');
  const allowed = new Set(['KEEP', 'REHOME_TO_PROD_VERSION', 'REPLACE_WITH_LEDGER_FORM', 'ARCHIVE', 'CREATE_FROM_LEDGER', 'PIN_IMMUTABLE']);
  if ([...p.actions, ...p.additional_actions].some(a => !allowed.has(a.action))) throw Error('PLAN_ACTION');
  const targets = index.rows.map(r => r.target_file);
  if (targets.length !== 51 || new Set(targets).size !== 51 || p.pending_migration_set.length !== 4 || p.expected_after_count !== 55) throw Error('PLAN_TARGET_SET');
  for (const [i, r] of index.rows.entries()) {
    if (r.ordered_position !== i + 1 || !/^\d{14}$/.test(r.version) ||
      r.target_file !== 'supabase/migrations/' + r.version + '_' + r.name + '.sql') throw Error('LEDGER_IDENTITY');
    const meta = json(r.meta);
    if (meta.production_version !== r.version || meta.production_name !== r.name ||
      meta.ordered_ledger_index !== i + 1 || meta.ordered_ledger_digest !== LEDGER) throw Error('LEDGER_MAPPING');
    if (r.staged_replay_file && sha(read(r.staged_replay_file)) !== meta.replay_form_sha256) throw Error('REPLAY_MAPPING');
    if (!r.staged_replay_file && r.status !== 'MIGRATION_OWNER_DECISION_REQUIRED') throw Error('MISSING_REPLAY_UNDECLARED');
  }
  return { plan: p, index };
}
function activeDirectory() {
  const { plan: p, index } = plan();
  immutable();
  const expected = [...index.rows.map(r => r.target_file), ...p.pending_migration_set.map(r => r.file)].sort();
  const entries = fs.readdirSync(localFile('supabase/migrations'), { withFileTypes: true });
  if (entries.some(e => !e.isFile() || !e.name.endsWith('.sql'))) throw Error('ACTIVE_DISCOVERY_UNEXPECTED_ENTRY');
  const actual = entries.map(e => 'supabase/migrations/' + e.name).sort();
  const missing = expected.filter(p => !actual.includes(p));
  const unexpected = actual.filter(p => !expected.includes(p));
  if (actual.length !== 55 || missing.length || unexpected.length) {
    throw Error('ACTIVE_DIRECTORY_NOT_CANONICAL: count=' + actual.length + ', missing=' + missing.length + ', unexpected=' + unexpected.length);
  }
  return { count: actual.length, production: 51, pending: 4 };
}
const secretRules = [
  ['CREDENTIAL_PREFIX', /(?:sb_secret_|sk_live_|sk_test_)[A-Za-z0-9_-]{8,}/],
  ['PRIVATE_KEY', /-----BEGIN [A-Z ]*PRIVATE KEY/],
  ['CONNECTION_STRING', /postgres(?:ql)?:\/\//i],
  ['JWT_LITERAL', /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['EMAIL_IDENTITY', /[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['UUID_LITERAL', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
  ['TENANT_LITERAL', /['"]grafica-flash['"]/],
  // Defining an application routine with a runtime parameter is not a secret literal.
  ['VAULT_SECRET_LITERAL', /vault\.create_secret\s*\(\s*'[^']+'/i]
];
function inspectText(text) { return secretRules.filter(([, regex]) => regex.test(text)).map(([name]) => name); }
function binaryArtifact(packed) {
  if (packed.encoding !== 'base64' || typeof packed.data !== 'string') throw Error('BINARY_ARTIFACT_ENCODING');
  const bytes = Buffer.from(packed.data, 'base64');
  if (sha(bytes) !== packed.decoded_sha256) throw Error('BINARY_ARTIFACT_HASH');
  return bytes.toString('utf8');
}
function secretScan() {
  const m = manifest();
  const findings = [];
  for (const entry of m.entries) {
    const rules = inspectText(read(entry.path).toString('utf8'));
    if (rules.length) findings.push({ file: entry.path, rules });
    if (entry.path.endsWith('.raw.json')) {
      const rules = inspectText(binaryArtifact(json(entry.path)));
      if (rules.length) findings.push({ file: entry.path + ':decoded', rules });
    }
  }
  const rules = inspectText(catalog().text);
  if (rules.length) findings.push({ file: 'catalog:decoded-payload', rules });
  // Do not emit matched values, raw SQL, credentials or identities.
  if (findings.length) throw Error('PROVENANCE_SENSITIVE_CONTENT: ' + JSON.stringify(findings));
  return { inspected_files: m.entries.length, decoded_catalog: true, findings: 0, automatic_scan_not_security_certification: true };
}
function classifyTarget(value) {
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw Error('TARGET_INVALID_ENCODING'); }
  if (/ozrasuktfthsvbqprtel|zwxulgpjucxudadjdqov/i.test(decoded)) throw Error('PROTECTED_TARGET_REFUSED');
  let target;
  try { target = new URL(decoded); } catch { throw Error('TARGET_INVALID_URL'); }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw Error('TARGET_PROTOCOL_REFUSED');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.search || target.hash) throw Error('NONLOCAL_OR_OVERRIDE_TARGET_REFUSED');
  return 'LOCAL_CANDIDATE_NOT_AUTHORIZED_FOR_EXECUTION';
}
function freshReplay(value) {
  classifyTarget(value);
  manifest(); plan(); immutable(); secretScan();
  const state = json('supabase/provenance/frontier/DERIVATION_STATUS.json');
  if (state.status !== 'CERTIFIED' || !fs.existsSync(localFile('supabase/frontier/FRONTIER.json'))) {
    throw Error('FRONTIER_NOT_DERIVED: replay disabled; no connection opened');
  }
  // Deliberately no executor until empty-ledger/schema checks and local fixed-point are proven.
  throw Error('REPLAY_EXECUTOR_NOT_IMPLEMENTED: dependent on owner decision and frontier validation; no connection opened');
}
module.exports = { ROOT, BASE, LEDGER, SIGNATURE, sha, read, json, manifest, catalog, immutable, plan, activeDirectory, secretScan, inspectText, classifyTarget, freshReplay };
