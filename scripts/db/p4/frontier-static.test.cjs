/* eslint-disable @typescript-eslint/no-require-imports -- Offline candidate tests, no database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../r10-contract.cjs');
const s = require('./signature.cjs');
const d = require('./derive-frontier.cjs');
const r = require('./runtime.cjs');
// Small structural lexer, not a PostgreSQL parser. Catalog/ledger provide SQL
// definitions; executable correctness remains explicitly runtime-pending.
function topLevel(sql) {
  const statements = []; let i = 0, start = 0, depth = 0;
  while (i < sql.length) {
    if (sql.startsWith('--', i)) { i = sql.indexOf('\n', i); if (i < 0) break; continue; }
    if (sql.startsWith('/*', i)) { const end = sql.indexOf('*/', i + 2); assert.ok(end >= 0); i = end + 2; continue; }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]; let closed = false;
      while (i < sql.length) {
        if (sql[i++] === quote) { if (sql[i] === quote) i++; else { closed = true; break; } }
      }
      assert.ok(closed, 'unterminated SQL quoted value'); continue;
    }
    if (sql[i] === '$') {
      const tag = sql.slice(i).match(/^\$[a-z_0-9]*\$/i)?.[0];
      if (tag) { const end = sql.indexOf(tag, i + tag.length); assert.ok(end >= 0); i = end + tag.length; continue; }
    }
    if (sql[i] === '(') depth++;
    if (sql[i] === ')') assert.ok(--depth >= 0, 'unbalanced parenthesis');
    if (sql[i] === ';' && depth === 0) { statements.push(sql.slice(start, i + 1).replace(/--[^\n]*/g, '').trim()); start = i + 1; }
    i++;
  }
  assert.equal(depth, 0);
  assert.equal(sql.slice(start).trim(), '');
  return statements;
}
test('STATIC_VERIFIED: deterministic candidate bytes, metadata, pins and provenance bindings', () => {
  const derived = d.derive(), bytes = c.read('supabase/frontier/production_base_frontier.sql');
  assert.deepEqual(bytes, Buffer.from(derived.sql)); // Includes frozen function-body CRLF.
  const meta = c.json('supabase/frontier/FRONTIER.json');
  assert.equal(meta.sha256, c.sha(bytes));
  assert.equal(c.immutable().frontier_sha256, meta.sha256);
  assert.equal(meta.derivation_status, 'CANDIDATE_NOT_RUNTIME_CERTIFIED');
  assert.equal(meta.fixed_point, 'NOT_EXECUTED');
  assert.equal(meta.production_signature_match, 'NOT_EXECUTED');
  assert.equal(meta.matrix_sha256, c.sha(c.read(meta.matrix)));
  for (const e of c.json('supabase/provenance/frontier/FRONTIER_CANDIDATE_BINDINGS.json').files) {
    assert.equal(c.sha(c.read(e.path)), e.sha256);
    assert.equal(c.read(e.path).length, e.bytes);
  }
  assert.equal(r.frontier().sha256, meta.sha256); // Reads only, does not run().
});
test('STATIC_VERIFIED: both approved constant-false bodies, owner, ACL and private-duplicate denial', () => {
  const sql = c.read('supabase/frontier/production_base_frontier.sql').toString();
  for (const [name, args, tag] of [['can_manage_company', 'p_company_id uuid', 'r10_preimage'], ['is_orcaly_admin', '', 'r10_admin_preimage']]) {
    assert.ok(sql.includes('CREATE FUNCTION public.' + name + '(' + args + ')\nRETURNS boolean\nLANGUAGE sql\n'));
    assert.ok(sql.includes('AS $' + tag + '$\n  SELECT FALSE;\n$' + tag + '$;'));
    assert.ok(sql.includes('ALTER FUNCTION public.' + name + '(' + (args ? 'uuid' : '') + ') OWNER TO postgres;'));
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.' + name + '(' + (args ? 'uuid' : '') + ')\n  FROM PUBLIC, anon, authenticated, service_role;'));
    assert.doesNotMatch(sql, new RegExp('GRANT [^;]+ ON FUNCTION (?:public|orcaly_private)[.]' + name, 'i'));
    assert.doesNotMatch(sql, new RegExp('CREATE(?: OR REPLACE)? FUNCTION orcaly_private[.]' + name, 'i'));
  }
});
test('STATIC_VERIFIED: six other moved bodies and signatures survive unchanged, not generalized stubs', () => {
  const candidate = d.derive();
  const frozen = s.frozen().payload.functions;
  for (const name of d.moves.filter(x => !['can_manage_company', 'is_orcaly_admin'].includes(x))) {
    const fn = frozen.find(x => x.schema === 'orcaly_private' && x.name === name);
    const emitted = candidate.statements.find(x => x.identity === 'public.' + name + '(' + fn.identity_args + ')');
    const declaration = fn.definition.replace('FUNCTION orcaly_private.' + name, 'FUNCTION public.' + name);
    assert.ok(emitted.sql.startsWith(declaration + ';'));
    assert.equal(fn.owner, 'postgres');
    const evidence = candidate.matrix.find(x => x.identity === emitted.identity);
    assert.ok(!evidence.selection.includes('STRUCTURAL_FAIL_CLOSED'));
  }
});
test('STATIC_VERIFIED: exact admin policy set and OID continuity through #7 and #26', () => {
  const plan = c.json('supabase/provenance/frontier/IS_ORCALY_ADMIN_POLICY_PLAN.json');
  const all = s.frozen().payload.policies.filter(p => JSON.stringify(p).includes('orcaly_private.is_orcaly_admin()'));
  assert.deepEqual(plan.policies.map(x => x.frozen), all.filter(x => x.tablename === 'company_members'));
  assert.deepEqual(plan.excluded.map(x => x.frozen), all.filter(x => x.tablename === 'admin_users'));
  const sql = c.read('supabase/frontier/production_base_frontier.sql').toString();
  for (const p of plan.policies) {
    assert.ok(sql.includes('CREATE POLICY "' + p.frozen.policyname + '" ON public.company_members'));
    assert.ok(!JSON.stringify(p.frontier).includes('orcaly_private.is_orcaly_admin'));
  }
  const rows = c.plan().index.rows;
  const move = c.read(rows[6].staged_replay_file).toString();
  assert.match(move, /alter function public\.is_orcaly_admin\(\)\n  set schema orcaly_private;/);
  assert.ok(rows.slice(7, 25).every(x => !/create(?: or replace)? function [\w.]*is_orcaly_admin\(/i.test(c.read(x.staged_replay_file).toString())));
  assert.match(c.read(rows[25].staged_replay_file).toString(), /create or replace function orcaly_private\.is_orcaly_admin\(\)/);
});
test('STATIC_VERIFIED: no ledger-created table/function duplication and no column-position holes', () => {
  const candidate = d.derive(), matrix = c.json('supabase/provenance/frontier/FRONTIER_OBJECT_MATRIX.json');
  assert.deepEqual(matrix.rows, candidate.matrix);
  assert.equal(matrix.materialized_frontier_objects, 561);
  assert.equal(candidate.counts.TABLE, 63);
  assert.equal(matrix.rows.filter(x => x.type === 'TABLE' && x.classification === 'LEDGER_CREATED').length, 50);
  assert.equal(matrix.other_preimage_decisions_required, 0);
  assert.ok(!matrix.rows.some(x => x.classification === 'UNKNOWN'));
  assert.equal(c.sha(c.read('supabase/provenance/replay/SIGNATURE_ALLOWLIST.json')), '40444929708b1ec12a1be15e30854c8b7dc37f1574069da920bd999c49572377');
});
test('STATIC_VERIFIED: structural SQL safety, no platform DDL, no business seeds or ledger mutations', () => {
  const sql = c.read('supabase/frontier/production_base_frontier.sql').toString();
  const statements = topLevel(sql); r.checkSql(sql);
  assert.equal(statements[0], 'BEGIN;'); assert.equal(statements.at(-1), 'COMMIT;');
  const seeds = statements.filter(x => /^(INSERT|UPDATE|DELETE|COPY|TRUNCATE|CALL|SELECT)\b/i.test(x));
  assert.equal(seeds.length, 6);
  for (const x of seeds) assert.match(x, /^INSERT INTO storage\.buckets \(id,name,public,file_size_limit,allowed_mime_types\) VALUES /);
  assert.ok(!statements.some(x => /CREATE (?:ROLE|USER|EXTENSION|SCHEMA (?:auth|storage|vault|cron|realtime))|CREATE TABLE (?:auth|storage|vault|cron|realtime)\./i.test(x)));
  assert.doesNotMatch(sql, /supabase_migrations|cron\.(?:schedule|unschedule|job)|\binsert into auth\./i);
  assert.deepEqual(c.inspectText(sql), []);
});
test('STATIC_VERIFIED: fail-closed payment defaults divided correctly between frontier and ledger #1', () => {
  const table = d.derive().statements.find(x => x.identity === 'public.marketplace_payment_settings');
  assert.match(table.sql, /"is_active" boolean DEFAULT false NOT NULL/);
  assert.ok(!table.sql.includes('automatic_payout_enabled'));
  const first = c.read(c.plan().index.rows[0].staged_replay_file).toString();
  assert.match(first, /automatic_payout_enabled boolean not null default false/);
  assert.doesNotMatch(first, /update public\.marketplace_payment_settings/i);
});
