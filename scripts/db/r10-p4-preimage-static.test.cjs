/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local evidence tests. */
// STATIC_VERIFIED only. Never connects to a database or executes this SQL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const c = require('./r10-contract.cjs');
const s = require('./p4/signature.cjs');
const prefix = 'supabase/provenance/frontier/';
const sql = c.read(prefix + 'CAN_MANAGE_COMPANY_PREIMAGE.sql').toString();
const executable = sql.replace(/--[^\n]*/g, '').trim();
const plan = c.json(prefix + 'CAN_MANAGE_COMPANY_POLICY_PLAN.json');
const rows = c.json('supabase/provenance/ledger/production/INDEX.json').rows;
const ledger7 = c.read(rows[6].staged_replay_file).toString();
const checkpoint = '1bae161ef79415f2932bf9ad3018dfcfb80096d8';
test('STATIC_VERIFIED: exact identity, constant FALSE even for NULL, no dependencies', () => {
  assert.equal(executable, [
    'CREATE FUNCTION public.can_manage_company(p_company_id uuid)',
    'RETURNS boolean', 'LANGUAGE sql', 'SECURITY INVOKER', 'CALLED ON NULL INPUT',
    "SET search_path = ''", 'AS $r10_preimage$', '  SELECT FALSE;', '$r10_preimage$;',
    '', 'ALTER FUNCTION public.can_manage_company(uuid) OWNER TO postgres;',
    'REVOKE ALL ON FUNCTION public.can_manage_company(uuid)',
    '  FROM PUBLIC, anon, authenticated, service_role;'
  ].join('\n'));
  assert.ok(!/\bstrict\b|auth\.|\bexecute\b|\bgrant\b|\bfrom\s+\w+\./i.test(executable));
  assert.ok(!executable.includes('orcaly_private'));
  assert.ok(!/COMMENT ON FUNCTION/i.test(executable));
  assert.match(sql, /R10 ENGINEERED PREIMAGE \/ STRUCTURAL \/ FAIL-CLOSED \/ NOT HISTORICAL/);
  assert.match(sql, /SUPERSEDED BY LEDGER 20260728182610/);
  assert.deepEqual(c.inspectText(sql), []);
});
test('STATIC_VERIFIED: twelve exact frozen policies, two ledger-created exclusions', () => {
  const affected = s.frozen().payload.policies.filter(p => JSON.stringify(p).includes('orcaly_private.can_manage_company('));
  assert.equal(affected.length, 14);
  assert.equal(plan.policies.length, 12);
  assert.equal(plan.excluded.length, 2);
  assert.deepEqual(plan.policies.map(p => p.frozen), affected.filter(p => !['delivery_assignments', 'delivery_drivers'].includes(p.tablename)));
  assert.deepEqual(plan.excluded.map(p => p.frozen), affected.filter(p => ['delivery_assignments', 'delivery_drivers'].includes(p.tablename)));
  const relations = [...new Set(plan.policies.map(p => p.frozen.tablename))].sort();
  assert.deepEqual(relations, ['companies', 'company_proposal_settings', 'order_items', 'orders', 'products', 'proposal_events', 'proposals', 'quote_templates']);
  for (const p of plan.policies) {
    const expected = { ...p.frozen,
      qual: p.frozen.qual?.replaceAll('orcaly_private.can_manage_company(', 'public.can_manage_company(') ?? null,
      with_check: p.frozen.with_check?.replaceAll('orcaly_private.can_manage_company(', 'public.can_manage_company(') ?? null };
    assert.deepEqual(p.frontier, expected);
    assert.ok(!JSON.stringify(p.frontier).includes('orcaly_private.can_manage_company'));
  }
  const delivery = c.read(rows[11].staged_replay_file).toString();
  for (const p of plan.excluded) {
    assert.equal(p.ordered_position, 12);
    assert.equal(p.replay_sha256, c.sha(delivery));
    assert.ok(delivery.includes('create policy ' + p.frozen.policyname));
  }
});
test('STATIC_VERIFIED: public identity moves before compatible replacement, no DROP/private precreate', () => {
  const move = ledger7.indexOf('alter function public.can_manage_company(uuid)');
  const replace = ledger7.indexOf('create or replace function orcaly_private.can_manage_company(p_company_id uuid)');
  assert.ok(move >= 0 && replace > move);
  assert.match(ledger7.slice(move), /^alter function public\.can_manage_company\(uuid\)\n  set schema orcaly_private;/);
  assert.ok(!/drop function[^;]*can_manage_company/i.test(ledger7));
  assert.equal(plan.selected_fragment_sha256, c.sha(sql));
  assert.equal(plan.status, 'STATIC_VERIFIED_RUNTIME_PENDING');
  assert.ok(rows.slice(0, 6).every(r => !c.read(r.staged_replay_file).toString().includes('can_manage_company')));
});
test('STATIC_VERIFIED: new admin preimage gate evidenced; approved decision not generalized', () => {
  assert.match(ledger7, /alter function public\.is_orcaly_admin\(\)\n  set schema orcaly_private;/);
  assert.ok(!/create(?: or replace)? function [\w.]*is_orcaly_admin/i.test(ledger7));
  assert.ok(ledger7.includes('or orcaly_private.is_orcaly_admin()'));
  const declarations = rows.filter(r => /create(?: or replace)? function [\w.]*is_orcaly_admin\(/i.test(c.read(r.staged_replay_file).toString()));
  assert.deepEqual(declarations.map(r => r.ordered_position), [26]);
  const matrix = c.json(prefix + 'FRONTIER_OBJECT_MATRIX.json');
  const gate = matrix.rows.find(r => r.identity === 'public.is_orcaly_admin()');
  assert.equal(gate.decision, 'FRONTIER_DECISION_REQUIRED');
  assert.equal(gate.stub_emitted, false);
  assert.equal(gate.authoritative_later_replacements[0].ordered_position, 26);
  assert.equal(matrix.rows.find(r => r.identity === 'public.can_manage_company(uuid)').decision, 'RESOLVED_STRUCTURAL_FAIL_CLOSED_PREIMAGE');
  assert.equal(matrix.rows.filter(r => r.decision === 'FRONTIER_DECISION_REQUIRED').length, 1);
});
test('STATIC_VERIFIED: incomplete frontier stays blocked, P3 and certified migrations unchanged', () => {
  const d = c.json(prefix + 'DERIVATION_STATUS.json');
  assert.equal(d.entry_30_status, 'CLOSED_BY_P3');
  assert.equal(d.candidate_materialized, false);
  assert.equal(d.frontier_object_count, 0);
  assert.equal(d.other_preimage_decisions_required, 1);
  assert.ok(!d.blockers.some(x => x.includes('choose') && x.includes('can_manage_company')));
  assert.equal(d.fixed_point, 'NOT_EXECUTED');
  assert.equal(c.immutable().frontier_sha256, null);
  for (const p of ['supabase/frontier/production_base_frontier.sql', 'supabase/frontier/FRONTIER.json']) assert.equal(fs.existsSync(path.join(c.ROOT, p)), false);
  for (const r of rows) {
    const before = cp.execFileSync('git', ['-C', c.ROOT, 'show', checkpoint + ':' + r.staged_replay_file]);
    assert.deepEqual(c.read(r.staged_replay_file), before);
  }
  const allow = 'supabase/provenance/replay/SIGNATURE_ALLOWLIST.json';
  assert.deepEqual(c.read(allow), cp.execFileSync('git', ['-C', c.ROOT, 'show', checkpoint + ':' + allow]));
  assert.equal(c.manifest().entries.length >= 245, true);
  assert.ok(c.secretScan());
});
