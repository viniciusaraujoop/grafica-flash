/* eslint-disable @typescript-eslint/no-require-imports -- Focused standalone CommonJS evidence tests. */
// STATIC_VERIFIED only: no PL/pgSQL invocation or database connection.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const c = require('./r10-contract.cjs');
const BASE_HEAD = '761fd3c446e266b397b0016d94c014861cb70a4e';
const prefix = 'supabase/provenance/ledger/production/20260812003227_founder_invite_sales_integration_v1';
const replayPath = 'supabase/replay-forms/production/20260812003227_founder_invite_sales_integration_v1.sql';
const sql = c.read(replayPath).toString('utf8');
const record = c.read(prefix + '/ledger.sql').toString('utf8');
const body = sql.split('\n').slice(4).join('\n');
const neutral = c.json(prefix + '/neutralization.json');
const names = ['create_founder_invite_for_sales_lead', 'create_founder_test_invite', 'rotate_founder_invite_token', 'revoke_founder_invite'];
function fn(text, name) {
  const start = text.indexOf('create or replace function public.' + name + '(');
  const end = text.indexOf('\n$$;', start) + 4;
  assert.ok(start >= 0 && end >= 4);
  return text.slice(start, end);
}
const each = check => names.forEach(name => check(fn(body, name), name));
const historicalBytes = path => cp.execFileSync('git', ['-c', 'safe.directory=' + c.ROOT, '-C', c.ROOT, 'show', BASE_HEAD + ':' + path], { maxBuffer: 30 * 1024 * 1024 });
test('STATIC_VERIFIED 1: nonexistent actor rejected immediately after SELECT', () => each(text => {
  assert.match(text, /where id = p_actor_admin_id\n    and is_active = true;\n\n  if not found\n/);
}));
test('STATIC_VERIFIED 2: null actor rejected before authoritative lookup', () => each(text => {
  assert.match(text, /if p_actor_admin_id is null then\n    raise exception 'FOUNDER_(?:ACTOR_NOT_ALLOWED|TEST_OWNER_ONLY)';\n  end if;\n\n  select lower\(role\), lower\(email\)/);
}));
test('STATIC_VERIFIED 3: inactive actor excluded by authoritative query', () => each(text => assert.match(text, /from public\.platform_admins\n  where id = p_actor_admin_id\n    and is_active = true;/)));
test('STATIC_VERIFIED 4: null and invalid roles explicitly rejected', () => each(text => assert.match(text, /if not found\n     or v_actor_role is null\n     or v_actor_role (?:<> 'owner'|not in \('owner','prospector'\))\n  then\n    raise exception/)));
for (const [number, role] of [[5, 'admin'], [6, 'support'], [7, 'finance'], [8, 'super_admin']]) {
  test('STATIC_VERIFIED ' + number + ': ' + role + ' not allowed by any role gate', () => {
    each((text, name) => {
      const gate = neutral.exact_gate_patches.find(p => p.function === 'public.' + name).after;
      assert.ok(!gate.includes("'" + role + "'"));
      assert.match(gate, /v_actor_role is null/);
      assert.match(gate, /v_actor_role (?:<> 'owner'|not in \('owner','prospector'\))/);
      assert.ok(!text.includes('get_my_platform_admin_access'));
    });
  });
}
test('STATIC_VERIFIED 9: owner-only path allows only actual active owner row', () => {
  const text = fn(body, 'create_founder_test_invite');
  assert.match(text, /select lower\(role\), lower\(email\)[\s\S]*?from public\.platform_admins\n  where id = p_actor_admin_id\n    and is_active = true;/);
  assert.match(text, /or v_actor_role <> 'owner'/);
  assert.ok(!text.includes('[REDACTED_OWNER_EMAIL]'));
  assert.ok(!/v_actor_email\s*(?:=|<>|is)/i.test(text));
});
test('STATIC_VERIFIED 10: prospector allowed only in the three mixed gates', () => each((text, name) => {
  if (name === 'create_founder_test_invite') assert.ok(!text.includes("'prospector'"));
  else assert.match(text, /or v_actor_role not in \('owner','prospector'\)/);
}));
test('STATIC_VERIFIED 11: all prospector resource guards byte-preserved', () => {
  const create = fn(body, names[0]);
  assert.match(create, /v_lead\.assigned_to_admin_id is distinct from p_actor_admin_id/);
  for (const name of names.slice(2)) {
    const text = fn(body, name);
    assert.match(text, /v_invite\.created_by_admin_id is distinct from p_actor_admin_id/);
    assert.match(text, /if v_invite\.sales_lead_id is null then/);
    assert.match(text, /from public\.signup_leads\n    where id = v_invite\.sales_lead_id;/);
    assert.match(text, /v_current_assignee is distinct from p_actor_admin_id/);
  }
  for (const p of neutral.exact_gate_patches) {
    const old = fn(record, p.function.slice(7));
    const next = fn(body, p.function.slice(7));
    assert.equal(next.replace(p.after, '<GATE>'), old.replace(p.before, '<GATE>'));
  }
});
test('STATIC_VERIFIED 12: zero-owner state fails closed, no provisioning or alias', () => {
  assert.match(fn(body, names[1]), /if not found\n     or v_actor_role is null\n     or v_actor_role <> 'owner'/);
  assert.ok(!/(?:insert into|update) public\.platform_admins|auth\.users|get_my_platform_admin_access|super_admin|REDACTED_OWNER_EMAIL/i.test(body));
  const row18 = c.plan().index.rows[17].staged_replay_file;
  assert.deepEqual(c.read(row18), historicalBytes(row18));
  assert.match(c.read(row18).toString('utf8'), /create unique index platform_admins_single_active_owner_uidx\n  on public\.platform_admins \(\(1\)\)\n  where is_active = true\n    and lower\(role\) = 'owner';/);
});
for (const [number, role] of [[13, 'public'], [14, 'anon'], [15, 'authenticated']]) {
  test('STATIC_VERIFIED ' + number + ': ' + role + ' EXECUTE revoked for all five functions', () => {
    const revokes = body.split('\n').filter(line => line.startsWith('revoke all on function public.'));
    assert.equal(revokes.length, 5);
    for (const line of revokes) assert.match(line, /from public, anon, authenticated;$/);
    assert.ok(!new RegExp('grant execute[^;]+to\\s+' + role + '\\b', 'i').test(body));
  });
}
test('STATIC_VERIFIED 16: only service_role EXECUTE and all ACL statements unchanged', () => {
  const acl = text => text.split('\n').filter(line => /^(grant|revoke) /.test(line));
  assert.deepEqual(acl(body), acl(record));
  assert.equal(acl(body).filter(line => line.startsWith('grant execute on function')).length, 5);
  assert.ok(acl(body).filter(line => line.startsWith('grant execute on function')).every(line => line.endsWith('to service_role;')));
});
test('STATIC_VERIFIED 17: SECURITY DEFINER, owner DDL and search_path unchanged', () => each((text, name) => {
  const header = t => t.slice(0, t.indexOf('as $$'));
  assert.equal(header(text), header(fn(record, name)));
  assert.match(text, /security definer\nset search_path = pg_catalog, public/);
  assert.ok(!/alter function[^;]+owner to/i.test(body));
}));
test('STATIC_VERIFIED 18: whole SQL differs ONLY by four exact approved gate patches', () => {
  assert.deepEqual(c.read(prefix + '/ledger.sql'), historicalBytes(prefix + '/ledger.sql'));
  let restored = body;
  assert.equal(neutral.exact_gate_patches.length, 4);
  for (const p of neutral.exact_gate_patches) {
    assert.equal(c.sha(p.before), p.before_sha256);
    assert.equal(c.sha(p.after), p.after_sha256);
    const text = fn(restored, p.function.slice(7));
    assert.equal(text.split(p.after).length, 2);
    assert.equal(c.sha(text.replace(p.after, '<AUTHORIZED_GATE>')), p.unchanged_remainder_sha256);
    const next = text.replace(p.after, p.before);
    // Callback replacement preserves SQL dollar quotes and regex anchors literally.
    restored = restored.replace(text, () => next);
  }
  assert.equal(restored, record);
  for (const row of c.plan().index.rows.filter(r => r.ordered_position !== 30)) {
    assert.deepEqual(c.read(row.staged_replay_file), historicalBytes(row.staged_replay_file));
  }
});
test('STATIC_VERIFIED: narrow allowlist binds exact artifacts, no blanket exceptions', () => {
  const list = c.json('supabase/provenance/replay/SIGNATURE_ALLOWLIST.json');
  assert.equal(list.default, 'DENY_UNLISTED_DIFFERENCES');
  assert.deepEqual(list.entries.map(e => [e.ordered_position, e.classification]), [[1, 'EXPECTED_ENVIRONMENT_DATA_DIFFERENCE'], [3, 'EXPECTED_INFRASTRUCTURE_DIFFERENCE'], [18, 'SECURITY_REQUIRED_DIFFERENCE'], [30, 'SECURITY_REQUIRED_DIFFERENCE']]);
  for (const e of list.entries) {
    assert.equal(e.blanket_function_body_allowance, false);
    assert.equal(e.grant_or_signature_difference_allowed, false);
    if (e.ordered_position !== 30) assert.equal(e.function_patch_hashes.length, 0);
    if (e.ordered_position !== 30) {
      const evidence = c.json(e.neutralization_evidence);
      assert.deepEqual(e.exact_removed_units, evidence.removed_units.map(u => ({ raw_sha256: u.RAW_HASH, redacted_sha256: u.REDACTED_HASH })));
    }
  }
  assert.deepEqual(list.entries[3].function_patch_hashes, neutral.exact_gate_patches.map(p => ({ function: p.function, before: p.before_sha256, after: p.after_sha256, remainder: p.unchanged_remainder_sha256 })));
  const row1 = c.plan().index.rows[0].staged_replay_file;
  assert.match(c.read(row1).toString('utf8'), /automatic_payout_enabled boolean not null default false/);
  assert.ok(!/update public\.marketplace_payment_settings/i.test(c.read(row1).toString('utf8')));
  const bootstrap = c.read('supabase/provenance/git-history/20260706_marketplace_mercado_pago_split.sql').toString('utf8');
  assert.match(bootstrap, /create table if not exists public\.marketplace_payment_settings \([\s\S]*?is_active boolean not null default false/);
  const row3 = c.plan().index.rows[2].staged_replay_file;
  assert.ok(!/cron\.(?:schedule|unschedule|job)/i.test(c.read(row3).toString('utf8')));
});
