/* eslint-disable @typescript-eslint/no-require-imports -- Offline derivation, never executes SQL. */
const c = require('../r10-contract.cjs');
const s = require('./signature.cjs');
const q = name => '"' + name.replaceAll('"', '""') + '"';
const literal = text => "'" + text.replaceAll("'", "''") + "'";
const identity = (schema, name) => schema + '.' + name;
const qualified = (schema, name) => q(schema) + '.' + q(name);
const moves = ['is_orcaly_admin', 'can_manage_company', 'is_company_member', 'is_company_owner',
  'my_company_role', 'orcaly_user_has_company_access', 'check_company_member_limit', 'create_default_site_for_company'];
const reverse = text => moves.reduce((out, name) => out.replaceAll('orcaly_private.' + name, 'public.' + name), text);
const roleSql = role => role === '' || role === 'public' ? 'PUBLIC' : q(role);
const privileges = { a: 'INSERT', r: 'SELECT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN', X: 'EXECUTE', U: 'USAGE', C: 'CREATE' };
function aclGrants(acl, object, column) {
  if (acl == null) return [];
  return acl.slice(1, -1).split(',').filter(Boolean).map(entry => {
    const m = entry.match(/^([^=]*)=([A-Za-z]+)\/postgres$/);
    if (!m) throw Error('UNREVIEWED_ACL_GRANTOR_OR_OPTION');
    const names = [...m[2]].map(x => { if (!privileges[x]) throw Error('ACL_PRIVILEGE_UNKNOWN'); return privileges[x] + (column ? ' (' + q(column) + ')' : ''); });
    return 'GRANT ' + names.join(', ') + ' ON ' + object + ' TO ' + roleSql(m[1]) + ';';
  });
}
function derive() {
  const catalog = s.frozen().payload, ledger = c.plan().index.rows;
  const created = new Map(), columns = new Map(), indexes = new Map(), functions = new Map(),
    policies = new Map(), triggers = new Map(), namedConstraints = new Map(), views = new Map();
  const put = (map, key, r) => { if (!map.has(key)) map.set(key, r.ordered_position); };
  for (const r of ledger) {
    const text = c.read(r.staged_replay_file).toString();
    for (const m of text.matchAll(/create table(?: if not exists)? ((?:public|orcaly_private)\.[a-z_]+)/gi)) put(created, m[1], r);
    for (const m of text.matchAll(/alter table ((?:public|orcaly_private)\.[a-z_]+)([\s\S]*?);/gi)) {
      for (const col of m[2].matchAll(/add column(?: if not exists)? ([a-z_]+)/gi)) put(columns, m[1] + '.' + col[1], r);
      for (const con of m[2].matchAll(/add constraint ([a-z_]+)/gi)) put(namedConstraints, m[1] + '.' + con[1], r);
    }
    for (const m of text.matchAll(/create (?:unique )?index(?: if not exists)? ([a-z_0-9]+)/gi)) put(indexes, m[1], r);
    for (const m of text.matchAll(/create(?: or replace)? function ((?:public|orcaly_private)\.[a-z_0-9]+)/gi)) put(functions, m[1], r);
    for (const m of text.matchAll(/create(?: or replace)? view ((?:public|orcaly_private)\.[a-z_0-9]+)/gi)) put(views, m[1], r);
    for (const m of text.matchAll(/create policy ("[^"]+"|[a-z_0-9]+)/gi)) put(policies, m[1].replaceAll('"', ''), r);
    for (const m of text.matchAll(/create trigger ([a-z_0-9]+)/gi)) put(triggers, m[1], r);
  }
  // Ledger #46 renames the body created by #44: not an additional pre-ledger function.
  functions.set('public.refresh_company_data_quality_v1', 44);
  const out = ['-- R10 ENGINEERED PRE-LEDGER FRONTIER / NOT HISTORICAL / NOT LEDGERED.',
    '-- FRESH EMPTY DISPOSABLE ENVIRONMENT ONLY. NEVER PRODUCTION OR STAGING.',
    '-- CANDIDATE_NOT_RUNTIME_CERTIFIED. Agent 4 review and fixed-point replay required.',
    'BEGIN;', 'SET LOCAL search_path = pg_catalog, public;'];
  const matrix = [], statements = [];
  const emit = (type, id, sql, evidence) => {
    matrix.push({ type, identity: id, classification: 'FRONTIER_REQUIRED', selection: evidence,
      definition_sha256: c.sha(sql), evidence_level: 'MATERIALIZED_SCHEMA_EVIDENCE_PLUS_REVERSE_LEDGER_ANALYSIS' });
    statements.push({ type, identity: id, sql }); out.push('\n' + sql);
  };
  const exclude = (type, id, position) => matrix.push({ type, identity: id, classification: 'LEDGER_CREATED', ordered_position: position });
  const baseTables = catalog.relations.filter(x => x.kind === 'r' && !created.has(identity(x.schema, x.name)));
  const baseIds = new Set(baseTables.map(x => identity(x.schema, x.name)));
  if (created.size !== 50 || baseTables.length !== 63) throw Error('TABLE_EFFECT_INVENTORY_DRIFT');
  // Public and Supabase roles/internals/default ACLs are platform prerequisites, not recreated.
  emit('SCHEMA', 'api', 'CREATE SCHEMA api AUTHORIZATION postgres;\nREVOKE ALL ON SCHEMA api FROM PUBLIC, anon, authenticated, service_role;\nGRANT USAGE ON SCHEMA api TO anon, authenticated;', 'Frozen api definition; never created by the 51 forms.');
  const baseColumns = new Map();
  for (const table of catalog.relations.filter(x => x.kind === 'r')) {
    const id = identity(table.schema, table.name);
    if (!baseIds.has(id)) { exclude('TABLE', id, created.get(id)); continue; }
    if (table.persistence !== 'p' || table.options || table.partition_key || table.partition_bound) throw Error('UNREVIEWED_TABLE_VARIANT:' + id);
    const cols = catalog.columns.filter(x => x.schema === table.schema && x.relation === table.name && !columns.has(id + '.' + x.name));
    cols.forEach((x, i) => {
      if (Number(x.position.$r10Number) !== i + 1 || x.identity || x.generated) throw Error('PREIMAGE_COLUMN_TOPOLOGY_REQUIRED:' + id + '.' + x.name);
    });
    baseColumns.set(id, cols);
    const definitions = cols.map(x => '  ' + q(x.name) + ' ' + x.type +
      (x.default_or_generation_expression == null ? '' : ' DEFAULT ' + x.default_or_generation_expression) + (x.not_null ? ' NOT NULL' : ''));
    emit('TABLE', id, 'CREATE TABLE ' + qualified(table.schema, table.name) + ' (\n' + definitions.join(',\n') + '\n);\nALTER TABLE ' + qualified(table.schema, table.name) + ' OWNER TO postgres;',
      'Frozen unchanged column definitions; remove every ledger ADD COLUMN. Attnum continuity checked; no business rows.');
  }
  for (const fn of catalog.functions) {
    const id = identity(fn.schema, fn.name), moved = moves.includes(fn.name);
    if (functions.has(id) && !moved) { exclude('FUNCTION', id + '(' + fn.identity_args + ')', functions.get(id)); continue; }
    if (moved && ['can_manage_company', 'is_orcaly_admin'].includes(fn.name)) {
      const file = 'supabase/provenance/frontier/' + (fn.name === 'can_manage_company' ? 'CAN_MANAGE_COMPANY_PREIMAGE.sql' : 'IS_ORCALY_ADMIN_PREIMAGE.sql');
      emit('FUNCTION', 'public.' + fn.name + '(' + fn.identity_args + ')', c.read(file).toString(), 'Explicit Founder-provided Agent 2 STRUCTURAL_FAIL_CLOSED_PREIMAGE; historical body UNKNOWN.');
      continue;
    }
    if (fn.owner !== 'postgres') throw Error('FUNCTION_OWNER_DECISION_REQUIRED:' + id);
    // Only the declaration schema changes. The six surviving bodies are NOT stubbed.
    const declaration = moved ? fn.definition.replace('FUNCTION orcaly_private.' + fn.name, 'FUNCTION public.' + fn.name) : fn.definition;
    const preId = moved ? 'public.' + fn.name : id;
    emit('FUNCTION', preId + '(' + fn.identity_args + ')', declaration + ';\nALTER FUNCTION ' + preId + '(' + fn.identity_args + ') OWNER TO postgres;\nREVOKE ALL ON FUNCTION ' + preId + '(' + fn.identity_args + ') FROM PUBLIC, anon, authenticated, service_role;',
      moved ? 'Frozen body survives #7; all 51 forms reviewed for replacement. Declaration schema reversed only; #7 owns subsequent ACL.' : 'Unchanged frozen body required by baseline or ledger ALTER; no CREATE in the 51 forms.');
  }
  const removedReference = (text, id) => [...columns.keys()].filter(x => x.startsWith(id + '.')).some(x => {
    const name = x.slice(id.length + 1); return new RegExp('\\b' + name + '\\b').test(text);
  });
  const retainedConstraints = [];
  for (const con of catalog.constraints) {
    const table = con.relation.includes('.') ? con.relation : identity(con.schema, con.relation);
    const id = table + '.' + con.name;
    if (!baseIds.has(table) || namedConstraints.has(id) || removedReference(con.definition, table)) { exclude('CONSTRAINT', id, namedConstraints.get(id) || created.get(table) || 'ADDED_COLUMN'); continue; }
    if (!['p', 'u', 'f', 'c'].includes(con.kind) || con.domain) throw Error('CONSTRAINT_VARIANT_REQUIRED:' + id);
    const def = reverse(con.definition) + (!con.validated ? ' NOT VALID' : '');
    emit('CONSTRAINT', id, 'ALTER TABLE ' + table + ' ADD CONSTRAINT ' + q(con.name) + ' ' + def + ';', 'Frozen unchanged constraint; ledger-created tables/columns/named additions excluded.');
    retainedConstraints.push(con);
  }
  for (const ix of catalog.indexes) {
    const id = identity(ix.schema, ix.table), ixId = identity(ix.schema, ix.name);
    if (!baseIds.has(id) || indexes.has(ix.name) || removedReference(ix.definition, id)) { exclude('INDEX', ixId, indexes.get(ix.name) || created.get(id) || 'ADDED_COLUMN'); continue; }
    if (retainedConstraints.some(x => x.name === ix.name && x.schema === ix.schema)) continue; // Created by its retained PK/UNIQUE.
    if (!ix.valid || !ix.ready || ix.replica_identity || ix.exclusion) throw Error('INDEX_VARIANT_REQUIRED:' + ixId);
    emit('INDEX', ixId, reverse(ix.definition) + ';', 'Unchanged frozen standalone index; ledger CREATE INDEX names excluded, including #22/#23.');
  }
  for (const view of catalog.views) {
    const id = identity(view.schema, view.name);
    if (views.has(id)) { exclude('VIEW', id, views.get(id)); continue; }
    emit('VIEW', id, 'CREATE VIEW ' + id + ' WITH (security_invoker = true) AS\n' + reverse(view.definition), 'Frozen body unchanged; #5 sets security_invoker and ACL.');
  }
  for (const trigger of catalog.triggers) {
    const id = identity(trigger.schema, trigger.table);
    if (!baseIds.has(id) || triggers.has(trigger.name)) { exclude('TRIGGER', id + '.' + trigger.name, triggers.get(trigger.name) || created.get(id)); continue; }
    if (trigger.enabled !== 'O' || trigger.constraint) throw Error('TRIGGER_VARIANT_REQUIRED:' + trigger.name);
    emit('TRIGGER', id + '.' + trigger.name, reverse(trigger.definition) + ';', 'Frozen unchanged trigger; moved function references bind PUBLIC OID.');
  }
  for (const table of baseTables) {
    const id = identity(table.schema, table.name);
    if (table.rls_enabled) out.push('ALTER TABLE ' + id + ' ENABLE ROW LEVEL SECURITY;');
    if (table.rls_forced) out.push('ALTER TABLE ' + id + ' FORCE ROW LEVEL SECURITY;');
  }
  for (const p of catalog.policies) {
    const id = identity(p.schemaname, p.tablename);
    if (!baseIds.has(id) || policies.has(p.policyname)) { exclude('POLICY', id + '.' + p.policyname, policies.get(p.policyname) || created.get(id)); continue; }
    const sql = 'CREATE POLICY ' + q(p.policyname) + ' ON ' + id + ' AS ' + p.permissive + ' FOR ' + p.cmd + ' TO ' + p.roles.map(roleSql).join(', ') +
      (p.qual == null ? '' : ' USING (' + reverse(p.qual) + ')') + (p.with_check == null ? '' : ' WITH CHECK (' + reverse(p.with_check) + ')') + ';';
    emit('POLICY', id + '.' + p.policyname, sql, 'Frozen policy not recreated by ledger; all eight moved-helper references reversed to PUBLIC OIDs.');
  }
  for (const object of catalog.relations.filter(x => baseIds.has(identity(x.schema, x.name)) ||
      (x.kind === 'v' && !views.has(identity(x.schema, x.name))))) {
    const id = identity(object.schema, object.name);
    out.push('REVOKE ALL ON TABLE ' + id + ' FROM PUBLIC, anon, authenticated, service_role;');
    out.push(...aclGrants(object.acl, 'TABLE ' + id));
    if (object.comment != null) out.push('COMMENT ON ' + (object.kind === 'v' ? 'VIEW ' : 'TABLE ') + id + ' IS ' + literal(object.comment) + ';');
    for (const col of baseColumns.get(id) || []) {
      out.push(...aclGrants(col.acl, 'TABLE ' + id, col.name));
      if (col.comment != null) out.push('COMMENT ON COLUMN ' + id + '.' + q(col.name) + ' IS ' + literal(col.comment) + ';');
    }
  }
  // Six moved functions retain their known final predicate/trigger behavior; #7 later
  // resets these exact four roles. Only the two explicitly approved stubs deny all.
  for (const fn of catalog.functions) {
    const id = identity(fn.schema, fn.name);
    if (['can_manage_company', 'is_orcaly_admin'].includes(fn.name) ||
        (functions.has(id) && !moves.includes(fn.name))) continue;
    const preId = moves.includes(fn.name) ? 'public.' + fn.name : id;
    out.push(...aclGrants(fn.acl, 'FUNCTION ' + preId + '(' + fn.identity_args + ')'));
  }
  // Bucket definitions are approved application configuration, NOT tenant/user rows
  // or Storage objects. The platform storage schema/tables are prerequisites only.
  for (const b of catalog.bucket_configuration) {
    const mime = b.allowed_mime_types == null ? 'NULL' : 'ARRAY[' + b.allowed_mime_types.map(literal).join(',') + ']::text[]';
    emit('BUCKET_CONFIGURATION', b.id, 'INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES (' +
      [literal(b.id), literal(b.name), String(b.public), b.file_size_limit?.$r10Number || 'NULL', mime].join(',') + ');',
      'Application-owned bucket configuration only; #9/#11 apply their authoritative configuration changes. No Storage objects copied.');
  }
  for (const seq of catalog.sequences) {
    // All three frozen sequences belong to the #44 identity columns; no baseline sequence.
    if (!['product_analytics_events_id_seq', 'company_health_snapshots_id_seq', 'demo_data_registry_id_seq'].includes(seq.name)) throw Error('SEQUENCE_PREIMAGE_DECISION_REQUIRED:' + seq.name);
    exclude('SEQUENCE', identity(seq.schema, seq.name), 44);
  }
  for (const type of catalog.types) {
    if (type.kind !== 'c' || !type.composite_relation) throw Error('TYPE_PREIMAGE_DECISION_REQUIRED:' + type.name);
    matrix.push({ type: 'IMPLICIT_COMPOSITE_TYPE', identity: identity(type.schema, type.name),
      classification: 'GENERATED_BY_RELATION_DDL', relation: type.composite_relation,
      note: 'Never independently recreated or duplicated; owned by its table/view definition.' });
  }
  exclude('SCHEMA', 'orcaly_private', 6);
  matrix.push({ type: 'SCHEMA', identity: 'public', classification: 'PLATFORM_PREREQUISITE_NOT_RECREATED' });
  for (const p of catalog.storage_policies) exclude('STORAGE_POLICY', p.policyname, 9);
  out.push('COMMIT;');
  const sql = out.join('\n') + '\n';
  if (c.inspectText(sql).length) throw Error('FRONTIER_PRIVACY_FAILURE');
  return { matrix, statements, sql, counts: statements.reduce((a, x) => { a[x.type] = (a[x.type] || 0) + 1; return a; }, {}),
    prerequisites: { postgres_major_version: 17, public_schema: catalog.schemas.find(x => x.name === 'public'),
      default_privileges: catalog.default_privileges, extensions: catalog.extension_assertions,
      platform_references: catalog.platform_prerequisite_references,
      platform_object_assertions: catalog.platform_prerequisite_object_assertions } };
}
module.exports = { derive, moves, reverse, literal, aclGrants };
